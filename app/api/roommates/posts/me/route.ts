import { enforceRoommateReadLimit, requireRoommateSession, roommateErrorResponse, roommateResponse } from "@/lib/server/roommate-auth";
import { getMyRoommatePost } from "@/lib/server/roommate-posts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireRoommateSession(req);
    await enforceRoommateReadLimit(req, session.ownerKey);
    return roommateResponse(await getMyRoommatePost(session.ownerKey));
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
