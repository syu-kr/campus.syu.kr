import { parseRoommateFilters } from "@/lib/roommates";
import { readJsonBody } from "@/lib/server/http";
import { enforceRoommateOrigin, enforceRoommateReadLimit, requireRoommateSession, requireRoommateWritesEnabled, roommateErrorResponse, roommateResponse } from "@/lib/server/roommate-auth";
import { createRoommatePost, listRoommatePosts } from "@/lib/server/roommate-posts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireRoommateSession(req);
    await enforceRoommateReadLimit(req, session.ownerKey);
    const params = new URL(req.url).searchParams;
    return roommateResponse(await listRoommatePosts(parseRoommateFilters(params), params.get("cursor")));
  } catch (error) {
    return roommateErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRoommateSession(req);
    enforceRoommateOrigin(req);
    requireRoommateWritesEnabled();
    const post = await createRoommatePost(session.ownerKey, await readJsonBody(req, 8 * 1024));
    return roommateResponse({ post }, 201);
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
