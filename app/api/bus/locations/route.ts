export const runtime = "nodejs";

export async function POST() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      "http://nexmotion.co.kr/bus/busStatusList.php",
      {
        method: "POST",
        signal: controller.signal,
      },
    );

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Bus API error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch bus data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
