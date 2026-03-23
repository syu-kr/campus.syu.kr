export const runtime = "nodejs";
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

async function fetchBusData() {
  try {
    console.log("[API] Fetching from nexmotion...");
    const response = await fetch(
      "http://nexmotion.co.kr/bus/busStatusList.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`[API] Status: ${response.status}`);

    const data = await response.json();
    console.log("[API] Got data:", data);

    // returnCode === "200" 체크
    if (data && data.returnCode === "200" && Array.isArray(data.data)) {
      console.log(`[API] Success with ${data.data.length} items`);
      return data;
    }

    console.log("[API] Invalid response format");
    return data || { data: [] };
  } catch (error) {
    console.error("[API] Fetch error:", error);
    return { data: [] };
  }
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
