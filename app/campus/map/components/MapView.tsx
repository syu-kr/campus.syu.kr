"use client";

import { buildings } from "../lib/mapData";
import { BuildingMarker } from "./BuildingMarker";
import { useEffect, useRef, useState } from "react";
import { loadKakaoMapsSdk } from "@/lib/kakao-maps-loader";

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const currentInfoWindowRef = useRef<KakaoInfoWindow | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const sdkLoaded = await loadKakaoMapsSdk();
      if (!cancelled && sdkLoaded) {
        setSdkReady(true);
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
      if (!kakaoMaps) return;

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

      requestAnimationFrame(() => {
        newMap.relayout();
        newMap.setCenter(options.center);
      });
    } catch {
      // Handle map initialization error
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
      <div ref={mapContainer} style={{ width: "100%", height: "600px" }} />
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
          />
        ))}
    </>
  );
}
