"use client";

import { getBuildingById, categoryColors, formatFloor } from "../lib/mapData";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { useState } from "react";
import { Icon } from "@/app/components/Icon";

interface FacilityPanelProps {
  buildingId?: string;
}

export function FacilityPanel({ buildingId }: FacilityPanelProps) {
  const building = buildingId ? getBuildingById(buildingId) : null;
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(
    new Set([1, 2]),
  );

  if (!building) {
    return (
      <Card className="p-6 text-center text-neutral-500">
        <div className="flex justify-center mb-2">
          <Icon name="map-pin" size={32} color="rgb(209, 213, 219)" title="위치 핀" />
        </div>
        <p className="text-sm">건물을 선택하여 시설 정보를 확인하세요</p>
      </Card>
    );
  }

  const toggleFloor = (floor: number) => {
    const newSet = new Set(expandedFloors);
    if (newSet.has(floor)) {
      newSet.delete(floor);
    } else {
      newSet.add(floor);
    }
    setExpandedFloors(newSet);
  };

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <Icon
            name="map-pin"
            size={20}
            color="rgb(37, 99, 235)"
            className="flex-shrink-0 mt-0.5"
          />
          <div>
            <h2 className="font-bold text-neutral-900 text-lg">
              {building.name}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              총 {building.floors.length}개 층 ·{" "}
              {building.floors.reduce((acc, f) => acc + f.facilities.length, 0)}
              개 시설
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {building.floors.map((floor) => (
          <Card key={floor.floor} className="p-0 overflow-hidden">
            <button
              onClick={() => toggleFloor(floor.floor)}
              className="w-full p-4 hover:bg-neutral-50 transition-colors flex items-center justify-between"
            >
              <h3 className="font-semibold text-neutral-900">
                {formatFloor(floor.floor)}
              </h3>
              <Icon
                name="chevron-down"
                size={18}
                color="rgb(156, 163, 175)"
                className={`transition-transform ${
                  expandedFloors.has(floor.floor) ? "rotate-180" : ""
                }`}
              />
            </button>

            {expandedFloors.has(floor.floor) && (
              <div className="border-t border-neutral-200 bg-neutral-50 p-4 space-y-3">
                {floor.facilities.length === 0 ? (
                  <p className="text-neutral-600 text-sm italic">
                    {floor.description}
                  </p>
                ) : (
                  floor.facilities.map((facility) => (
                    <div key={facility.id} className="flex items-start gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                        style={{
                          backgroundColor:
                            categoryColors[facility.category] || "#95A5A6",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-neutral-900 text-sm">
                            {facility.name}
                          </p>
                          <Badge
                            color={
                              facility.category === "식당"
                                ? "red"
                                : facility.category === "카페"
                                  ? "yellow"
                                  : facility.category === "의료"
                                    ? "green"
                                    : facility.category === "도서관"
                                      ? "yellow"
                                      : facility.category === "체육"
                                        ? "green"
                                        : facility.category === "편의"
                                          ? "blue"
                                          : "gray"
                            }
                            size="sm"
                          >
                            {facility.category}
                          </Badge>
                        </div>
                        {facility.description && (
                          <p className="text-xs text-neutral-600 mt-1">
                            {facility.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
