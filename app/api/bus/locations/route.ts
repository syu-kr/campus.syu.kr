export const runtime = "nodejs";

export async function POST() {
  try {
    const response = await fetch("http://nexmotion.co.kr/bus/busStatusList.php", {
      method: "POST",
      timeout: 10000,
    });

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
  }
}
