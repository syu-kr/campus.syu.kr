// vercel.json의 rewrites가 이 경로를 외부 API로 직접 프록시합니다.
// 이 파일은 TypeScript 타입 체크용으로만 존재합니다.

export const runtime = "nodejs";

export async function POST() {
  return new Response(JSON.stringify({ error: "Proxied by vercel.json" }), {
    status: 405,
  });
}

export async function GET() {
  return new Response(JSON.stringify({ error: "Proxied by vercel.json" }), {
    status: 405,
  });
}
