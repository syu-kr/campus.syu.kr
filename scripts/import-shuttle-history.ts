import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {initializeScriptFirestore,admin} from "./firebase-admin";
import {buildShuttleHistory} from "../lib/shuttle-history";
import {advanceShuttleLearning,type LearningState,type LearningPoint} from "../lib/shuttle-learning";
import type {PilotEvent} from "../lib/shuttle-observations";
import {getApps,deleteApp} from "firebase-admin/app";
import {recordShuttleMetric,flushShuttleMetrics} from "../lib/server/shuttle-metrics";

export async function importShuttleHistory(args:string[]) {
  const file=args.find(a=>!a.startsWith("--"));
  const receiptFile=args.find(a=>a.startsWith("--receipts="))?.slice("--receipts=".length);
  const remote=args.includes("--read-receipts"),apply=args.includes("--apply");
  if(!file||args.some(a=>a.startsWith("--")&&a!=="--apply"&&a!=="--read-receipts"&&!a.startsWith("--receipts="))||
    receiptFile!==undefined&&!receiptFile||remote&&receiptFile||apply&&!remote&&!receiptFile) {
    throw new Error("Use <dataset.json> [--receipts=<local-snapshot.json> | --read-receipts] [--apply]");
  }
  const bytes=readFileSync(file);if(bytes.length>10*1024*1024)throw new Error("History file too large");
  const digest=createHash("sha256").update(bytes).digest("hex"),dataset=buildShuttleHistory(JSON.parse(bytes.toString("utf8")));
  if(Buffer.byteLength(JSON.stringify(dataset.events))>500000)throw new Error("History requires chunking");
  let db:Awaited<ReturnType<typeof initializeScriptFirestore>>|undefined;
  let frames:{receivedAt:number;observedAt?:number;rows?:LearningPoint[];events?:PilotEvent[]}[]=[];
  if(receiptFile) {
    const receiptBytes=readFileSync(receiptFile);
    if(receiptBytes.length>10*1024*1024)throw new Error("Receipt snapshot too large");
    const value:unknown=JSON.parse(receiptBytes.toString("utf8"));
    if(!Array.isArray(value)||value.length>5000||value.some(frame=>!frame||!Number.isSafeInteger(frame.receivedAt)||
      !Array.isArray(frame.rows)||frame.rows.length>100||!Array.isArray(frame.events)||frame.events.length>200))throw new Error("Invalid receipt snapshot");
    frames=value;
  }
  if(remote) {
    db=await initializeScriptFirestore();
    const snapshot=await db.collection("shuttle_pilot_receipts").where("schemaVersion","==",2).limit(5001).get();
    recordShuttleMetric("history.backfill",{reads:Math.max(1,snapshot.size),documents:snapshot.size});
    if(snapshot.size>5000)throw new Error("Review chunked backfill for more than 5000 receipts");
    frames=snapshot.docs.map(d=>d.data()) as typeof frames;
  }
  frames.sort((a,b)=>a.receivedAt-b.receivedAt||(a.observedAt??a.receivedAt)-(b.observedAt??b.receivedAt));
  let replay:LearningState|undefined;
  for(const frame of frames)replay=advanceShuttleLearning(replay,(frame.rows??[]) as LearningPoint[],(frame.events??[]) as PilotEvent[],frame.receivedAt);
  const profiles={...dataset.profiles};
  // Recent samples are a separate prior; new live profiles take over progressively.
  for(const [from,profile] of Object.entries(replay?.profiles??{})) {
    const old=profiles[from];
    profiles[from]=old?{seconds:(old.seconds*5+profile.seconds*profile.n)/(5+profile.n),n:old.n+profile.n,cells:{...old.cells,...profile.cells}}:profile;
  }
  const summary={...dataset.summary,digest,recentFrames:frames.length,recentProfileSamples:Object.values(replay?.profiles??{}).reduce((n,p)=>n+p.n,0),profileLegs:Object.keys(profiles).length};
  if(!apply){console.log(JSON.stringify({mode:"dry-run",...summary}));return;}
  db??=await initializeScriptFirestore();
  const now=Date.now(),importRef=db.collection("shuttle_history_imports").doc(digest),historyRef=db.collection("shuttle_eta").doc("history");
  const result=await db.runTransaction(async tx=>{
    const [existing,history]=await tx.getAll(importRef,historyRef);
    if(existing.exists)return "already-imported";
    if(history.exists&&history.data()?.digest!==digest)throw new Error("Review existing history before replacing it");
    tx.create(importRef,{...summary,events:dataset.events,importedAt:now,expires_at:admin.firestore.Timestamp.fromMillis(now+30*86400000),sourceKind:"minute-detections"});
    tx.set(historyRef,{schemaVersion:1,digest,profiles,summary,importedAt:now,sourceKind:"historical-and-receiver-prior"});
    return "imported";
  });
  console.log(JSON.stringify({mode:result,...summary}));
}
if(require.main===module)void importShuttleHistory(process.argv.slice(2))
  .catch(()=>{console.error("Shuttle history import failed; private input and credentials suppressed.");process.exitCode=1;})
  .finally(()=>{flushShuttleMetrics();return Promise.all(getApps().map(app=>deleteApp(app)));});
