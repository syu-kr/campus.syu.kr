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

      // Step 2: 커스텀 SVG 마커 생성 (고유 ID 사용)
      const uniqueId = `marker-${building.id}-${Date.now()}`;
      const svgMarker = `
        <svg width="40" height="48" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
            </linearGradient>
            <filter id="shadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3" />
            </filter>
          </defs>
          <path d="M20 0C9 0 0 9 0 20c0 15 20 28 20 28s20-13 20-28c0-11-9-20-20-20z" fill="url(#grad-${uniqueId})" filter="url(#shadow-${uniqueId})"/>
          <circle cx="20" cy="19" r="7" fill="white" opacity="0.95"/>
          <circle cx="20" cy="19" r="3" fill="#4f46e5"/>
        </svg>
      `;

      const markerImage = new (window as any).kakao.maps.MarkerImage(
        `data:image/svg+xml;base64,${btoa(svgMarker)}`,
        new (window as any).kakao.maps.Size(40, 48),
        { offset: new (window as any).kakao.maps.Point(20, 48) },
      );

      // Step 3: 마커 생성
      const marker = new (window as any).kakao.maps.Marker({
        position: position,
        image: markerImage,
        title: building.name,
      } as any);

      marker.setMap(map as any);

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
