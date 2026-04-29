/* eslint-disable @typescript-eslint/no-explicit-any */
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
  const [map, setMap] = useState<Record<string, unknown> | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const currentInfoWindowRef = useRef<any>(null);

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
      const container = mapContainer.current;
      const options = {
        center: new ((window as any).kakao.maps.LatLng as any)(
          37.643016227336034,
          127.1055106035126,
        ),
        level: 4,
      };

      const newMap = new ((window as any).kakao.maps.Map as any)(
        container,
        options,
      );
      setMap(newMap);
    } catch {
      // Handle map initialization error
    }
  }, [sdkReady]);

  useEffect(() => {
    if (!map || !selectedBuilding) return;

    const building = buildings.find((b) => b.id === selectedBuilding);
    if (building) {
      const moveLatLng = new ((window as any).kakao.maps.LatLng as any)(
        building.lat,
        building.lng,
      );
      (map as any).setCenter(moveLatLng);
      (map as any).setLevel(3);
    }
  }, [selectedBuilding, map]);

  const handleInfoWindowOpen = (infoWindow: any) => {
    if (currentInfoWindowRef.current) {
      (currentInfoWindowRef.current as any).close();
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
