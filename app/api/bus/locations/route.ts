export const runtime = "nodejs";

export async function POST() {
  try {
    console.log(
      "[1] Attempting HTTP request to http://nexmotion.co.kr/bus/busStatusList.php",
    );

    const response = await fetch(
      "http://nexmotion.co.kr/bus/busStatusList.php",
      {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    console.log("[2] HTTP response status:", response.status);
    console.log(
      "[3] HTTP response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      const responseText = await response.text();
      console.error(
        "[!] Response not OK. Status:",
        response.status,
        "Body:",
        responseText,
      );
      return new Response(
        JSON.stringify({
          error: "API returned error",
          status: response.status,
          details: responseText,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const contentType = response.headers.get("content-type");
    console.log("[4] Content-Type:", contentType);

    let data;
    try {
      data = await response.json();
      console.log(
        "[5] ✓ Successfully parsed JSON, got",
        Array.isArray(data.data) ? data.data.length : "response",
      );
    } catch (parseError) {
      const responseText = await response.text();
      console.error("[!] Failed to parse JSON. Response text:", responseText);
      throw new Error(`Failed to parse JSON: ${parseError}`);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ERROR] Final error:", errorMessage, error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch bus data",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
