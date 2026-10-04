import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { readJsonBody } from "@/lib/server/http";
import { getFirestore } from "@/lib/server/firestore";
import { adminRoommateError, adminRoommateJson, listAdminReports, mutateAdminReport, readAdminReportMutation } from "@/lib/server/roommate-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return adminRoommateJson(await listAdminReports(getFirestore(), req.nextUrl.searchParams));
  } catch (error) { return adminRoommateError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = await requireAdmin(req);
    const input = readAdminReportMutation(await readJsonBody(req, 4096));
    await mutateAdminReport(getFirestore(), identity, input);
    return adminRoommateJson({ success: true });
  } catch (error) { return adminRoommateError(error); }
}
