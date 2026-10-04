import { enforceRoommateOrigin, requireRoommatesEnabled, requireRoommateSession, issueRoommateSession, setRoommateSessionCookie, roommateResponse, roommateErrorResponse } from "@/lib/server/roommate-auth";
import { readJsonBody, enforceRateLimitKey } from "@/lib/server/http";
import { getRateLimitKey } from "@/lib/rate-limit";
import { RoommateError } from "@/lib/roommates";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await requireRoommateSession(req);
    await enforceRateLimitKey(getRateLimitKey(req, "roommates:session:read"), { limit: 120, windowMs: 60_000 });
    return roommateResponse({ expiresAt: session.expiresAt, sessionTag: session.sessionTag });
  } catch (error) {
    return roommateErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    enforceRoommateOrigin(req);
    requireRoommatesEnabled();
    const body = await readJsonBody<Record<string, unknown>>(req, 20_000);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["idToken", "remember"].includes(key))) {
      throw new RoommateError(400, "INVALID_AUTH_REQUEST", "인증 요청이 올바르지 않습니다.");
    }
    await enforceRateLimitKey(getRateLimitKey(req, "roommates:session:issue"), { limit: 60, windowMs: 60_000 });
    const session = await issueRoommateSession(body.idToken, body.remember);
    const response = roommateResponse({ expiresAt: session.expiresAt, sessionTag: session.sessionTag });
    setRoommateSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
