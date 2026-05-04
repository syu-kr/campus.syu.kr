export {};

declare global {
  interface Window {
    kakao?: {
      maps: KakaoMapsNamespace;
    };
  }

  interface KakaoMapsNamespace {
    load?: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number },
    ) => KakaoMap;
    Marker: new (options: {
      position: KakaoLatLng;
      image?: KakaoMarkerImage;
      title?: string;
    }) => KakaoMarker;
    MarkerImage: new (
      src: string,
      size: KakaoSize,
      options?: { offset?: KakaoPoint },
    ) => KakaoMarkerImage;
    InfoWindow: new (options: {
      content: string;
      removable?: boolean;
      zIndex?: number;
    }) => KakaoInfoWindow;
    LatLngBounds: new () => KakaoLatLngBounds;
    Size: new (width: number, height: number) => KakaoSize;
    Point: new (x: number, y: number) => KakaoPoint;
    event: {
      addListener: (
        target: KakaoMarker,
        type: string,
        handler: () => void,
      ) => void;
    };
  }

  interface KakaoLatLng {}

  interface KakaoSize {}

  interface KakaoPoint {}

  interface KakaoMarkerImage {}

  interface KakaoMap {
    relayout: () => void;
    setCenter: (latLng: KakaoLatLng) => void;
    panTo: (latLng: KakaoLatLng) => void;
    setLevel: (level: number) => void;
    setBounds: (
      bounds: KakaoLatLngBounds,
      top?: number,
      right?: number,
      bottom?: number,
      left?: number,
    ) => void;
  }

  interface KakaoMarker {
    setMap: (map: KakaoMap | null) => void;
    getPosition: () => KakaoLatLng;
  }

  interface KakaoLatLngBounds {
    extend: (latLng: KakaoLatLng) => void;
  }

  interface KakaoInfoWindow {
    open: (map: KakaoMap, marker: KakaoMarker) => void;
    close: () => void;
  }
}
