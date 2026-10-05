import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { readJsonBody } from "@/lib/server/http";
import { getFirestore } from "@/lib/server/firestore";
import { adminRoommateError, adminRoommateJson, listAdminPosts, mutateAdminPost, readAdminPostMutation } from "@/lib/server/roommate-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return adminRoommateJson(await listAdminPosts(getFirestore(), req.nextUrl.searchParams));
  } catch (error) { return adminRoommateError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = await requireAdmin(req);
    const input = readAdminPostMutation(await readJsonBody(req, 4096));
    await mutateAdminPost(getFirestore(), identity, input);
    return adminRoommateJson({ success: true });
  } catch (error) { return adminRoommateError(error); }
}
