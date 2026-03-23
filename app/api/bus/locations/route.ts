// This route is not used - requests are proxied via vercel.json
export const runtime = "nodejs";

export async function POST() {
  return new Response(
    JSON.stringify({ error: "This endpoint is proxied - see vercel.json" }),
    { status: 404 },
  );
}
