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
  it("preserves reordered credits, dates and room numbers through visible protected spans", async () => {
    memory.fields.title = "2026학년도, 11월, 12일, 3.5학점 다니엘관207호";
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      const payload=JSON.parse(options!.body as string),sent=payload.q[0] as string;
      expect(payload.format).toBe("html");expect(sent).toContain(">2026</span>");expect(sent).toContain(">3.5</span>");
      const tokens=sent.match(/<span translate="no" class="notranslate" id="SYUN[a-f0-9]+X\d+">[^<]+<\/span>/g)!;
      return Response.json({ data:{ translations:[{translatedText: `Room ${tokens[4]}, ${tokens[3]} credits on ${tokens[1]}/${tokens[2]}/${tokens[0]}`}] } });
    });
    const result=await translatePublicContent(request());
    expect(result.translations.title).toBe("Room 207, 3.5 credits on 11/12/2026");
  });
  it("rejects dropped, altered, duplicated protected spans, invented numbers and markup", async () => {
    memory.fields.title="3학점";
    for(const change of ["drop","alter","duplicate","invent","encoded","markup"]){
      vi.mocked(fetch).mockImplementationOnce(async (_url,options)=>{
        const sent=JSON.parse(options!.body as string).q[0] as string;
        const token=sent.match(/<span[^>]*>3<\/span>/)![0];
        const text=change==="drop"?"credits":change==="alter"?token.replace(">3<",">4<"):change==="duplicate"?token+token:change==="invent"?token+" credits, 4 classes":change==="encoded"?token+" credits, &#x34; classes":token+"<script>bad()</script>";
        return Response.json({data:{translations:[{translatedText:text}]}});
      });
      await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});
    }
  });
  it("keeps installment numbers visible and still rejects the production invented ordinal", async () => {
    memory.fields.title="등록 2026-2학기 등록금 분납3차 납부 안내";
    const reply=(invented:boolean)=>async(_url:unknown,options?:RequestInit)=>{
      const sent=JSON.parse(options!.body as string).q[0] as string,tokens=sent.match(/<span[^>]*>[^<]+<\/span>/g)!;
      expect(tokens[0]).toContain(">2026-2</span>");expect(tokens[1]).toContain(">3</span>");
      return Response.json({data:{translations:[{translatedText:"Registration "+tokens[0]+" semester tuition "+tokens[1]+(invented?"1st":"rd")+" installment payment guide"}]}});
    };
    vi.mocked(fetch).mockImplementationOnce(reply(true));
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});expect(fieldCaches()).toHaveLength(0);
    vi.mocked(fetch).mockImplementationOnce(reply(false));
    expect((await translatePublicContent(request())).translations.title).toBe("Registration 2026-2 semester tuition 3rd installment payment guide");
  });
  it("escapes literal source markup and decodes it once as plain text", async () => {
    memory.fields.title="공지 <script>3</script> & &#52;";
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const sent=JSON.parse(options!.body as string).q[0] as string;
      expect(sent).toContain("&lt;script&gt;");expect(sent).toContain("&amp; &amp;#");expect(sent).not.toContain("<script>");
      return Response.json({data:{translations:[{translatedText:sent.replace("공지","Notice")}]}});
    });
    expect((await translatePublicContent(request())).translations.title).toBe("Notice <script>3</script> & &#52;");
  });
  it("keeps duplicate numeric values distinct while reusing caches without numbers", async () => {
    await translatePublicContent(request());
    const originalCache=fieldCaches()[0];expect(originalCache[1].version).toBe("google-v2-nmt-ko-en-numbers-2");
    memory.fields.content="3학점 3과목";
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const sent=JSON.parse(options!.body as string).q[0] as string,tokens=sent.match(/<span[^>]*>3<\/span>/g)!;expect(tokens).toHaveLength(2);expect(tokens[0]).not.toBe(tokens[1]);
      return Response.json({data:{translations:[{translatedText:tokens[1]+" courses for "+tokens[0]+" credits"}]}});
    });
    const result=await translatePublicContent({...request(),fields:["title","content"]});expect(result.translations).toEqual({title:"Notice & title",content:"3 courses for 3 credits"});
    expect(fieldCaches().find(([,value])=>value.version==="google-v2-nmt-ko-en-html-numbers-4")).toBeDefined();
    await translatePublicContent(request());expect(fetch).toHaveBeenCalledTimes(2);expect(fieldCaches().find(([id])=>id===originalCache[0])?.[1]).toEqual(originalCache[1]);
  });
  it("keeps Korean calendar dates readable without changing their numeric values", async () => {
    memory.fields.title="2026년 11월 3일, 10월 28일~11월 3일 납부";
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const sent=JSON.parse(options!.body as string).q[0] as string,tokens=sent.match(/<span[^>]*>[^<]+<\/span>/g)!;
      expect(tokens.map(token=>token.match(/>([^<]+)</)![1])).toEqual(["2026/11/3","10/28~11/3"]);
      return Response.json({data:{translations:[{translatedText:tokens[0]+", pay during "+tokens[1]}]}});
    });
    expect((await translatePublicContent(request())).translations.title).toBe("2026/11/3, pay during 10/28~11/3");
  });
  it("decodes ordinary apostrophes before rejecting newly introduced numeric data", async () => {
    for(const title of ["학생의 공지", "3학점 학생의 공지"]){
      memory.fields.title=title;
      vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
        const sent=JSON.parse(options!.body as string).q[0] as string,token=sent.match(/<span[^>]*>3<\/span>/)?.[0]??"";
        return Response.json({data:{translations:[{translatedText:token+" Students&#39; notice &#x27;quoted&#x27;"}]}});
      });
      expect((await translatePublicContent(request())).translations.title).toBe((title.startsWith("3")?"3":"")+" Students' notice 'quoted'");
    }
  });
  it("ignores legacy numeric translations while preserving the old documents", async () => {
    memory.fields.title="분납3차";const req=request(),sourceHash=hash(JSON.stringify(Object.entries(memory.fields).sort(([a],[b])=>a.localeCompare(b,"en"))));
    const legacyVersion="google-v2-nmt-ko-en-numbers-2",expiresAt=Date.now()+60_000;
    const requestKey=hash(JSON.stringify([legacyVersion,req.source,sourceHash,req.fields])),oldFieldKey=hash(JSON.stringify([legacyVersion,"en",memory.fields.title]));
    memory.documents.set("public_content_translations/"+requestKey,{translations:{title:"3Car Payment"},sourceHash,version:legacyVersion,expiresAt});
    memory.documents.set("public_content_translation_fields/"+oldFieldKey,{translation:"3Car Payment",sourceHash:hash(memory.fields.title),version:legacyVersion,expiresAt});
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const token=(JSON.parse(options!.body as string).q[0] as string).match(/<span[^>]*>3<\/span>/)![0];return Response.json({data:{translations:[{translatedText:token+"rd installment"}]}});
    });
    expect((await translatePublicContent(req)).translations.title).toBe("3rd installment");expect(fetch).toHaveBeenCalledTimes(1);
    expect(memory.documents.get("public_content_translation_fields/"+oldFieldKey)?.translation).toBe("3Car Payment");
  });
  it("rejects expanded protected input before reserving budget and clears its cache lease", async () => {
    memory.fields.title="1가".repeat(200);
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:413,code:"TRANSLATION_TOO_LARGE"});expect(fetch).not.toHaveBeenCalled();expect(fieldCaches()).toHaveLength(0);
    expect([...memory.documents.keys()].some(key=>key.startsWith("public_content_translation_usage/"))).toBe(false);
  });
  it("retries only rejected numeric fields once using budgeted opaque protection", async () => {
    memory.fields={title:"2026.10.27 공지",content:"3학점"};
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const payload=JSON.parse(options!.body as string);expect(payload.format).toBe("html");
      return Response.json({data:{translations:payload.q.map((sent:string)=>({translatedText:sent.includes(">2026.10.27<")?"October 27 "+sent.match(/<span[^>]*>[^<]+<\/span>/)![0]:sent.match(/<span[^>]*>3<\/span>/)![0]+" credits"}))}});
    }).mockImplementationOnce(async(_url,options)=>{
      const payload=JSON.parse(options!.body as string);expect(payload.format).toBe("text");expect(payload.q).toHaveLength(1);
      const token=payload.q[0].match(/__SYUN[a-f0-9]+X\d+__/)[0];return Response.json({data:{translations:[{translatedText:"Notice on "+token}]}});
    });
    const result=await translatePublicContent({...request(),fields:["title","content"]});expect(result.translations).toEqual({title:"Notice on 2026.10.27",content:"3 credits"});expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][1]!.signal).toBe(vi.mocked(fetch).mock.calls[0][1]!.signal);
    const reserved=vi.mocked(fetch).mock.calls.reduce((total,[,options])=>total+JSON.parse(options!.body as string).q.reduce((n:number,value:string)=>n+[...value].length,0),0);
    expect([...memory.documents.entries()].find(([key])=>key.startsWith("public_content_translation_usage/"))?.[1].characters).toBe(reserved);
    await translatePublicContent({...request(),fields:["title","content"]});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not let a fallback bypass the daily reservation limit", async () => {
    memory.fields.title="3학점";
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const payload=JSON.parse(options!.body as string);vi.stubEnv("CONTENT_TRANSLATION_DAILY_CHARACTERS",String([...payload.q[0]].length));
      const token=payload.q[0].match(/<span[^>]*>3<\/span>/)[0];return Response.json({data:{translations:[{translatedText:token+" credits 1st"}]}});
    });
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:429,code:"TRANSLATION_DAILY_LIMIT"});expect(fetch).toHaveBeenCalledTimes(1);expect(fieldCaches()).toHaveLength(0);
  });
  it("never decodes a numeric entity assembled around a protected value", async () => {
    for(const fallback of [false,true]){
      memory.documents.clear();memory.fields.title="공지 &#52;";
      vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
        const token=(JSON.parse(options!.body as string).q[0] as string).match(/<span[^>]*>52<\/span>/)![0];
        return Response.json({data:{translations:[{translatedText:fallback?token+" notice 1st":"Notice &#"+token+";"}]}});
      });
      if(fallback)vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
        const token=(JSON.parse(options!.body as string).q[0] as string).match(/__SYUN[a-f0-9]+X\d+__/)![0];return Response.json({data:{translations:[{translatedText:"Notice &#"+token+";"}]}});
      });
      expect((await translatePublicContent(request())).translations.title).toBe("Notice &#52;");
    }
  });
  it("rejects extra digits in entity fragments without decoding across removed tokens", async () => {
    memory.fields.title="3학점";
    vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
      const token=(JSON.parse(options!.body as string).q[0] as string).match(/<span[^>]*>3<\/span>/)![0];return Response.json({data:{translations:[{translatedText:"&#x"+token+"1; credits"}]}});
    }).mockImplementationOnce(async(_url,options)=>{
      const token=(JSON.parse(options!.body as string).q[0] as string).match(/__SYUN[a-f0-9]+X\d+__/)![0];return Response.json({data:{translations:[{translatedText:"&#x"+token+"1; credits"}]}});
    });
    await expect(translatePublicContent(request())).rejects.toMatchObject({status:503,code:"TRANSLATION_FAILED"});expect(fetch).toHaveBeenCalledTimes(2);expect(fieldCaches()).toHaveLength(0);
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
