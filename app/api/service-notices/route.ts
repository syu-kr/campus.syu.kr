import { getAllServiceNotices } from "@/lib/serviceNotices";

export async function GET() {
  try {
    const serviceNotices = await getAllServiceNotices();
    return Response.json(serviceNotices);
  } catch (error) {
    console.error("Failed to fetch service notices:", error);
    return Response.json([], { status: 200 });
  }
}
