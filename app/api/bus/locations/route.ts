export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    const response = await fetch(
      "http://nexmotion.co.kr/bus/busStatusList.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    return Response.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return Response.json(
      { data: [], error: String(error) },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(
      "http://nexmotion.co.kr/bus/busStatusList.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    return Response.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return Response.json(
      { data: [], error: String(error) },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
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
