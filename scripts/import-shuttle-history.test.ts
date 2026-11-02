// @vitest-environment node
import {afterEach,expect,it,vi} from "vitest";
import {importShuttleHistory} from "./import-shuttle-history";
import {initializeScriptFirestore} from "./firebase-admin";
import {readFileSync} from "node:fs";
vi.mock("./firebase-admin",()=>({initializeScriptFirestore:vi.fn(),admin:{}}));
vi.mock("node:fs",()=>({readFileSync:vi.fn()}));
const bytes=Buffer.from(JSON.stringify({rows:[{station:"석계역",date:"2026-10-30",timeHHMM:"13:00",vehicleAlias:"a"}]}));
afterEach(()=>vi.restoreAllMocks());
it("does not contact Firestore on the default dry run",async()=>{
  vi.mocked(readFileSync).mockReturnValue(bytes);
  const log=vi.spyOn(console,"log").mockImplementation(()=>undefined);
  await importShuttleHistory(["private.json"]);
  expect(initializeScriptFirestore).not.toHaveBeenCalled();
  expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({mode:"dry-run",recentFrames:0});
});
it("requires an explicit receipt input before apply and rejects oversized receipt snapshots before I/O",async()=>{
  await expect(importShuttleHistory(["private.json","--apply"])).rejects.toThrow();
  vi.mocked(readFileSync).mockReturnValueOnce(bytes).mockReturnValueOnce(Buffer.alloc(11*1024*1024));
  await expect(importShuttleHistory(["private.json","--receipts=frames.json"])).rejects.toThrow("too large");
  expect(initializeScriptFirestore).not.toHaveBeenCalled();
});
