export const runtime = "nodejs";

// 캐시 설정 (10초)
export const revalidate = 10;

export async function POST(request: Request) {
  try {
    // 외부 API 호출 (서버에서 CORS 문제 없음)
    const response = await fetch(
      "http://nexmotion.co.kr/bus/busStatusList.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      console.error(`[API Route] Failed: ${response.status}`);
      return Response.json(
        { error: "Failed to fetch bus locations" },
        { status: response.status },
      );
    }

    const data = await response.json();

    // CORS 헤더 추가
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
      },
    });
  } catch (error) {
    console.error("[API Route] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
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
