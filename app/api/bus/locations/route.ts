export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    // Vercel에서는 https:// 사용
    const apiUrl = process.env.VERCEL
      ? "https://nexmotion.co.kr/bus/busStatusList.php"
      : "http://nexmotion.co.kr/bus/busStatusList.php";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[API Route] Failed: ${response.status}`);
      return Response.json(
        { data: [], error: `HTTP ${response.status}` },
        { status: 200 },
      );
    }

    const data = await response.json();

    // CORS 헤더 추가
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("[API Route] Error:", error);
    return Response.json(
      { data: [], error: "Failed to fetch bus data" },
      { status: 200 },
    );
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
