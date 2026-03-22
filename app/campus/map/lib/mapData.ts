import buildingData from "../data/buildings.json";

export interface Facility {
  id: string;
  name: string;
  category:
    | "식당"
    | "카페"
    | "의료"
    | "도서관"
    | "체육"
    | "편의"
    | "사무"
    | "학습";
  description?: string;
}

export interface Floor {
  floor: number;
  description?: string;
  facilities: Facility[];
}

export interface Building {
  id: string;
  name: string;
  lat: string | number;
  lng: string | number;
  category: string;
  floors: Floor[];
  image?: string;
}

export const categoryColors: Record<string, string> = {
  식당: "#FF6B6B",
  카페: "#FFA07A",
  의료: "#4ECDC4",
  도서관: "#FFD93D",
  체육: "#6BCB77",
  편의: "#4D96FF",
  사무: "#9B59B6",
  학습: "#3498DB",
};

// JSON 파일에서 건물 데이터 로드
export const buildings: Building[] = buildingData.buildings as Building[];

// ID로 건물 조회
export function getBuildingById(id: string): Building | undefined {
  return buildings.find((b) => b.id === id);
}

// 층수를 포매팅하는 함수
export function formatFloor(floorNumber: number): string {
  if (floorNumber < 0) {
    return `지하${Math.abs(floorNumber)}층`;
  }
  return `${floorNumber}층`;
}

// 시설 및 건물명 검색 함수
export function searchFacilities(query: string): Array<{
  building: Building;
  floor?: Floor;
  facility?: Partial<Facility>;
}> {
  const queryLower = query.toLowerCase();
  const results: Array<{
    building: Building;
    floor?: Floor;
    facility?: Partial<Facility>;
  }> = [];
  const seenBuildings = new Set<string>();

  // 1단계: 건물명으로 검색
  buildings.forEach((building) => {
    if (building.name.toLowerCase().includes(queryLower)) {
      // 건물 자체를 결과에 추가
      results.push({
        building,
      });
      seenBuildings.add(building.id);
    }
  });

  // 2단계: 시설명으로 검색 (건물명으로는 검색되지 않은 건물에서만)
  buildings.forEach((building) => {
    if (seenBuildings.has(building.id)) return;

    building.floors.forEach((floor) => {
      floor.facilities.forEach((facility) => {
        if (
          facility.name.toLowerCase().includes(queryLower) ||
          facility.description?.toLowerCase().includes(queryLower)
        ) {
          results.push({
            building,
            floor,
            facility,
          });
          seenBuildings.add(building.id);
        }
      });
    });
  });

  return results;
}
