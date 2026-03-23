export const runtime = "nodejs";

export async function POST() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Try HTTP first
    let response;
    try {
      response = await fetch(
        "http://nexmotion.co.kr/bus/busStatusList.php",
        {
          method: "POST",
          signal: controller.signal,
        },
      );
    } catch (httpError) {
      console.log("HTTP failed, trying HTTPS:", httpError);
      // Fallback to HTTPS
      response = await fetch(
        "https://nexmotion.co.kr/bus/busStatusList.php",
        {
          method: "POST",
          signal: controller.signal,
        },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Bus API error:", errorMessage, error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch bus data", details: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
