/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { buildings } from "../lib/mapData";
import { BuildingMarker } from "./BuildingMarker";
import { useEffect, useRef, useState } from "react";

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

  // Wait for Kakao SDK to be ready
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    (async () => {
      try {
        // Wait for the SDK promise from layout script
        const sdkLoaded = await (window as any).kakaoMapsReady;

        if (sdkLoaded) {
          setSdkReady(true);
        } else {
          // Fallback: SDK promise doesn't exist, use direct polling

          let attempts = 0;
          const maxAttempts = 300; // 30 seconds

          const poll = () => {
            attempts++;
            const ready = !!(window as any).kakao?.maps?.LatLng;

            if (ready) {
              setSdkReady(true);
            } else if (attempts < maxAttempts) {
              timeout = setTimeout(poll, 100);
            }
          };

          poll();
        }
      } catch {
        // Fallback to direct polling
        let attempts = 0;
        const fallbackPoll = () => {
          attempts++;
          if ((window as any).kakao?.maps?.LatLng) {
            setSdkReady(true);
          } else if (attempts < 300) {
            timeout = setTimeout(fallbackPoll, 100);
          }
        };
        fallbackPoll();
      }
    })();

    return () => {
      if (timeout) clearTimeout(timeout);
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
