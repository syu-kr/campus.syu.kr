"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useEffect, useState } from "react";

interface ReadingRoom {
  strRoomNm: string;
  strTotalSeat: number;
  strUseSeat: number;
  strRemainSeat: number;
}

function getUsageColor(percentage: number): string {
  if (percentage >= 66) return "bg-red-600"; // 2/3 이상
  if (percentage >= 33) return "bg-yellow-500"; // 1/3 이상
  return "bg-primary-600"; // 1/3 미만
}

export default function LibraryPage() {
  const [rooms, setRooms] = useState<ReadingRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<"semester" | "vacation">(
    "semester",
  );
  const [seatMapUrl, setSeatMapUrl] = useState<string | null>(null);

  // 열람실 좌석보기 URL 매핑 (배열 순서 기반)
  const roomSeatMapUrls = [
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=6&searchGB=S", // 열람실
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=7&searchGB=S", // 제1자료실A
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=8&searchGB=S", // 제1자료실A (또는 B)
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=9&searchGB=S", // 채움실
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=10&searchGB=S", // 제2자료실A
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=11&searchGB=S", // 제2자료실B
    "https://libmo.syu.ac.kr/mobile/PA/seatMap.php?roomNo=12&searchGB=S", // 집중실
  ];

  // 운영시간 데이터 (사용자 제공 데이터로 업데이트)
  const operatingHours = {
    semester: {
      label: "학기 중",
      floors: [
        {
          name: "지하1층",
          rooms: [
            {
              name: "나눔실",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "휴관",
              },
              note: "세미나 중, 개인이용불가",
            },
            {
              name: "서고1,2,3,4",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "휴관",
              },
              note: "폐가제 운영",
            },
          ],
        },
        {
          name: "1층",
          rooms: [
            {
              name: "열람실",
              schedule: {
                "월-목": "08:00-23:00",
                금: "08:00-17:00",
                일: "09:00-22:00",
              },
            },
            {
              name: "휴게실",
              schedule: {
                "월-목": "08:00-23:00",
                금: "08:00-17:00",
                일: "09:00-22:00",
              },
            },
          ],
        },
        {
          name: "2층",
          rooms: [
            {
              name: "제1자료실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
            {
              name: "채움실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
              note: "대출불가, 타실로 이동 불가",
            },
          ],
        },
        {
          name: "2.5층",
          rooms: [
            {
              name: "열린공간",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
          ],
        },
        {
          name: "3층",
          rooms: [
            {
              name: "제2자료실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
            {
              name: "토론실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
            {
              name: "집중실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
          ],
        },
        {
          name: "2-3층",
          rooms: [
            {
              name: "스터디룸",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-15:00",
                일: "휴관",
              },
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
              schedule: {
                "월-목": "휴관",
                금: "휴관",
                일: "휴관",
              },
              note: "세미나 중, 개인이용불가",
            },
            {
              name: "서고1,2,3,4",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "휴관",
              },
              note: "폐가제 운영",
            },
          ],
        },
        {
          name: "1층",
          rooms: [
            {
              name: "열람실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-17:00",
                일: "09:00-17:00",
              },
            },
            {
              name: "휴게실",
              schedule: {
                "월-목": "09:00-21:00",
                금: "09:00-17:00",
                일: "09:00-17:00",
              },
            },
          ],
        },
        {
          name: "2층",
          rooms: [
            {
              name: "제1자료실",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
            {
              name: "채움실",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
              note: "대출불가, 타실로 이동 불가",
            },
          ],
        },
        {
          name: "2.5층",
          rooms: [
            {
              name: "열린공간",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
          ],
        },
        {
          name: "3층",
          rooms: [
            {
              name: "제2자료실",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
            {
              name: "토론실",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
            {
              name: "집중실",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "09:00-15:00",
              },
            },
          ],
        },
        {
          name: "2-3층",
          rooms: [
            {
              name: "스터디룸",
              schedule: {
                "월-목": "09:00-17:00",
                금: "09:00-15:00",
                일: "휴관",
              },
              note: "사전예약",
            },
          ],
        },
      ],
    },
  };

  useEffect(() => {
    const fetchRoomStatus = async () => {
      try {
        const response = await fetch("/api/library/reading-rooms");
        const data = await response.json();
        setRooms(data);
        setLastUpdate(new Date().toLocaleTimeString("ko-KR"));
      } catch (error) {
        console.error("Failed to fetch room status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoomStatus();
    // 5분마다 갱신
    const interval = setInterval(fetchRoomStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const currentHours = operatingHours[selectedSeason];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          도서관
        </h1>
        <p className="text-neutral-600">
          삼육대학교 중앙도서관 정보 및 열람실 현황
        </p>
      </div>

      {/* 열람실 현황 */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-neutral-900">열람실 현황</h2>
          {lastUpdate && (
            <span className="text-xs text-neutral-500">
              마지막 업데이트: {lastUpdate}
            </span>
          )}
        </div>

        {isLoading ? (
          <Skeleton count={3} height="60px" />
        ) : rooms.length === 0 ? (
          <div className="py-4 text-center text-neutral-500">
            열람실 정보를 불러올 수 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room, idx) => {
              const usagePercent = Math.round(
                (room.strUseSeat / room.strTotalSeat) * 100,
              );
              return (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-neutral-900">
                        {room.strRoomNm}
                      </strong>
                      <button
                        onClick={() => setSeatMapUrl(roomSeatMapUrls[idx])}
                        className="px-2 py-1 text-xs font-medium rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                      >
                        좌석보기
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-neutral-700">
                      {room.strUseSeat}/{room.strTotalSeat}
                      <span className="text-neutral-500 ml-1">
                        ({usagePercent}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded h-2">
                    <div
                      className={`${getUsageColor(usagePercent)} h-2 rounded transition-all`}
                      style={{ width: `${usagePercent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-neutral-500">
          <p>• 파란색: 1/3 미만</p>
          <p>• 주황색: 1/3 ~ 2/3</p>
          <p>• 빨간색: 2/3 이상</p>
        </div>
      </Card>

      {/* 운영시간 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">운영시간</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedSeason("semester")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === "semester"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              학기 중
            </button>
            <button
              onClick={() => setSelectedSeason("vacation")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === "vacation"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              방학 중
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {currentHours.floors.map((floor, floorIdx) => (
            <Card key={floorIdx} className="border border-neutral-300">
              <h3 className="font-bold text-neutral-900 mb-4 text-lg">
                {floor.name}
              </h3>
              <div className="space-y-3">
                {floor.rooms.map((room, roomIdx) => (
                  <div
                    key={roomIdx}
                    className="border-t border-neutral-200 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-neutral-900">
                        {room.name}
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-2 text-sm">
                      <div>
                        <span className="text-xs text-neutral-500">월-목</span>
                        <p className="font-medium text-neutral-900">
                          {room.schedule["월-목"]}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">금</span>
                        <p className="font-medium text-neutral-900">
                          {room.schedule["금"]}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">일</span>
                        <p className="font-medium text-neutral-900">
                          {room.schedule["일"] || "휴관"}
                        </p>
                      </div>
                    </div>
                    {room.note && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                        {room.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* 주의사항 */}
        <Card className="mt-6 bg-neutral-50 border border-neutral-300">
          <h3 className="font-semibold text-neutral-900 mb-3">주의사항</h3>
          <ul className="text-sm text-neutral-700 space-y-1">
            <li>• 법정 공휴일, 토요일은 폐관합니다.</li>
            <li>• 스터디룸 이용 시 이용규정을 꼭 확인하시기 바랍니다.</li>
            <li>
              • 개관일정은 학술정보원 일정에 따라 변경될 수 있으니 공지사항을
              확인하시기 바랍니다.
            </li>
          </ul>
        </Card>
      </div>

      {/* 편의시설 및 서비스 */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          편의시설 및 서비스
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">도서 대출/반납</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">학습 PC</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">학술 데이터베이스</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">인쇄/스캔</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">휴게실</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">화장실</span>
          </div>
        </div>
      </Card>

      {/* 이용 안내 */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4">이용 안내</h2>
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">도서 대출</h3>
            <p className="text-blue-800">
              학생증 제시 후 도서 대출 (1인 5권, 14일)
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">열람실 이용</h3>
            <p className="text-blue-800">학생증 필수 / 개인 물품 관리 책임</p>
          </div>
        </div>
      </Card>

      {/* 좌석보기 모달 */}
      {seatMapUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] animate-in fade-in duration-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">좌석 현황</h3>
              <button
                onClick={() => setSeatMapUrl(null)}
                className="px-3 py-1.5 text-sm font-medium bg-neutral-200 text-neutral-900 rounded-lg hover:bg-neutral-300 transition-colors"
              >
                닫기
              </button>
            </div>
            <iframe
              src={seatMapUrl}
              className="flex-1 w-full border-0"
              title="좌석 현황"
            />
          </div>
        </div>
      )}
    </Container>
  );
}
