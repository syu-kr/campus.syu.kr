/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Building } from "../lib/mapData";
import { useEffect, useRef } from "react";

interface BuildingMarkerProps {
  building: Building;
  isHighlighted: boolean;
  map: Record<string, unknown>;
  onClick?: (buildingId: string) => void;
  onInfoWindowOpen?: (infoWindow: any) => void;
}

export function BuildingMarker({
  building,
  isHighlighted,
  map,
  onClick,
  onInfoWindowOpen,
}: BuildingMarkerProps) {
  const markerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !(window as any).kakao?.maps) {
      return;
    }

    try {
      // Step 1: LatLng 생성
      const position = new (window as any).kakao.maps.LatLng(
        building.lat,
        building.lng,
      );

      // Step 2: 마커 생성
      const marker = new (window as any).kakao.maps.Marker({
        position: position,
        map: map as any,
        title: building.name,
      } as any);

      markerRef.current = marker;

      // 마커에 클릭 이벤트 추가
      const content = `
        <div style="width: 100%; padding: 12px; min-width: 250px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); box-sizing: border-box; border: none; outline: none;">
          <h3 style="font-weight: bold; font-size: 14px; color: #111; margin: 0 0 6px 0;">${building.name}</h3>
          <p style="font-size: 12px; color: #666; margin: 0;">총 ${building.floors.length}개 층 · ${building.floors.reduce((acc, f) => acc + f.facilities.length, 0)}개 시설</p>
        </div>
      `;

      const infoWindow = new (window as any).kakao.maps.InfoWindow({
        content: content,
        removable: true,
        zIndex: 100,
      });

      infoWindowRef.current = infoWindow;

      // 마커 클릭 이벤트
      (window as any).kakao.maps.event.addListener(marker, "click", () => {
        // 이전에 열린 팝업을 닫고 새로운 팝업 열기
        infoWindow.open(map as any, marker);
        if (onInfoWindowOpen) {
          onInfoWindowOpen(infoWindow);
        }
        if (onClick) onClick(building.id);
      });
    } catch {
      // Handle marker creation error
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [building, map, onClick, onInfoWindowOpen]);

  // isHighlighted 변경 시 InfoWindow 자동 열기/닫기
  useEffect(() => {
    if (!markerRef.current || !infoWindowRef.current || !map) {
      return;
    }

    if (isHighlighted) {
      // InfoWindow 열기
      infoWindowRef.current.open(map as any, markerRef.current);
      if (onInfoWindowOpen) {
        onInfoWindowOpen(infoWindowRef.current);
      }
    } else {
      // InfoWindow 닫기
      infoWindowRef.current.close();
    }
  }, [isHighlighted, map, onInfoWindowOpen]);

  return null;
}
