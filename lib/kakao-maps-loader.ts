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

  kakaoMapsPromise = new Promise((resolve) => {
    const existingScript = document.getElementById("kakao-maps-sdk");

    const resolveWhenReady = () => {
      let attempts = 0;
      const poll = () => {
        attempts += 1;
        if (isKakaoMapsReady()) {
          resolve(true);
          return;
        }

        if (attempts >= 300) {
          resolve(false);
          return;
        }

        window.setTimeout(poll, 100);
      };

      poll();
    };

    if (existingScript) {
      resolveWhenReady();
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services,drawing&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(resolveWhenReady);
        return;
      }

      resolveWhenReady();
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
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
