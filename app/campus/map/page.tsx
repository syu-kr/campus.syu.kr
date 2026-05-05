"use client";

import { Container } from "@/app/components/Container";

import { useState } from "react";
import { MapView } from "./components/MapView";
import { FacilityPanel } from "./components/FacilityPanel";
import { FacilitySearch } from "./components/FacilitySearch";
import { Icon } from "@/app/components/Icon";

export default function MapPage() {
  const [selectedBuilding, setSelectedBuilding] = useState<string>();
  const [highlightedBuilding, setHighlightedBuilding] = useState<string>();

  const handleFacilitySelect = (buildingId: string) => {
    setSelectedBuilding(buildingId);
    setHighlightedBuilding(buildingId);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Icon
            name="map"
            size={28}
            color="rgb(37, 99, 235)"
            title="캠퍼스 지도"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
            캠퍼스 지도
          </h1>
        </div>
        <p className="text-neutral-600">
          삼육대학교 캠퍼스의 건물과 시설을 확인하세요
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <FacilitySearch onSelect={handleFacilitySelect} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg overflow-hidden shadow-lg border border-neutral-200 h-fit">
          <MapView
            selectedBuilding={selectedBuilding}
            highlightedBuilding={highlightedBuilding}
            onBuildingSelect={handleFacilitySelect}
          />
        </div>

        <div className="hidden lg:flex lg:flex-col space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <FacilityPanel buildingId={selectedBuilding} />
        </div>
      </div>

      {selectedBuilding && (
        <a
          href="#facility-info"
          className="mt-4 inline-flex rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 lg:hidden"
        >
          선택한 건물 시설 정보 보기
        </a>
      )}

      <div id="facility-info" className="mt-6 scroll-mt-24 lg:hidden">
        <div className="mt-4">
          <FacilityPanel buildingId={selectedBuilding} />
        </div>
      </div>
    </Container>
  );
}
