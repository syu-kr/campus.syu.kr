import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJsonBody } from "@/lib/server/http";
import { isContentTranslationConfigured, parseTranslationRequest, translatePublicContent, type TranslationRequest, type TranslationResult } from "@/lib/server/content-translation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ available: isContentTranslationConfigured(), target: "en", provider: "google" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req, 128 * 1024);
    const batch = body !== null && typeof body === "object" && !Array.isArray(body) && "requests" in body;
    let requests: TranslationRequest[];
    if (batch) {
      if (Object.keys(body).length !== 1 || !Array.isArray(body.requests) || !body.requests.length || body.requests.length > 12) throw new ApiError("Invalid translation request.", 400, undefined, "INVALID_TRANSLATION_REQUEST");
      requests = body.requests.map(parseTranslationRequest);
    } else requests = [parseTranslationRequest(body)];
    if (!isContentTranslationConfigured()) throw new ApiError("Translation is not available yet.", 503, undefined, "TRANSLATION_UNAVAILABLE");
    await enforceRateLimit(req, "public-content-translation", { limit: 15, windowMs: 60_000 });
    if (!batch) return NextResponse.json(await translatePublicContent(requests[0]), { headers: { "Cache-Control": "no-store" } });
    const results: ({ ok: true; result: TranslationResult } | { ok: false; status: number; code: string })[] = new Array(requests.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, requests.length) }, async () => {
      for (let index = next++; index < requests.length; index = next++) {
        try { results[index] = { ok: true, result: await translatePublicContent(requests[index]) }; }
        catch (error) { results[index] = { ok: false, status: error instanceof ApiError ? error.status : 503, code: error instanceof ApiError ? error.code ?? "TRANSLATION_FAILED" : "TRANSLATION_FAILED" }; }
      }
    }));
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 503;
    const code = error instanceof ApiError ? error.code : "TRANSLATION_FAILED";
    return NextResponse.json({ code, error: "Translation is unavailable. Please read the original." }, {
      status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
    });
  }
}
