export const runtime = "nodejs";
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

async function fetchBusData() {
  // Vercel에서는 HTTPS를 먼저 시도, 로컬에서는 HTTP 사용
  const urls = process.env.VERCEL
    ? [
        "https://nexmotion.co.kr/bus/busStatusList.php",
        "http://nexmotion.co.kr/bus/busStatusList.php",
      ]
    : [
        "http://nexmotion.co.kr/bus/busStatusList.php",
        "https://nexmotion.co.kr/bus/busStatusList.php",
      ];

  for (const url of urls) {
    try {
      console.log(`[API] Trying ${url}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[API] Response from ${url}: ${response.status}`);

      if (response.ok) {
        const text = await response.text();
        console.log(`[API] Response length: ${text.length}`);

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error(`[API] JSON parse error from ${url}:`, e);
          continue;
        }

        console.log(`[API] ✅ Success from ${url}`);
        return data;
      }
      console.warn(`[API] Not OK from ${url}: ${response.status}`);
    } catch (error) {
      console.error(
        `[API] Failed to fetch from ${url}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.error("[API] ❌ All URLs failed");
  return { data: [] };
}

export async function POST() {
  const data = await fetchBusData();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET() {
  const data = await fetchBusData();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
