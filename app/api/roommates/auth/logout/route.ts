import { enforceRoommateOrigin, revokeRoommateSession, clearRoommateSessionCookie, roommateResponse, roommateErrorResponse } from "@/lib/server/roommate-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    enforceRoommateOrigin(req);
    await revokeRoommateSession(req);
    const response = roommateResponse({ loggedOut: true });
    clearRoommateSessionCookie(response);
    return response;
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
