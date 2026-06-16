"use client";

import { buildings } from "../lib/mapData";
import { BuildingMarker } from "./BuildingMarker";
import { useEffect, useRef, useState } from "react";
import { loadKakaoMapsSdk } from "@/lib/kakao-maps-loader";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";

interface MapViewProps {
  selectedBuilding?: string;
  highlightedBuilding?: string;
  onBuildingSelect?: (buildingId: string) => void;
}

export function MapView({
  selectedBuilding,
  highlightedBuilding,
  onBuildingSelect,
}: MapViewProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.map;
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const currentInfoWindowRef = useRef<KakaoInfoWindow | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const sdkLoaded = await loadKakaoMapsSdk();
      if (!cancelled && sdkLoaded) {
        setSdkReady(true);
      } else if (!cancelled) {
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !mapContainer.current) {
      return;
    }

    try {
      const kakaoMaps = window.kakao?.maps as KakaoMapsNamespace | undefined;
      if (!kakaoMaps) {
        setLoadState("error");
        return;
      }

      const container = mapContainer.current;
      const options = {
        center: new kakaoMaps.LatLng(
          37.643016227336034,
          127.1055106035126,
        ),
        level: 4,
      };

      const newMap = new kakaoMaps.Map(container, options);
      setMap(newMap);
      setLoadState("ready");

      requestAnimationFrame(() => {
        newMap.relayout();
        newMap.setCenter(options.center);
      });
    } catch {
      setLoadState("error");
    }
  }, [sdkReady]);

  useEffect(() => {
    if (!map || !selectedBuilding) return;

    const building = buildings.find((b) => b.id === selectedBuilding);
    const kakaoMaps = window.kakao?.maps as KakaoMapsNamespace | undefined;
    if (building && kakaoMaps) {
      const moveLatLng = new kakaoMaps.LatLng(
        Number(building.lat),
        Number(building.lng),
      );
      map.setCenter(moveLatLng);
      map.setLevel(3);
    }
  }, [selectedBuilding, map]);

  const handleInfoWindowOpen = (infoWindow: KakaoInfoWindow) => {
    if (currentInfoWindowRef.current) {
      currentInfoWindowRef.current.close();
    }
    currentInfoWindowRef.current = infoWindow;
  };

  return (
    <>
      {loadState === "error" ? (
        <MapUnavailableState />
      ) : (
        <div className="relative h-[min(60vh,600px)] min-h-[360px] w-full">
          <div ref={mapContainer} className="h-full w-full" />
          {loadState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
              <div className="w-full max-w-[18rem] px-4 text-center sm:max-w-sm">
                <p className="font-semibold text-neutral-900">
                  {text.loadingTitle}
                </p>
                <p className="mt-2 break-keep text-sm leading-6 text-neutral-600">
                  {text.loadingMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {map &&
        buildings.map((building) => (
          <BuildingMarker
            key={building.id}
            building={building}
            isHighlighted={
              highlightedBuilding === building.id ||
              selectedBuilding === building.id
            }
            map={map}
            onClick={onBuildingSelect}
            onInfoWindowOpen={handleInfoWindowOpen}
            locale={locale}
            labels={text}
          />
        ))}
    </>
  );
}

function MapUnavailableState() {
  const dictionary = useDictionary();
  const text = dictionary.pages.map;

  return (
    <div className="flex h-[min(60vh,600px)] min-h-[360px] w-full items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-[18rem] text-center sm:max-w-sm">
        <p className="font-semibold text-neutral-900">
          {text.unavailableTitle}
        </p>
        <p className="mt-2 break-keep text-sm leading-6 text-neutral-600">
          {text.unavailableMessage}
        </p>
      </div>
    </div>
  );
}
