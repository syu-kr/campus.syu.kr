export type ShuttleRoute = "hwarangdae" | "seokgye" | "byeollae";
export const shuttleScheduleIds: Record<ShuttleRoute, string> = {
  hwarangdae: "shuttle-0", seokgye: "shuttle-1", byeollae: "shuttle-2",
};

// Registered places, not field-calibrated boarding positions. Geofence events remain candidates.
export const shuttlePlaces = {
  school: {name:"school",point:[37.64356060815022,127.10530175580361],placeId:"1626772459"},
  hwarang2: {name:"hwarangdae",exit:2,point:[37.6203782724801,127.08392300363889],placeId:"22905921"},
  hwarang5: {name:"hwarangdae",exit:5,point:[37.61991729333184,127.08597269021702],placeId:"8163324"},
  taereung6: {name:"taereung",exit:6,point:[37.61792394309624,127.07600281454886],placeId:"22906194"},
  taereung7: {name:"taereung",exit:7,point:[37.617653603112934,127.07607049990334],placeId:"22906199"},
  seokgye: {name:"seokgye",exit:4,point:[37.614812122928,127.06674604010642],placeId:"27467724"},
  byeollae: {name:"byeollae",exit:2,point:[37.64218888708682,127.12679939783764],placeId:"22020399"},
} as const;

type Visit = {
  id: string;
  role: "pickup" | "dropoff" | "both";
  toward: "school" | "seokgye" | "byeollae";
  label: { ko: string; en: string };
  point: readonly [number, number];
};
export const serviceVisits: Record<ShuttleRoute, Visit[]> = {
  hwarangdae: [
    { id: "hwarangdae-5-campus", role: "pickup", toward: "school", point:shuttlePlaces.hwarang5.point, label: { ko: "화랑대역 5번 출구", en: "Hwarangdae Exit 5" } },
    { id: "hwarangdae-campus-arrival", role: "dropoff", toward: "school", point:shuttlePlaces.school.point, label: { ko: "학교 도착", en: "Campus arrival" } },
  ],
  seokgye: [
    { id: "seokgye-campus-departure", role: "pickup", toward: "seokgye", point:shuttlePlaces.school.point, label: { ko: "학교 출발", en: "Campus departure" } },
    { id: "seokgye-hwarangdae-2", role: "dropoff", toward: "seokgye", point:shuttlePlaces.hwarang2.point, label: { ko: "화랑대역 2번 출구", en: "Hwarangdae Exit 2" } },
    { id: "seokgye-taereung-6", role: "dropoff", toward: "seokgye", point:shuttlePlaces.taereung6.point, label: { ko: "태릉입구역 6번 출구", en: "Taereung Exit 6" } },
    { id: "seokgye-4", role: "both", toward: "school", point:shuttlePlaces.seokgye.point, label: { ko: "석계역 4번 출구", en: "Seokgye Exit 4" } },
    { id: "seokgye-taereung-7", role: "pickup", toward: "school", point:shuttlePlaces.taereung7.point, label: { ko: "태릉입구역 7번 출구", en: "Taereung Exit 7" } },
    { id: "seokgye-campus-arrival", role: "dropoff", toward: "school", point:shuttlePlaces.school.point, label: { ko: "학교 도착", en: "Campus arrival" } },
  ],
  byeollae: [
    { id: "byeollae-campus-departure", role: "pickup", toward: "byeollae", point:shuttlePlaces.school.point, label: { ko: "학교 출발", en: "Campus departure" } },
    { id: "byeollae-2", role: "both", toward: "school", point:shuttlePlaces.byeollae.point, label: { ko: "별내역 2번 출구", en: "Byeollae Exit 2" } },
    { id: "byeollae-campus-arrival", role: "dropoff", toward: "school", point:shuttlePlaces.school.point, label: { ko: "학교 도착", en: "Campus arrival" } },
  ],
};
