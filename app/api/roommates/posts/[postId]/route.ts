import { RoommateError, roommateObject } from "@/lib/roommates";
import { readJsonBody } from "@/lib/server/http";
import { enforceRoommateOrigin, enforceRoommateReadLimit, requireRoommateSession, requireRoommateWritesEnabled, roommateErrorResponse, roommateResponse } from "@/lib/server/roommate-auth";
import { getRoommatePost, mutateRoommatePost } from "@/lib/server/roommate-posts";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ postId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const session = await requireRoommateSession(req);
    await enforceRoommateReadLimit(req, session.ownerKey);
    const { postId } = await context.params;
    return roommateResponse({ post: await getRoommatePost(postId, session.ownerKey) });
  } catch (error) {
    return roommateErrorResponse(error);
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const session = await requireRoommateSession(req);
    enforceRoommateOrigin(req);
    const body = roommateObject(await readJsonBody(req, 8 * 1024));
    if (body.action !== "update" && body.action !== "complete") throw new RoommateError(400, "INVALID_ACTION", "요청 동작을 확인해주세요.", "action");
    if (body.action === "update") requireRoommateWritesEnabled();
    const { postId } = await context.params;
    return roommateResponse({ post: await mutateRoommatePost(session.ownerKey, postId, body.action, body) });
  } catch (error) {
    return roommateErrorResponse(error);
  }
}

export async function DELETE(req: Request, context: Context) {
  try {
    const session = await requireRoommateSession(req);
    enforceRoommateOrigin(req);
    const body = await readJsonBody(req, 1024);
    const { postId } = await context.params;
    return roommateResponse({ post: await mutateRoommatePost(session.ownerKey, postId, "delete", body) });
  } catch (error) {
    return roommateErrorResponse(error);
  }
}
