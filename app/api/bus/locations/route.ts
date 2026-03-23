export const runtime = "nodejs";
export const maxDuration = 30;

async function fetchBusData() {
  const urls = [
    "http://nexmotion.co.kr/bus/busStatusList.php",
    "https://nexmotion.co.kr/bus/busStatusList.php",
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log(`[API] Success from ${url}:`, data);
        return data;
      }
      console.warn(`[API] Failed from ${url}: ${response.status}`);
    } catch (error) {
      console.warn(`[API] Error with ${url}:`, String(error));
    }
  }

  return { data: [] };
}

export async function GET() {
  const data = await fetchBusData();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function POST() {
  const data = await fetchBusData();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
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
