import { readJsonBody } from "@/lib/server/http";
import { enforceRoommateOrigin, requireRoommateSession, roommateErrorResponse, roommateResponse } from "@/lib/server/roommate-auth";
import { reportRoommatePost } from "@/lib/server/roommate-posts";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ postId: string }> };

export async function POST(req: Request, context: Context) {
  try {
    const session = await requireRoommateSession(req);
    enforceRoommateOrigin(req);
    const { postId } = await context.params;
    await reportRoommatePost(session.ownerKey, postId, await readJsonBody(req, 4 * 1024));
    return roommateResponse({ success: true }, 201);
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
