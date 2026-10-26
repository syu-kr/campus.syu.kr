// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server/content-translation", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/server/content-translation")>(),
  isContentTranslationConfigured: vi.fn(), translatePublicContent: vi.fn(),
}));
vi.mock("@/lib/server/http", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/server/http")>(), enforceRateLimit: vi.fn() }));
import { GET, POST } from "./route";
import { isContentTranslationConfigured, translatePublicContent } from "@/lib/server/content-translation";
import { ApiError, enforceRateLimit } from "@/lib/server/http";

const body = { source: { kind: "announcement", id: "a", category: "academic" }, fields: ["title"], target: "en" };
function req(value: unknown = body, origin = "https://syu-campus.com", contentType = "application/json") {
  return new Request("https://syu-campus.com/api/content-translation", { method: "POST", headers: { origin, "content-type": contentType }, body: JSON.stringify(value) });
}
beforeEach(() => { vi.mocked(isContentTranslationConfigured).mockReturnValue(true);vi.mocked(translatePublicContent).mockResolvedValue({ translations: { title: "Notice" }, originals: { title: "공지" }, sourceHash: "hash", target: "en", provider: "google" }); });
afterEach(() => vi.clearAllMocks());
describe("public translation API", () => {
  it("reports configuration availability without contacting the provider", async () => {
    vi.mocked(isContentTranslationConfigured).mockReturnValue(false);
    expect(await GET().json()).toEqual({ available: false, target: "en", provider: "google" });
    const response = await POST(req());expect(response.status).toBe(503);expect((await response.json()).code).toBe("TRANSLATION_UNAVAILABLE");
    expect(translatePublicContent).not.toHaveBeenCalled();expect(enforceRateLimit).not.toHaveBeenCalled();
  });
  it("rejects cross-origin, non-JSON, malformed and private requests", async () => {
    expect((await POST(req(body, "https://evil.test"))).status).toBe(403);
    expect((await POST(req(body, undefined, "text/plain"))).status).toBe(415);
    expect((await POST(req({ ...body, text: "private" }))).status).toBe(400);
    expect(translatePublicContent).not.toHaveBeenCalled();
  });
  it("limits before provider execution and returns public map only", async () => {
    const response = await POST(req());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ translations: { title: "Notice" } });
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "public-content-translation", { limit: 15, windowMs: 60000 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("preserves rate error code and hides unexpected diagnostic text", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new ApiError("rate secret", 429, undefined, "RATE_LIMITED"));
    let response = await POST(req());expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("60");expect((await response.json()).code).toBe("RATE_LIMITED");
    vi.mocked(translatePublicContent).mockRejectedValueOnce(new Error("private provider key"));
    response = await POST(req());expect(response.status).toBe(503);expect(await response.text()).not.toContain("private provider key");
  });
  it("validates every batch entry and the envelope before any rate or translation effects", async () => {
    for(const value of [
      {requests:[]},
      {requests:Array.from({length:13},()=>body)},
      {requests:[body,{...body,text:"private input"}]},
      {requests:[body,{...body,source:{kind:"roommate",id:"private"}}]},
      {requests:[body],target:"en"},
    ]){
      const response=await POST(req(value));expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_TRANSLATION_REQUEST");
    }
    expect(enforceRateLimit).not.toHaveBeenCalled();expect(translatePublicContent).not.toHaveBeenCalled();
  });
  it("returns aligned partial batch results while bounding concurrency to three", async () => {
    let active=0,maximum=0;
    vi.mocked(translatePublicContent).mockImplementation(async request=>{
      active++;maximum=Math.max(maximum,active);
      await new Promise(resolve=>setTimeout(resolve,request.source.id==="0"?20:1));
      active--;
      if(request.source.id==="1") throw new ApiError("private limit diagnostics",429,undefined,"TRANSLATION_DAILY_LIMIT");
      if(request.source.id==="3") throw new Error("private provider key");
      return {translations:{title:`Notice ${request.source.id}`},originals:{title:"공지"},sourceHash:request.source.id,target:"en",provider:"google"};
    });
    const response=await POST(req({requests:Array.from({length:12},(_,index)=>({...body,source:{...body.source,id:String(index)}}))}));
    expect(response.status).toBe(200);expect(maximum).toBe(3);expect(active).toBe(0);
    const result=await response.json();expect(result.results).toHaveLength(12);
    expect(result.results[0]).toMatchObject({ok:true,result:{sourceHash:"0"}});
    expect(result.results[1]).toEqual({ok:false,status:429,code:"TRANSLATION_DAILY_LIMIT"});
    expect(result.results[3]).toEqual({ok:false,status:503,code:"TRANSLATION_FAILED"});
    expect(result.results[11]).toMatchObject({ok:true,result:{sourceHash:"11"}});
    expect(JSON.stringify(result)).not.toMatch(/private|diagnostics/);
    expect(enforceRateLimit).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("keeps global rate/config failures outside the batch and bounds streamed JSON bytes", async () => {
    vi.mocked(isContentTranslationConfigured).mockReturnValue(false);
    expect((await POST(req({requests:[body]}))).status).toBe(503);
    expect(translatePublicContent).not.toHaveBeenCalled();
    vi.mocked(isContentTranslationConfigured).mockReturnValue(true);
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new ApiError("limit",429,undefined,"RATE_LIMITED"));
    const limited=await POST(req({requests:[body]}));expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({code:"RATE_LIMITED"});expect(translatePublicContent).not.toHaveBeenCalled();
    const oversized=new Request("https://syu-campus.com/api/content-translation",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requests:[body],padding:"x".repeat(128*1024)})});
    expect((await POST(oversized)).status).toBe(413);
    expect(enforceRateLimit).toHaveBeenCalledTimes(1);
  });
});
