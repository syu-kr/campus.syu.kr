export interface ReadingRoom {
  strRoomNm: string;
  strTotalSeat: number;
  strUseSeat: number;
  strRemainSeat: number;
}

export type LibrarySeason = "semester" | "vacation";

export interface LibraryRoomHours {
  name: string;
  schedule: {
    "월-목": string;
    금: string;
    일: string;
  };
  note?: string;
}

export interface LibraryFloorHours {
  name: string;
  rooms: LibraryRoomHours[];
}

export interface LibrarySeasonHours {
  label: string;
  floors: LibraryFloorHours[];
}

export const ROOM_SEAT_MAP_URLS = [
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=6&searchGB=S",
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=7&searchGB=S",
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=8&searchGB=S",
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=9&searchGB=S",
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=10&searchGB=S",
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=11&searchGB=S",
  "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=12&searchGB=S",
];

export const LIBRARY_OPERATING_HOURS: Record<
  LibrarySeason,
  LibrarySeasonHours
> = {
  semester: {
    label: "학기 중",
    floors: [
      {
        name: "지하1층",
        rooms: [
          {
            name: "나눔실",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "휴관" },
            note: "세미나 중, 개인이용불가",
          },
          {
            name: "서고1,2,3,4",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "휴관" },
            note: "폐가제 운영",
          },
        ],
      },
      {
        name: "1층",
        rooms: [
          {
            name: "열람실",
            schedule: { "월-목": "08:00-23:00", 금: "08:00-17:00", 일: "09:00-22:00" },
          },
          {
            name: "휴게실",
            schedule: { "월-목": "08:00-23:00", 금: "08:00-17:00", 일: "09:00-22:00" },
          },
        ],
      },
      {
        name: "2층",
        rooms: [
          {
            name: "제1자료실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
          {
            name: "채움실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "09:00-15:00" },
            note: "대출불가, 타실로 이동 불가",
          },
        ],
      },
      {
        name: "2.5층",
        rooms: [
          {
            name: "열린공간",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
        ],
      },
      {
        name: "3층",
        rooms: [
          {
            name: "제2자료실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
          {
            name: "토론실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
          {
            name: "집중실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
        ],
      },
      {
        name: "2-3층",
        rooms: [
          {
            name: "스터디룸",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-15:00", 일: "휴관" },
            note: "사전예약",
          },
        ],
      },
    ],
  },
  vacation: {
    label: "방학 중",
    floors: [
      {
        name: "지하1층",
        rooms: [
          {
            name: "나눔실",
            schedule: { "월-목": "휴관", 금: "휴관", 일: "휴관" },
            note: "세미나 중, 개인이용불가",
          },
          {
            name: "서고1,2,3,4",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "휴관" },
            note: "폐가제 운영",
          },
        ],
      },
      {
        name: "1층",
        rooms: [
          {
            name: "열람실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-17:00", 일: "09:00-17:00" },
          },
          {
            name: "휴게실",
            schedule: { "월-목": "09:00-21:00", 금: "09:00-17:00", 일: "09:00-17:00" },
          },
        ],
      },
      {
        name: "2층",
        rooms: [
          {
            name: "제1자료실",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
          {
            name: "채움실",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "09:00-15:00" },
            note: "대출불가, 타실로 이동 불가",
          },
        ],
      },
      {
        name: "2.5층",
        rooms: [
          {
            name: "열린공간",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
        ],
      },
      {
        name: "3층",
        rooms: [
          {
            name: "제2자료실",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
          {
            name: "토론실",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
          {
            name: "집중실",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "09:00-15:00" },
          },
        ],
      },
      {
        name: "2-3층",
        rooms: [
          {
            name: "스터디룸",
            schedule: { "월-목": "09:00-17:00", 금: "09:00-15:00", 일: "휴관" },
            note: "사전예약",
          },
        ],
      },
    ],
  },
};
