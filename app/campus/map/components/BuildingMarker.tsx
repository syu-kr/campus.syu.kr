"use client";

import { Building } from "../lib/mapData";
import { useEffect, useRef } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatMapCountSummary } from "../lib/mapI18n";

interface BuildingMarkerProps {
  building: Building;
  isHighlighted: boolean;
  map: KakaoMap;
  onClick?: (buildingId: string) => void;
  onInfoWindowOpen?: (infoWindow: KakaoInfoWindow) => void;
  locale: Locale;
  labels: Dictionary["pages"]["map"];
}

export function BuildingMarker({
  building,
  isHighlighted,
  map,
  onClick,
  onInfoWindowOpen,
  locale,
  labels,
}: BuildingMarkerProps) {
  const markerRef = useRef<KakaoMarker | null>(null);
  const infoWindowRef = useRef<KakaoInfoWindow | null>(null);

  useEffect(() => {
    const kakaoMaps = window.kakao?.maps as KakaoMapsNamespace | undefined;
    if (!map || !kakaoMaps) {
      return;
    }

    try {
      const position = new kakaoMaps.LatLng(
        Number(building.lat),
        Number(building.lng),
      );

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

      const markerImage = new kakaoMaps.MarkerImage(
        `data:image/svg+xml;base64,${btoa(svgMarker)}`,
        new kakaoMaps.Size(40, 48),
        { offset: new kakaoMaps.Point(20, 48) },
      );

      const marker = new kakaoMaps.Marker({
        position: position,
        image: markerImage,
        title: building.name,
      });

      marker.setMap(map);

      markerRef.current = marker;

      // 마커에 클릭 이벤트 추가
      const content = `
        <div style="width: 100%; padding: 12px; min-width: 250px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); box-sizing: border-box; border: none; outline: none;">
          <h3 style="font-weight: bold; font-size: 14px; color: #111; margin: 0 0 6px 0;">${building.name}</h3>
          <p style="font-size: 12px; color: #666; margin: 0;">${formatMapCountSummary(
            building.floors.length,
            building.floors.reduce((acc, f) => acc + f.facilities.length, 0),
            locale,
            labels,
          )}</p>
        </div>
      `;

      const infoWindow = new kakaoMaps.InfoWindow({
        content: content,
        removable: true,
        zIndex: 100,
      });

      infoWindowRef.current = infoWindow;

      kakaoMaps.event.addListener(marker, "click", () => {
        infoWindow.open(map, marker);
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
  }, [building, labels, locale, map, onClick, onInfoWindowOpen]);

  // isHighlighted 변경 시 InfoWindow 자동 열기/닫기
  useEffect(() => {
    if (!markerRef.current || !infoWindowRef.current || !map) {
      return;
    }

    if (isHighlighted) {
      infoWindowRef.current.open(map, markerRef.current);
      if (onInfoWindowOpen) {
        onInfoWindowOpen(infoWindowRef.current);
      }
    } else {
      infoWindowRef.current.close();
    }
  }, [isHighlighted, map, onInfoWindowOpen]);

  return null;
}
