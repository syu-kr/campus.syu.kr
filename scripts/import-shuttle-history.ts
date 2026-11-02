import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {initializeScriptFirestore,admin} from "./firebase-admin";
import {buildShuttleHistory} from "../lib/shuttle-history";
import {advanceShuttleLearning,type LearningState,type LearningPoint} from "../lib/shuttle-learning";
import type {PilotEvent} from "../lib/shuttle-observations";
import {getApps,deleteApp} from "firebase-admin/app";

async function main() {
  const args=process.argv.slice(2),file=args.find(a=>!a.startsWith("--"));
  if(!file||args.some(a=>a.startsWith("--")&&a!=="--apply"))throw new Error("Usage: import-shuttle-history <dataset.json> [--apply]");
  const bytes=readFileSync(file);if(bytes.length>10*1024*1024)throw new Error("History file too large");
  const digest=createHash("sha256").update(bytes).digest("hex"),dataset=buildShuttleHistory(JSON.parse(bytes.toString("utf8")));
  if(Buffer.byteLength(JSON.stringify(dataset.events))>500000)throw new Error("History requires chunking");
  const db=await initializeScriptFirestore();
  const snapshot=await db.collection("shuttle_pilot_receipts").where("schemaVersion","==",2).limit(5001).get();
  if(snapshot.size>5000)throw new Error("Review chunked backfill for more than 5000 receipts");
  const frames=snapshot.docs.map(d=>d.data()).sort((a,b)=>a.receivedAt-b.receivedAt||a.observedAt-b.observedAt);
  let replay:LearningState|undefined;
  for(const frame of frames)replay=advanceShuttleLearning(replay,(frame.rows??[]) as LearningPoint[],(frame.events??[]) as PilotEvent[],frame.receivedAt);
  const profiles={...dataset.profiles};
  // Recent samples are a separate prior; new live profiles take over progressively.
  for(const [from,profile] of Object.entries(replay?.profiles??{})) {
    const old=profiles[from];
    profiles[from]=old?{seconds:(old.seconds*5+profile.seconds*profile.n)/(5+profile.n),n:old.n+profile.n,cells:{...old.cells,...profile.cells}}:profile;
  }
  const summary={...dataset.summary,digest,recentFrames:frames.length,recentProfileSamples:Object.values(replay?.profiles??{}).reduce((n,p)=>n+p.n,0),profileLegs:Object.keys(profiles).length};
  if(!args.includes("--apply")){console.log(JSON.stringify({mode:"dry-run",...summary}));return;}
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
main().catch(()=>{console.error("Shuttle history import failed; private input and credentials suppressed.");process.exitCode=1;}).finally(()=>Promise.all(getApps().map(app=>deleteApp(app))));
