import { requestRoommateEmailLink, enforceRoommateOrigin, roommateResponse, roommateErrorResponse } from "@/lib/server/roommate-auth";
import { readJsonBody } from "@/lib/server/http";
import { RoommateError } from "@/lib/roommates";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    enforceRoommateOrigin(req);
    const body = await readJsonBody<Record<string, unknown>>(req, 2048);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["email", "locale"].includes(key))) {
      throw new RoommateError(400, "INVALID_AUTH_REQUEST", "인증 요청이 올바르지 않습니다.");
    }
    await requestRoommateEmailLink(req, body.email, body.locale);
    return roommateResponse({ sent: true });
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
