let kakaoMapsPromise: Promise<boolean> | null = null;

export function loadKakaoMapsSdk(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (isKakaoMapsReady()) {
    return Promise.resolve(true);
  }

  if (kakaoMapsPromise) {
    return kakaoMapsPromise;
  }

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  if (!appKey) {
    return Promise.resolve(false);
  }

  kakaoMapsPromise = new Promise<boolean>((resolve) => {
    const existingScript = document.getElementById("kakao-maps-sdk");
    const script = existingScript ?? document.createElement("script");
    let settled = false;
    let pollTimer: number | undefined;
    const timeout = window.setTimeout(() => finish(isKakaoMapsReady()), 10_000);
    function finish(loaded: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.clearTimeout(pollTimer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (!loaded) script.remove();
      resolve(loaded);
    }
    function poll() {
      if (settled) return;
      window.clearTimeout(pollTimer);
      if (isKakaoMapsReady()) finish(true);
      else pollTimer = window.setTimeout(poll, 100);
    }
    function onLoad() {
      try {
        if (window.kakao?.maps?.load) window.kakao.maps.load(poll);
        else poll();
      } catch { finish(false); }
    }
    function onError() { finish(false); }
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (existingScript) onLoad();
    else {
      const sdkScript = script as HTMLScriptElement;
      sdkScript.id = "kakao-maps-sdk";
      sdkScript.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`;
      sdkScript.async = true;
      try { document.head.appendChild(sdkScript); } catch { finish(false); }
    }
  }).then(loaded => {
    if (!loaded) kakaoMapsPromise = null;
    return loaded;
  });

  return kakaoMapsPromise;
}

function isKakaoMapsReady() {
  const maps = window.kakao?.maps;
  return Boolean(
    maps?.LatLng &&
      maps.Map &&
      maps.Marker &&
      maps.MarkerImage &&
      maps.Size &&
      maps.Point &&
      maps.InfoWindow &&
      maps.event,
  );
}
