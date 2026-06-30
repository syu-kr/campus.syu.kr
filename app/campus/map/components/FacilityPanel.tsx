"use client";

import { getBuildingById, categoryColors } from "../lib/mapData";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { useState } from "react";
import { Icon } from "@/app/components/Icon";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import {
  formatMapCountSummary,
  formatMapFloor,
  getFacilityCategoryLabel,
} from "../lib/mapI18n";

interface FacilityPanelProps {
  buildingId?: string;
}

export function FacilityPanel({ buildingId }: FacilityPanelProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.map;
  const building = buildingId ? getBuildingById(buildingId) : null;
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(
    new Set(building?.floors.map((floor) => floor.floor) ?? []),
  );

  if (!building) {
    return (
      <Card className="p-6 text-center text-neutral-500">
        <div className="flex justify-center mb-2">
          <Icon
            name="map-pin"
            size={32}
            color="rgb(209, 213, 219)"
            title={text.locationPin}
          />
        </div>
        <p className="text-sm">{text.selectBuilding}</p>
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
      <Card className="border border-neutral-200 bg-white" hover={false}>
        <div className="flex items-start gap-3">
          <Icon
            name="map-pin"
            size={20}
            color="rgb(82, 82, 82)"
            className="flex-shrink-0 mt-0.5"
          />
          <div>
            <h2 className="font-bold text-neutral-900 text-lg">
              {building.name}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              {formatMapCountSummary(
                building.floors.length,
                building.floors.reduce(
                  (acc, f) => acc + f.facilities.length,
                  0,
                ),
                locale,
                text,
              )}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {building.floors.map((floor) => {
          const isExpanded = expandedFloors.has(floor.floor);
          const panelId = `${building.id}-floor-${floor.floor}`;

          return (
            <Card key={floor.floor} className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleFloor(floor.floor)}
                className="flex w-full items-center justify-between p-4 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
                aria-expanded={isExpanded}
                aria-controls={panelId}
              >
                <h3 className="font-semibold text-neutral-900">
                  {formatMapFloor(floor.floor, locale, text)}
                </h3>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="rgb(156, 163, 175)"
                  className={`transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExpanded && (
                <div
                  id={panelId}
                  className="border-t border-neutral-200 bg-neutral-50 p-4 space-y-3"
                >
                  {floor.facilities.length === 0 ? (
                    <p className="text-neutral-600 text-sm italic">
                      {floor.description}
                    </p>
                  ) : (
                    floor.facilities.map((facility, facilityIndex) => (
                      <div
                        key={`${building.id}-${floor.floor}-${facility.id}-${facilityIndex}`}
                        className="flex items-start gap-3"
                      >
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
                              {getFacilityCategoryLabel(facility.category, text)}
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
          );
        })}
      </div>
    </div>
  );
}
