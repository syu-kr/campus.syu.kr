// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
const memory = vi.hoisted(() => ({ documents: new Map<string, Record<string, unknown>>(), queue: Promise.resolve(), fields: { title: "공지 제목", content: "내용" } as Record<string, string>, failRead: false, failCacheWrite: false }));
vi.mock("./content-translation-sources", () => ({ resolvePublicTranslationSource: vi.fn(async () => memory.fields) }));
vi.mock("./firestore", () => ({
  admin: { firestore: { Timestamp } },
  getFirestore: () => ({
    collection: (name: string) => ({ doc: (id: string) => ({ id: `${name}/${id}` }) }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const result = memory.queue.then(() => fn({
        get: async (ref: { id: string }) => { if (memory.failRead) throw new Error("Cache unavailable");return { exists: memory.documents.has(ref.id), get: (field: string) => memory.documents.get(ref.id)?.[field] }; },
        set: (ref: { id: string }, value: Record<string, unknown>) => { if (memory.failCacheWrite && value.translation) throw new Error("Cache commit unavailable");return memory.documents.set(ref.id, value); },
        delete: (ref: { id: string }) => memory.documents.delete(ref.id),
      }));
      memory.queue = result.then(() => undefined, () => undefined);
      return result;
    },
  }),
}));
import { parseTranslationRequest, translatePublicContent, isContentTranslationConfigured } from "./content-translation";
import { resolvePublicTranslationSource } from "./content-translation-sources";

const request = () => parseTranslationRequest({ source: { kind: "announcement", id: "academic-1", category: "academic" }, fields: ["title"], target: "en" });
const provider = () => Response.json({ data: { translations: [{ translatedText: "Notice &amp; title" }] } });
const fieldCaches = () => [...memory.documents.entries()].filter(([key]) => key.startsWith("public_content_translation_fields/"));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
beforeEach(() => {
  memory.documents.clear(); memory.queue = Promise.resolve(); memory.fields = { title: "공지 제목", content: "내용" };memory.failRead=false;memory.failCacheWrite=false;
  vi.stubEnv("GOOGLE_TRANSLATION_API_KEY", "test-key");vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "test-only");vi.stubEnv("RATE_LIMIT_SECRET", "test-only");vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS", "25000");
  vi.stubGlobal("fetch", vi.fn(async () => provider()));
});
afterEach(() => { vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks(); });

