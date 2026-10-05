"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { loadKakaoMapsSdk } from "@/lib/kakao-maps-loader";
import type { BusLocation } from "@/types";

export interface ShuttleMapHandle {
  openMarker: (busId: string) => void;
}

interface ShuttleMarkerData {
  marker: KakaoMarker;
  infowindow: KakaoInfoWindow & { getMap: () => KakaoMap | null };
}

interface ShuttleMapProps {
  busLocations: BusLocation[];
  selectedBusId: string | null;
  labels: {
    status: string;
    schoolToStation: string;
    stationToSchool: string;
    unknown: string;
  };
}

export const ShuttleMap = forwardRef<ShuttleMapHandle, ShuttleMapProps>(
  ({ busLocations, selectedBusId, labels }, ref) => {
    const mapRef = useRef<KakaoMap | null>(null);
    const markersRef = useRef<Map<string, ShuttleMarkerData>>(new Map());
    const currentInfoWindowRef = useRef<KakaoInfoWindow | null>(null);
    const activeBusIdRef = useRef<string | null>(null);
    const infoWindowDismissedRef = useRef(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const { status, schoolToStation, stationToSchool, unknown } = labels;

    const openMarker = useCallback((busId: string) => {
      const markerData = markersRef.current.get(busId);
      if (!markerData || !mapRef.current) return;

      const { marker, infowindow } = markerData;
      if (currentInfoWindowRef.current !== infowindow) {
        currentInfoWindowRef.current?.close();
      }
      infowindow.open(mapRef.current, marker);
      currentInfoWindowRef.current = infowindow;
      activeBusIdRef.current = busId;
      infoWindowDismissedRef.current = false;
      mapRef.current.panTo(marker.getPosition());
    }, []);

    useEffect(() => {
      let cancelled = false;

      loadKakaoMapsSdk().then((loaded) => {
        if (!cancelled && loaded) {
          setMapLoaded(true);
        }
      });

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (!mapLoaded || mapRef.current) return;

      const kakaoMaps = window.kakao?.maps as KakaoMapsNamespace | undefined;
      if (!kakaoMaps) return;

      const mapContainer = document.getElementById("shuttle-map");
      if (!mapContainer) return;

      try {
        const center = new kakaoMaps.LatLng(37.64, 127.11);
        const map = new kakaoMaps.Map(mapContainer, {
          center,
          level: 5,
        });
        mapRef.current = map;

        const frame = requestAnimationFrame(() => {
          map.relayout();
          map.setCenter(center);
        });
        return () => cancelAnimationFrame(frame);
      } catch {
        // Kakao Maps can fail when the SDK or container is unavailable.
      }
    }, [mapLoaded]);

    useEffect(() => {
      if (!mapLoaded || !mapRef.current) return;

      const kakaoMaps = window.kakao?.maps as KakaoMapsNamespace | undefined;
      if (!kakaoMaps) return;

      const routeColors: Record<string | number, string> = {
        1: "#3b82f6",
        2: "#10b981",
        3: "#f59e0b",
        4: "#8b5cf6",
      };
      const routeNames: Record<string | number, string> = {
        1: "화랑대역",
        2: "석계역",
        3: "별내역",
        4: "구리",
      };
      const statusLabels: Record<number, string> = {
        1: schoolToStation,
        2: stationToSchool,
      };

      const listeners: { marker: KakaoMarker; handler: () => void }[] = [];
      const markers = new Map<string, ShuttleMarkerData>();
      markersRef.current = markers;
      const markerPositions: KakaoLatLng[] = [];
      busLocations
        .filter((bus) => bus.status !== 0)
        .map((bus) => ({
          ...bus,
          latNumber: Number(bus.lat),
          lonNumber: Number(bus.lon),
        }))
        .filter(
          (bus) =>
            Number.isFinite(bus.latNumber) && Number.isFinite(bus.lonNumber),
        )
        .forEach((bus) => {
          const color =
            bus.status === 2
              ? "#d0d0d0"
              : routeColors[bus.routeid] || "#999999";
          const routeName = routeNames[bus.routeid] || unknown;
          const statusLabel = statusLabels[bus.status] || unknown;
          const markerPosition = new kakaoMaps.LatLng(
            bus.latNumber,
            bus.lonNumber,
          );
          markerPositions.push(markerPosition);

          const markerImage = new kakaoMaps.MarkerImage(
            `data:image/svg+xml;base64,${btoa(createBusMarkerSvg(color))}`,
            new kakaoMaps.Size(30, 37),
            { offset: new kakaoMaps.Point(15, 37) },
          );
          const marker = new kakaoMaps.Marker({
            position: markerPosition,
            title: routeName,
            image: markerImage,
          });
          marker.setMap(mapRef.current);

          const infowindow = new kakaoMaps.InfoWindow({
            content: createInfoWindowContent(
              routeName,
              statusLabel,
              color,
              status,
            ),
            removable: true,
            zIndex: 1,
          }) as ShuttleMarkerData["infowindow"];

          markers.set(bus.id, { marker, infowindow });
          const handler = () => openMarker(bus.id);
          kakaoMaps.event.addListener(marker, "click", handler);
          listeners.push({ marker, handler });
        });

      let frame: number | undefined;
      if (markerPositions.length > 0) {
        frame = requestAnimationFrame(() => {
          if (!mapRef.current) return;

          mapRef.current.relayout();
          if (infoWindowDismissedRef.current) return;
          const activeBusId = activeBusIdRef.current;
          if (activeBusId && markersRef.current.has(activeBusId)) {
            openMarker(activeBusId);
            return;
          }

          if (markerPositions.length === 1) {
            mapRef.current.setCenter(markerPositions[0]);
            mapRef.current.setLevel(5);
            return;
          }

          const bounds = new kakaoMaps.LatLngBounds();
          markerPositions.forEach((position) => bounds.extend(position));
          mapRef.current.setBounds(bounds, 48, 48, 48, 48);
        });
      }
      return () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        const activeMarker = activeBusIdRef.current && markers.get(activeBusIdRef.current);
        if (activeMarker && !activeMarker.infowindow.getMap()) {
          activeBusIdRef.current = null;
          infoWindowDismissedRef.current = true;
        }
        listeners.forEach(({ marker, handler }) => {
          kakaoMaps.event.removeListener(marker, "click", handler);
        });
        markers.forEach(({ marker, infowindow }) => {
          marker.setMap(null);
          infowindow.close();
        });
        markers.clear();
        currentInfoWindowRef.current = null;
      };
    }, [busLocations, status, schoolToStation, stationToSchool, unknown, mapLoaded, openMarker]);

    useEffect(() => {
      if (!selectedBusId || !mapRef.current) return;

      openMarker(selectedBusId);
    }, [selectedBusId, mapLoaded, openMarker]);

    useImperativeHandle(ref, () => ({
      openMarker,
    }));

    return null;
  },
);

ShuttleMap.displayName = "ShuttleMap";

function createBusMarkerSvg(color: string) {
  return `
    <svg width="30" height="37" viewBox="0 0 30 37" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M15 0C7 0 0 7 0 15c0 11 15 22 15 22s15-11 15-22c0-8-7-15-15-15z" fill="${color}"/>
      <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>
  `;
}

function createInfoWindowContent(
  routeName: string,
  statusLabel: string,
  color: string,
  statusTitle: string,
) {
  return `
    <div style="
      width: 160px;
      padding: 12px;
      border-radius: 8px;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
    ">
      <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 14px; color: #000;">${routeName}</p>
      <p style="margin: 0; color: #333;"><span style="font-weight: 600;">${statusTitle}:</span> <span style="color: ${color}; font-weight: 500;">${statusLabel}</span></p>
    </div>
  `;
}
