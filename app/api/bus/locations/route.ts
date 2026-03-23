export const runtime = "nodejs";

export async function POST() {
  try {
    let response;
    let lastError: Error | null = null;

    // Try HTTP first
    try {
      console.log(
        "[1] Attempting HTTP request to http://nexmotion.co.kr/bus/busStatusList.php",
      );
      response = await fetch("http://nexmotion.co.kr/bus/busStatusList.php", {
        method: "POST",
      });
      console.log("[2] HTTP response status:", response.status);
      console.log(
        "[3] HTTP response headers:",
        Object.fromEntries(response.headers.entries()),
      );
    } catch (httpError) {
      lastError = httpError as Error;
      console.error("[!] HTTP failed:", lastError.message);
      console.log("[4] Attempting HTTPS fallback...");

      try {
        response = await fetch(
          "https://nexmotion.co.kr/bus/busStatusList.php",
          {
            method: "POST",
          },
        );
        console.log("[5] HTTPS response status:", response.status);
        console.log(
          "[6] HTTPS response headers:",
          Object.fromEntries(response.headers.entries()),
        );
      } catch (httpsError) {
        lastError = httpsError as Error;
        console.error("[!] HTTPS also failed:", lastError.message);
        throw lastError;
      }
    }

    // Check if response is ok
    if (!response!.ok) {
      const responseText = await response!.text();
      console.error(
        "[!] Response not OK. Status:",
        response!.status,
        "Body:",
        responseText,
      );
      return new Response(
        JSON.stringify({
          error: "API returned error",
          status: response!.status,
          details: responseText,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const contentType = response!.headers.get("content-type");
    console.log("[7] Content-Type:", contentType);

    let data;
    try {
      data = await response!.json();
      console.log(
        "[8] ✓ Successfully parsed JSON, got",
        Array.isArray(data.data) ? data.data.length : "response",
      );
    } catch (parseError) {
      const responseText = await response!.text();
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
