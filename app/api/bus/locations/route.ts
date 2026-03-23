export const runtime = "nodejs";
export const maxDuration = 30;

async function fetchBusData() {
  const urls = [
    "https://nexmotion.co.kr/bus/busStatusList.php",
    "http://nexmotion.co.kr/bus/busStatusList.php",
  ];

  for (const url of urls) {
    try {
      console.log(`[API] Trying ${url}...`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000), // 10초 타임아웃
      });

      console.log(`[API] Response from ${url}: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[API] Success from ${url}`);
        return data;
      }
    } catch (error) {
      console.error(`[API] Failed to fetch from ${url}:`, String(error));
    }
  }

  console.error("[API] All URLs failed");
  return { data: [] };
}

export async function POST() {
  const data = await fetchBusData();
  return Response.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    },
  });
}

export async function GET() {
  const data = await fetchBusData();
  return Response.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    },
  });
}

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