describe("public content translation", () => {
  it("rejects private kinds, arbitrary text/URLs and non-English targets", () => {
    for (const body of [
      { source: { kind: "roommate", id: "one" }, fields: ["title"], target: "en" },
      { ...request(), text: "private input" },
      { ...request(), source: { kind: "announcement", id: "one", category: "academic", url: "https://example.com" } },
      { ...request(), target: "ja" },
      { ...request(), source: { kind: "service-notice", id: "../../secret" } },
      { ...request(), fields: Array.from({ length: 41 }, (_, i) => String(i)) },
    ]) expect(() => parseTranslationRequest(body)).toThrow();
  });
  it("normalizes duplicate field order and requires known announcement categories", () => {
    expect(parseTranslationRequest({ ...request(), fields: ["title", "content", "title"] }).fields).toEqual(["content", "title"]);
    expect(() => parseTranslationRequest({ ...request(), source: { kind: "announcement", id: "one" } })).toThrow();
  });
  it("fails closed before reading source or fetching when key or shared safeguards are missing", async () => {
    vi.stubEnv("GOOGLE_TRANSLATION_API_KEY", "");
    expect(isContentTranslationConfigured()).toBe(false);
    await expect(translatePublicContent(request())).rejects.toMatchObject({ status: 503, code: "TRANSLATION_UNAVAILABLE" });
    expect(fetch).not.toHaveBeenCalled();expect(resolvePublicTranslationSource).not.toHaveBeenCalled();
    vi.stubEnv("GOOGLE_TRANSLATION_API_KEY", "test");vi.stubEnv("RATE_LIMIT_SECRET", "");
    await expect(translatePublicContent(request())).rejects.toMatchObject({ status: 503 });
  });
  it("uses source fields, caches repeated output and coalesces simultaneous requests", async () => {
    const [a, b] = await Promise.all([translatePublicContent(request()), translatePublicContent(request())]);
    expect(a).toEqual(b);expect(a.translations.title).toBe("Notice & title");expect(a.originals).toEqual({ title: "공지 제목" });
    const c = await translatePublicContent(request());expect(c).toEqual(a);expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://translation.googleapis.com/language/translate/v2");
    expect(JSON.parse(options!.body as string)).toEqual({ q: ["공지 제목"], source: "ko", target: "en", format: "text" });
    expect(String(url)).not.toContain("test-key");
    const budget = [...memory.documents.entries()].find(([key]) => key.startsWith("public_content_translation_usage/"))?.[1];
    expect(budget?.characters).toBe(5);
  });
  it("updates the source identity without rebilling unchanged text when another published field changes", async () => {
    const a = await translatePublicContent(request());
    memory.fields = { title: "공지 제목", content: "수정 내용", "aiSummary.summary": "변경" };
    const b = await translatePublicContent(request());
    expect(b.sourceHash).not.toEqual(a.sourceHash);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects fields outside the published projection before provider call", async () => {
    await expect(translatePublicContent({ ...request(), fields: ["author", "__proto__", "token"] })).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("enforces per-request and persistent daily character budgets", async () => {
    memory.fields.title = "가".repeat(6001);
    await expect(translatePublicContent(request())).rejects.toMatchObject({ status: 413 });expect(fetch).not.toHaveBeenCalled();
    memory.fields.title = "안녕하세요";vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS", "4");
    await expect(translatePublicContent(request())).rejects.toMatchObject({ status: 429, code: "TRANSLATION_DAILY_LIMIT" });expect(fetch).not.toHaveBeenCalled();
    expect(fieldCaches()).toHaveLength(0);
  });
  it("keeps reservations after provider failure and sanitizes secret/diagnostic errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("secret-key test-key upstream details"));
    await expect(translatePublicContent(request())).rejects.toMatchObject({ status: 503, code: "TRANSLATION_FAILED" });
    const budget = [...memory.documents.entries()].find(([key]) => key.startsWith("public_content_translation_usage/"))?.[1];expect(budget?.characters).toBe(5);
    expect(fieldCaches()).toHaveLength(0);
    await expect(translatePublicContent(request())).resolves.toMatchObject({ translations: { title: "Notice & title" } });
  });
  it("does not cache malformed provider output or non-success responses", async () => {
    for (const response of [Response.json({ data: { translations: [] } }), Response.json({ data: { translations: [{ translatedText: "" }] } }), Response.json({ data: { translations: [{ translatedText: "&#32;" }] } }), new Response("provider secret", { status: 403 })]) {
      vi.mocked(fetch).mockResolvedValueOnce(response);
      await expect(translatePublicContent(request())).rejects.toMatchObject({ status: 503, code: "TRANSLATION_FAILED" });
    }
    expect(fieldCaches()).toHaveLength(0);
  });
  it("preserves reordered credits, dates and room numbers through protected placeholders", async () => {
    memory.fields.title = "2026년 11월 12일 3.5학점 다니엘관207호";
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      const sent=JSON.parse(options!.body as string).q[0] as string;
      expect(sent).not.toContain("2026");expect(sent).not.toContain("3.5");
      const tokens=sent.match(/__SYUN[a-f0-9]+X\d+__/g)!;
      return Response.json({ data:{ translations:[{translatedText:`Room ${tokens[4]}, ${tokens[3]} credits on ${tokens[1]}/${tokens[2]}/${tokens[0]}`}] } });
    });
    const result=await translatePublicContent(request());
    expect(result.translations.title).toBe("Room 207, 3.5 credits on 11/12/2026");
  });
  it("rejects dropped, altered, duplicated placeholders and invented numbers", async () => {
    memory.fields.title="3학점";
    for(const change of ["drop","alter","duplicate","invent"]){
      vi.mocked(fetch).mockImplementationOnce(async (_url,options)=>{
        const sent=JSON.parse(options!.body as string).q[0] as string;
        const token=sent.match(/__SYUN[a-f0-9]+X\d+__/)![0];
        const text=change==="drop"?"credits":change==="alter"?"4 credits":change==="duplicate"?`${token} ${token} credits`:`${token} credits, 4 classes`;
        return Response.json({data:{translations:[{translatedText:text}]}});
      });
      await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});
    }
  });
  it("does not send numeric/date-only fields to Google or bill them", async () => {
    memory.fields={title:"2026-11-12 18:00"};
    const result=await translatePublicContent(request());expect(result.translations.title).toBe("2026-11-12 18:00");expect(fetch).not.toHaveBeenCalled();
    expect(memory.documents.size).toBe(0);
  });
  it("re-fetches an expired cache record even when Firestore TTL deletion has not run", async () => {
    await translatePublicContent(request());
    const cache=fieldCaches()[0];
    cache[1].expiresAt=Date.now()-1;
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("fails closed before provider calls when cache reads or daily-budget configuration fail", async () => {
    memory.failRead=true;await expect(translatePublicContent(request())).rejects.toThrow("Cache unavailable");expect(fetch).not.toHaveBeenCalled();
    memory.failRead=false;vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS","not-a-limit");
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_UNAVAILABLE"});expect(fetch).not.toHaveBeenCalled();
  });
  it("retains the charged reservation if provider succeeds but cache commit fails", async () => {
    memory.failCacheWrite=true;await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([...memory.documents.entries()].find(([key])=>key.startsWith("public_content_translation_usage/"))?.[1].characters).toBe(5);
  });
  it("bounds oversized provider bodies before decoding or caching", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}",{headers:{"content-length":String(256*1024+1)}}));
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});
    expect(fieldCaches()).toHaveLength(0);
  });
  it("uses the persistent lease across module instances to avoid simultaneous duplicate provider costs", async () => {
    let begin!:()=>void, finish!:(value:Response)=>void;
    const called=new Promise<void>(resolve=>{begin=resolve;});
    vi.mocked(fetch).mockImplementationOnce(async()=>{begin();return new Promise<Response>(resolve=>{finish=resolve;});});
    const first=translatePublicContent(request());await called;
    vi.resetModules();const other=await import("./content-translation");
    await expect(other.translatePublicContent({...request(),source:{...request().source,id:"another-source"}})).rejects.toMatchObject({status:429,code:"TRANSLATION_BUSY"});expect(fetch).toHaveBeenCalledTimes(1);
    finish(provider());await first;
    expect((await other.translatePublicContent(request())).translations.title).toBe("Notice & title");expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("ignores malformed cache values and wrong-version records", async () => {
    await translatePublicContent(request());
    let cache=fieldCaches()[0];
    cache[1].translation="x".repeat(30001);
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(2);
    cache=fieldCaches()[0];cache[1].version="unprotected-old";
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("keeps the shared daily budget closed until the UTC day changes", async () => {
    vi.useFakeTimers();vi.setSystemTime("2026-10-26T23:59:59Z");vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS","5");
    await translatePublicContent(request());memory.fields.title="다른 제목";
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:429,code:"TRANSLATION_DAILY_LIMIT"});
    vi.setSystemTime("2026-10-27T00:00:00Z");
    await expect(translatePublicContent(request())).resolves.toMatchObject({target:"en"});
    expect([...memory.documents.keys()].filter(key=>key.startsWith("public_content_translation_usage/"))).toHaveLength(2);
  });
  it("sends only Hangul text and retains English, numbers, symbols and other scripts verbatim", async () => {
    memory.fields={title:"공지 제목",english:"Library Room 207 & hours",numeric:"2026-11-12 18:00",symbols:"— / +",other:"学生"};
    const result=await translatePublicContent({...request(),fields:Object.keys(memory.fields)});
    expect(result.translations).toEqual({...memory.fields,title:"Notice & title"});
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).q).toEqual(["공지 제목"]);
    expect([...memory.documents.entries()].find(([key])=>key.startsWith("public_content_translation_usage/"))?.[1].characters).toBe(5);
    expect(fieldCaches()).toHaveLength(1);
    vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS","0");
    await expect(translatePublicContent({...request(),fields:["english"]})).resolves.toMatchObject({translations:{english:memory.fields.english}});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("deduplicates identical text within a request and shares the cache across sources and field sets", async () => {
    memory.fields={title:"공지 제목",content:"공지 제목",label:"공지 제목"};
    const first=await translatePublicContent({...request(),fields:["title","content"]});
    expect(first.translations).toEqual({title:"Notice & title",content:"Notice & title"});
    const other={...request(),source:{...request().source,id:"academic-2"},fields:["label"]};
    expect((await translatePublicContent(other)).translations.label).toBe("Notice & title");
    expect(fetch).toHaveBeenCalledTimes(1);expect(fieldCaches()).toHaveLength(1);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).q).toEqual(["공지 제목"]);
  });
  it("coalesces concurrent overlapping field sets without returning a busy error", async () => {
    memory.fields={title:"공지 제목",content:"공지 제목"};
    const [a,b]=await Promise.all([translatePublicContent(request()),translatePublicContent({...request(),fields:["content"],source:{...request().source,id:"another"}})]);
    expect(a.translations.title).toBe(b.translations.content);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("recognizes Hangul jamo as Korean while retaining non-Hangul labels", async () => {
    memory.fields={title:"\u3131",label:"\uffa1",english:"AI"};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({data:{translations:[{translatedText:"g"},{translatedText:"g"}]}}));
    const result=await translatePublicContent({...request(),fields:["title","label","english"]});
    expect(result.translations).toEqual({title:"g",label:"g",english:"AI"});
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).q).toEqual(["\u3131","\uffa1"]);
  });
  it("promotes a valid legacy request cache without extending expiry or charging again", async () => {
    const req=request(), sourceHash=hash(JSON.stringify(Object.entries(memory.fields).sort(([a],[b])=>a.localeCompare(b,"en"))));
    const cacheKey=hash(JSON.stringify(["google-v2-nmt-ko-en-numbers-2",req.source,sourceHash,req.fields]));
    const expiresAt=Date.now()+60_000;
    memory.documents.set(`public_content_translations/${cacheKey}`,{translations:{title:"Reviewed title"},sourceHash,version:"google-v2-nmt-ko-en-numbers-2",expiresAt});
    expect((await translatePublicContent(req)).translations.title).toBe("Reviewed title");
    expect(fieldCaches()[0][1].expiresAt).toBe(expiresAt);
    memory.fields.content=memory.fields.title;
    expect((await translatePublicContent({...req,fields:["content"]})).translations.content).toBe("Reviewed title");
    expect(fetch).not.toHaveBeenCalled();expect([...memory.documents.keys()].some(key=>key.startsWith("public_content_translation_usage/"))).toBe(false);
  });
  it("does not reuse a field cache with mismatched source text or malformed output", async () => {
    await translatePublicContent(request());
    fieldCaches()[0][1].sourceHash="different-original";
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(2);
    fieldCaches()[0][1].translation=" ";
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(3);
    memory.fields.title="다른 공지";
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(4);expect(fieldCaches()).toHaveLength(2);
  });
  it("still checks each public source before reusing identical cached text", async () => {
    await translatePublicContent(request());
    vi.mocked(resolvePublicTranslationSource).mockRejectedValueOnce(new Error("not public"));
    await expect(translatePublicContent({...request(),source:{...request().source,id:"private-id"}})).rejects.toThrow("not public");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("only sends and reserves newly missing text when a request mixes cached and uncached fields", async () => {
    await translatePublicContent(request());
    await translatePublicContent({...request(),fields:["title","content"]});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).q).toEqual(["내용"]);
    expect([...memory.documents.entries()].find(([key])=>key.startsWith("public_content_translation_usage/"))?.[1].characters).toBe(7);
  });
  it("keeps a shared daily limit across simultaneous different public requests", async () => {
    memory.fields={title:"공지 제목",content:"다른 제목"};vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS","5");
    const results=await Promise.allSettled([translatePublicContent(request()),translatePublicContent({...request(),fields:["content"]})]);
    expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    expect(results.find(result=>result.status==="rejected")).toMatchObject({reason:{status:429,code:"TRANSLATION_DAILY_LIMIT"}});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([...memory.documents.entries()].find(([key])=>key.startsWith("public_content_translation_usage/"))?.[1].characters).toBe(5);
  });
  it("does not overwrite or delete a lease acquired by another worker after provider execution", async () => {
    vi.mocked(fetch).mockImplementationOnce(async()=>{
      const cache=fieldCaches()[0];cache[1].token="new-owner";cache[1].pendingUntil=Date.now()+120_000;
      return provider();
    });
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});
    expect(fieldCaches()[0][1].token).toBe("new-owner");expect(fieldCaches()[0][1].translation).toBeUndefined();
  });
  it("honors an in-progress legacy lease while older server instances finish their work", async () => {
    const req=request(), sourceHash=hash(JSON.stringify(Object.entries(memory.fields).sort(([a],[b])=>a.localeCompare(b,"en"))));
    const cacheKey=hash(JSON.stringify(["google-v2-nmt-ko-en-numbers-2",req.source,sourceHash,req.fields]));
    memory.documents.set(`public_content_translations/${cacheKey}`,{sourceHash,version:"google-v2-nmt-ko-en-numbers-2",pendingUntil:Date.now()+120_000,token:"older-worker"});
    await expect(translatePublicContent(req)).rejects.toMatchObject({status:429,code:"TRANSLATION_BUSY"});
    expect(fetch).not.toHaveBeenCalled();expect(fieldCaches()).toHaveLength(0);
  });
});
