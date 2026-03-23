"use client";

import { Container } from "@/app/components/Container";
import { useState, useRef } from "react";
import { MapView } from "./components/MapView";
import { FacilityPanel } from "./components/FacilityPanel";
import { FacilitySearch } from "./components/FacilitySearch";
import { Icon } from "@/app/components/Icon";

export default function MapPage() {
  const [selectedBuilding, setSelectedBuilding] = useState<string>();
  const [highlightedBuilding, setHighlightedBuilding] = useState<string>();
  const mobileFacilityPanelRef = useRef<HTMLDivElement>(null);

  const handleFacilitySelect = (buildingId: string) => {
    setSelectedBuilding(buildingId);
    setHighlightedBuilding(buildingId);

    // 모바일에서 시설 정보 섹션으로 자동 스크롤 (덜 내려가도록)
    if (buildingId && mobileFacilityPanelRef.current) {
      setTimeout(() => {
        mobileFacilityPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 150);
    }
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Icon name="map" size={28} color="rgb(37, 99, 235)" />
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
            캠퍼스 지도
          </h1>
        </div>
        <p className="text-neutral-600">
          삼육대학교 캠퍼스의 건물과 시설을 확인하세요
        </p>
      </div>

      {/* 검색바 */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <FacilitySearch onSelect={handleFacilitySelect} />
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 지도 영역 */}
        <div className="lg:col-span-2 rounded-lg overflow-hidden shadow-lg border border-neutral-200 h-fit">
          <MapView
            selectedBuilding={selectedBuilding}
            highlightedBuilding={highlightedBuilding}
            onBuildingSelect={handleFacilitySelect}
          />
        </div>

        {/* 사이드패널 - 데스크톱에서만 표시 */}
        <div className="hidden lg:flex lg:flex-col space-y-4 max-h-screen overflow-y-auto">
          {/* 시설 정보 */}
          <FacilityPanel buildingId={selectedBuilding} />
        </div>
      </div>

      {/* 모바일 뷰: 시설 정보 */}
      <div className="mt-6 lg:hidden" ref={mobileFacilityPanelRef}>
        <div className="mt-4">
          <FacilityPanel buildingId={selectedBuilding} />
        </div>
      </div>
    </Container>
  );
}
