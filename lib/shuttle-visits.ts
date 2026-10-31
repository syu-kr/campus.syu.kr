export type ShuttleRoute = "hwarangdae" | "seokgye" | "byeollae";
export const shuttleScheduleIds: Record<ShuttleRoute, string> = {
  hwarangdae: "shuttle-0", seokgye: "shuttle-1", byeollae: "shuttle-2",
};

type Visit = {
  id: string;
  role: "pickup" | "dropoff" | "both";
  toward: "school" | "seokgye" | "byeollae";
  label: { ko: string; en: string };
};
export const serviceVisits: Record<ShuttleRoute, Visit[]> = {
  hwarangdae: [
    { id: "hwarangdae-5-campus", role: "pickup", toward: "school", label: { ko: "화랑대역 5번 출구", en: "Hwarangdae Exit 5" } },
    { id: "hwarangdae-campus-arrival", role: "dropoff", toward: "school", label: { ko: "학교 도착", en: "Campus arrival" } },
  ],
  seokgye: [
    { id: "seokgye-campus-departure", role: "pickup", toward: "seokgye", label: { ko: "학교 출발", en: "Campus departure" } },
    { id: "seokgye-hwarangdae-2", role: "dropoff", toward: "seokgye", label: { ko: "화랑대역 2번 출구", en: "Hwarangdae Exit 2" } },
    { id: "seokgye-taereung-6", role: "dropoff", toward: "seokgye", label: { ko: "태릉입구역 6번 출구", en: "Taereung Exit 6" } },
    { id: "seokgye-4", role: "both", toward: "school", label: { ko: "석계역 4번 출구", en: "Seokgye Exit 4" } },
    { id: "seokgye-taereung-7", role: "pickup", toward: "school", label: { ko: "태릉입구역 7번 출구", en: "Taereung Exit 7" } },
    { id: "seokgye-campus-arrival", role: "dropoff", toward: "school", label: { ko: "학교 도착", en: "Campus arrival" } },
  ],
  byeollae: [
    { id: "byeollae-campus-departure", role: "pickup", toward: "byeollae", label: { ko: "학교 출발", en: "Campus departure" } },
    { id: "byeollae-2", role: "both", toward: "school", label: { ko: "별내역 2번 출구", en: "Byeollae Exit 2" } },
    { id: "byeollae-campus-arrival", role: "dropoff", toward: "school", label: { ko: "학교 도착", en: "Campus arrival" } },
  ],
};
