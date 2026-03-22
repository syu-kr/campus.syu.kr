"use client";

import { categoryColors } from "../lib/mapData";
import { Card } from "@/app/components/Card";

export function CategoryLegend() {
  const categories = Object.entries(categoryColors);

  return (
    <Card className="bg-white shadow-lg">
      <h3 className="font-semibold text-neutral-900 mb-3 text-sm">카테고리</h3>
      <div className="grid grid-cols-2 gap-3">
        {categories.map(([category, color]) => (
          <div key={category} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-neutral-700">{category}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
