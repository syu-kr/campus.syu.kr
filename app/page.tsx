"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card } from "./components/Card";
import { Container } from "./components/Container";
import { SearchBar } from "./components/SearchBar";
import { Badge } from "./components/Badge";
import { AnnouncementCard } from "./components/AnnouncementCard";
import { Skeleton } from "./components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAnnouncements,
  fetchCafeteriaMenu,
  fetchAcademicSchedules,
  searchAll,
} from "@/lib/api";
import { formatDate, getCategoryLabel } from "@/lib/utils";
import type {
  Announcement,
  AcademicSchedule,
  PhoneNumber,
  ServiceNotice,
} from "@/types";
import { Icon } from "./components/Icon";
import { StateCard } from "./components/StateCard";

// 자주 사용하는 메뉴
const frequentMenus = [
  { id: "1", iconName: "utensils", label: "학식", path: "/campus/cafeteria" },
  { id: "2", iconName: "bus", label: "셔틀버스", path: "/campus/shuttle" },
  {
    id: "3",
    iconName: "map",
    label: "캠퍼스 지도",
    path: "/campus/map",
  },
  {
    id: "4",
    iconName: "calendar",
    label: "학사일정",
    path: "/academic/schedule",
  },
  { id: "5", iconName: "award", label: "장학금", path: "/more/scholarship" },
  { id: "6", iconName: "book-open", label: "도서관", path: "/campus/library" },
];

const categoryFilters = [
  { id: "all", label: "전체", value: undefined },
  { id: "academic", label: "학사공지", value: "academic" },
  { id: "scholarship", label: "장학금", value: "scholarship" },
  { id: "campus", label: "캠퍼스", value: "campus" },
  { id: "service", label: "서비스공지", value: "service" },
];

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // 매초 한국 시간 업데이트
  useEffect(() => {
    const koreaTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
    setNow(koreaTime);

    const timer = setInterval(() => {
      const koreaTime = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
      );
      setNow(koreaTime);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 공지사항 조회
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["announcements", selectedCategory],
    queryFn: () =>
      fetchAnnouncements(
        selectedCategory as
          | "academic"
          | "campus"
          | "admin"
          | "activity"
          | undefined,
      ),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // 서비스 공지 조회
  const { data: serviceNotices, isLoading: serviceNoticesLoading } = useQuery({
    queryKey: ["serviceNotices"],
    queryFn: async () => {
      const response = await fetch("/api/service-notices");
      return (await response.json()) as ServiceNotice[];
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // 학식 조회
  const { data: cafeteria, isLoading: cafeteriaLoading } = useQuery({
    queryKey: ["cafeteria"],
    queryFn: () => fetchCafeteriaMenu(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // 학사일정 조회
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // 검색
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => searchAll(searchQuery),
    enabled: showSearchResults && searchQuery.trim().length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.trim().length > 0);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    setShowSearchResults(false);
  }, []);

  // 오늘 날짜와 요일 계산
  const todayInfo = useMemo(() => {
    if (!now)
      return {
        dateStringDot: "",
        dateStringDash: "",
        isWeekend: false,
        dayOfWeek: -1,
      };

    const today = now;
    const dayOfWeek = today.getDay(); // 0: 일요일, 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const date = String(today.getDate()).padStart(2, "0");
    const dateStringDot = `${year}.${month}.${date}`; // YYYY.MM.DD (학사일정)
    const dateStringDash = `${year}-${month}-${date}`; // YYYY-MM-DD (카페테리아)
    return { dateStringDot, dateStringDash, isWeekend, dayOfWeek };
  }, [now]);

  // 오늘 식단 찾기
  const todayMenu = useMemo(() => {
    if (!cafeteria) return null;
    return cafeteria.find((menu) => menu.date === todayInfo.dateStringDash);
  }, [cafeteria, todayInfo]);

  // 검색 결과를 카테고리별로 분류 (Hook의 규칙을 지키기 위해 조건 밖에서 호출)
  const categorizedResults = useMemo(() => {
    if (!showSearchResults || !searchResults) return {};

    type CategoryType = Announcement | AcademicSchedule | PhoneNumber;

    const categories: {
      [key: string]: {
        label: string;
        items: CategoryType[];
        linkPath?: string;
        icon?: string;
      };
    } = {
      academicSchedule: {
        label: "학사일정",
        items: [],
        linkPath: "/academic/schedule",
      },
      academicAnnouncement: {
        label: "학사공지",
        items: [],
        linkPath: "/academic/announcements",
      },
      campusAnnouncement: {
        label: "캠퍼스공지",
        items: [],
        linkPath: "/campus/announcements",
      },
      scholarship: {
        label: "장학금",
        items: [],
        linkPath: "/more/scholarship",
      },
      phoneNumbers: {
        label: "연락처",
        items: [],
        linkPath: "/more/phone",
      },
    };

    searchResults.forEach((result) => {
      if ("phone" in result && "department" in result) {
        // PhoneNumber
        categories.phoneNumbers.items.push(result as PhoneNumber);
      } else if ("startDate" in result) {
        // AcademicSchedule
        categories.academicSchedule.items.push(result as AcademicSchedule);
      } else if ("category" in result) {
        const announcement = result as Announcement;
        if (announcement.category === "academic") {
          categories.academicAnnouncement.items.push(announcement);
        } else if (announcement.category === "campus") {
          categories.campusAnnouncement.items.push(announcement);
        } else if (announcement.category === "scholarship") {
          categories.scholarship.items.push(announcement);
        }
      }
    });

    return categories;
  }, [showSearchResults, searchResults]);

  // 검색 결과 화면
  if (showSearchResults) {
    return (
      <Container className="py-6 sm:py-8">
        <SearchBar
          onSearch={handleSearch}
          placeholder="검색..."
          className="mb-6"
        />

        {searchLoading && (
          <div>
            <Skeleton count={3} />
          </div>
        )}

        {!searchLoading && (!searchResults || searchResults.length === 0) && (
          <StateCard
            type="info"
            title="검색 결과가 없습니다"
            message={`검색 결과: "${searchQuery}"`}
            action={
              <button
                onClick={handleSearchClear}
                className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                검색 취소
              </button>
            }
          />
        )}

        {!searchLoading && searchResults && searchResults.length > 0 && (
          <div className="space-y-6">
            {Object.entries(categorizedResults)
              .filter(([, category]) => category.items.length > 0)
              .map(([key, category]) => (
                <div key={key} className="pb-4 border-b border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {category.label}
                    </h3>
                    {category.items.length > 3 && (
                      <Link
                        href={{
                          pathname: category.linkPath,
                          query:
                            key === "academicAnnouncement" ||
                            key === "campusAnnouncement" ||
                            key === "scholarship"
                              ? { search: searchQuery }
                              : undefined,
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        전체보기 →
                      </Link>
                    )}
                  </div>

                  <div className="space-y-2">
                    {category.items.slice(0, 3).map((item) => {
                      if ("phone" in item && "department" in item) {
                        // PhoneNumber
                        const phone = item as PhoneNumber;
                        return (
                          <Card key={phone.phone}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium text-neutral-900">
                                  {phone.department}
                                </h4>
                                <p className="text-sm text-primary-600 font-semibold mt-1">
                                  {phone.phone}
                                </p>
                              </div>
                              <a
                                href={`tel:${phone.phone}`}
                                className="px-3 py-2 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 transition-colors"
                              >
                                전화
                              </a>
                            </div>
                          </Card>
                        );
                      } else if ("startDate" in item) {
                        // AcademicSchedule
                        return (
                          <Card key={item.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium text-neutral-900">
                                  {item.title}
                                </h4>
                                <p className="text-xs text-neutral-600 mt-1">
                                  {item.startDate}
                                  {item.startDate !== item.endDate
                                    ? ` ~ ${item.endDate}`
                                    : ""}
                                </p>
                              </div>
                              <Badge color="gray" size="sm">
                                {item.category === "exam"
                                  ? "시험"
                                  : item.category === "registration"
                                    ? "수강신청"
                                    : item.category === "holiday"
                                      ? "휴일"
                                      : "행사"}
                              </Badge>
                            </div>
                          </Card>
                        );
                      } else {
                        // Announcement
                        const announcement = item as Announcement;
                        return (
                          <div key={item.id}>
                            <AnnouncementCard
                              announcement={announcement}
                              href={announcement.url}
                              external={true}
                            />
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Container>
    );
  }

  // 홈 화면
  return (
    <Container className="py-6 sm:py-8 space-y-6">
      {/* 검색바 */}
      <SearchBar onSearch={handleSearch} className="mt-4" />

      {/* 자주 사용하는 메뉴 */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          자주 사용하는 메뉴
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {frequentMenus.map((menu) => (
            <Link
              key={menu.id}
              href={menu.path}
              className="flex flex-col items-center justify-center py-4 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <Icon
                name={menu.iconName}
                size={32}
                color="rgb(37, 99, 235)"
                className="mb-2"
              />
              <span className="text-xs font-medium text-center text-neutral-900">
                {menu.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 서비스 공지 위젯 */}
      <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <div className="space-y-4">
          <div>
            <p className="text-xs opacity-90 mb-1">💡 팁</p>
            <h3 className="text-lg font-semibold">
              SYU CAMPUS를 앱처럼 설치하여 사용하세요!
            </h3>
            <p className="text-xs opacity-80 mt-2">
              PWA 설치로 더 빠르고 편리하게 접속 가능합니다
            </p>
          </div>
          <Link
            href="/service/notices/005-pwa-installation-guide"
            className="inline-block"
          >
            <button className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all text-sm font-medium">
              설치 방법 보기 →
            </button>
          </Link>
        </div>
      </Card>

      {/* 공지사항 섹션 */}
      <div className="pb-4 sm:pb-6 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">공지사항</h2>
          <Link
            href={
              selectedCategory === "scholarship"
                ? "/more/scholarship"
                : selectedCategory === "campus"
                  ? "/campus/announcements"
                  : selectedCategory === "service"
                    ? "/service/notices"
                    : "/academic/announcements"
            }
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {categoryFilters.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 공지사항 목록 */}
        <div className="space-y-3">
          {selectedCategory === "service" ? (
            // 서비스 공지만 표시
            <>
              {serviceNoticesLoading && <Skeleton count={3} />}
              {!serviceNoticesLoading &&
              serviceNotices &&
              serviceNotices.length > 0 ? (
                serviceNotices.slice(0, 3).map((notice) => (
                  <div key={notice.slug} className="mb-2">
                    <Link href={`/service/notices/${notice.slug}`}>
                      <Card className="cursor-pointer hover:shadow-card-hover border border-neutral-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-neutral-900 mb-2">
                              {notice.title}
                            </h3>
                            <p className="text-xs text-neutral-600 line-clamp-2 mb-2">
                              {notice.excerpt || ""}
                            </p>
                            <div className="text-xs text-neutral-500">
                              {notice.author} · {notice.date}
                            </div>
                          </div>
                          <Icon
                            name="megaphone"
                            size={20}
                            className="flex-shrink-0"
                            color="rgb(82, 82, 82)"
                            strokeWidth={1.5}
                          />
                        </div>
                      </Card>
                    </Link>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-neutral-600">
                    서비스 공지가 없습니다.
                  </p>
                </div>
              )}
            </>
          ) : (
            // 일반 공지 + 서비스 공지 혼합 표시
            <>
              {(announcementsLoading || serviceNoticesLoading) && (
                <Skeleton count={3} />
              )}
              {!announcementsLoading && !serviceNoticesLoading && (
                <>
                  {(() => {
                    // 공지와 서비스 공지를 혼합해서 정렬 (최대 3개)
                    const combined: Array<{
                      type: "announcement" | "service";
                      data: Announcement | ServiceNotice;
                    }> = [];

                    if (announcements) {
                      announcements.forEach((a) => {
                        combined.push({ type: "announcement", data: a });
                      });
                    }

                    // 전체(undefined) 카테고리일 때만 서비스 공지 포함
                    if (selectedCategory === undefined && serviceNotices) {
                      serviceNotices.forEach((s) => {
                        combined.push({ type: "service", data: s });
                      });
                    }

                    // 날짜로 정렬 (최신순)
                    combined.sort((a, b) => {
                      const dateA =
                        a.type === "announcement"
                          ? new Date((a.data as Announcement).date).getTime()
                          : new Date((a.data as ServiceNotice).date).getTime();
                      const dateB =
                        b.type === "announcement"
                          ? new Date((b.data as Announcement).date).getTime()
                          : new Date((b.data as ServiceNotice).date).getTime();
                      return dateB - dateA;
                    });

                    if (combined.length === 0) {
                      return (
                        <div className="text-center py-4">
                          <p className="text-sm text-neutral-600">
                            공지사항이 없습니다.
                          </p>
                        </div>
                      );
                    }

                    return combined.slice(0, 3).map((item) => {
                      if (item.type === "service") {
                        const notice = item.data as ServiceNotice;
                        return (
                          <div key={notice.slug} className="mb-2">
                            <Link href={`/service/notices/${notice.slug}`}>
                              <Card className="cursor-pointer hover:shadow-card-hover border border-neutral-200">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-neutral-900 mb-2">
                                      {notice.title}
                                    </h3>
                                    <p className="text-xs text-neutral-600 line-clamp-2 mb-2">
                                      {notice.excerpt || ""}
                                    </p>
                                    <div className="text-xs text-neutral-500">
                                      {notice.author} · {notice.date}
                                    </div>
                                  </div>
                                  <Icon
                                    name="megaphone"
                                    size={20}
                                    className="flex-shrink-0"
                                    color="rgb(82, 82, 82)"
                                    strokeWidth={1.5}
                                  />
                                </div>
                              </Card>
                            </Link>
                          </div>
                        );
                      } else {
                        const announcement = item.data as Announcement;
                        return (
                          <div key={announcement.id} className="mb-2">
                            <AnnouncementCard
                              announcement={announcement}
                              href={announcement.url}
                              external={true}
                            />
                          </div>
                        );
                      }
                    });
                  })()}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 학식 정보 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">학식</h2>
          <Link
            href="/campus/cafeteria"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>
        <div className="space-y-3">
          {cafeteriaLoading && <Skeleton count={2} />}

          {!cafeteriaLoading && todayInfo.isWeekend && (
            <StateCard
              type="info"
              message="오늘은 주말입니다. 주말을 알차게 보내보는건 어떨까요?"
            />
          )}

          {!cafeteriaLoading && !todayInfo.isWeekend && todayMenu && (
            <Link href="/campus/cafeteria">
              <Card className="cursor-pointer hover:shadow-card-hover bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green-700 mb-1">
                      오늘의 메뉴
                    </div>
                    <h3 className="font-semibold text-neutral-900 mb-2">
                      {todayMenu.location}
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">조식</p>
                        <p className="text-sm text-neutral-700">
                          {todayMenu.breakfast
                            .slice(0, 2)
                            .map((m) => m.name)
                            .join(", ")}{" "}
                          외
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">중식</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {todayMenu.lunch.a && (
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">
                                A 코너
                              </p>
                              <p className="text-neutral-700">
                                {todayMenu.lunch.a
                                  .slice(0, 1)
                                  .map((m) => m.name)
                                  .join(", ")}{" "}
                                외
                              </p>
                            </div>
                          )}
                          {todayMenu.lunch.b && (
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">
                                B 코너
                              </p>
                              <p className="text-neutral-700">
                                {todayMenu.lunch.b
                                  .slice(0, 1)
                                  .map((m) => m.name)
                                  .join(", ")}{" "}
                                외
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">석식</p>
                        <p className="text-sm text-neutral-700">
                          {todayMenu.dinner
                            .slice(0, 2)
                            .map((m) => m.name)
                            .join(", ")}{" "}
                          외
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          )}

          {!cafeteriaLoading &&
            !todayInfo.isWeekend &&
            todayInfo.dayOfWeek === 1 &&
            !todayMenu && (
              <Link href="/campus/cafeteria">
                <Card className="cursor-pointer hover:shadow-card-hover bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-400">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-yellow-700 mb-1">
                        오늘의 메뉴
                      </div>
                      <h3 className="font-semibold text-neutral-900 mb-2">
                        최신화 작업 중입니다
                      </h3>
                      <p className="text-sm text-yellow-700">
                        데이터가 준비되고 있습니다. 잠시만 기다려주세요.
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            )}
        </div>
      </div>

      {/* 오늘의 일정 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            오늘의 일정
          </h2>
          <Link
            href="/academic/schedule"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>
        <div className="space-y-4">
          {schedulesLoading && <Skeleton count={2} />}
          {!schedulesLoading && schedules && (
            <>
              {schedules.filter((schedule) => {
                const isToday =
                  schedule.startDate === todayInfo.dateStringDot ||
                  (todayInfo.dateStringDot >= schedule.startDate &&
                    todayInfo.dateStringDot <= schedule.endDate);
                return isToday;
              }).length === 0 ? (
                <div className="py-4 text-center text-neutral-600 text-sm">
                  오늘 일정이 없습니다.
                </div>
              ) : (
                schedules
                  .filter((schedule) => {
                    const isToday =
                      schedule.startDate === todayInfo.dateStringDot ||
                      (todayInfo.dateStringDot >= schedule.startDate &&
                        todayInfo.dateStringDot <= schedule.endDate);
                    return isToday;
                  })
                  .map((schedule) => (
                    <div key={schedule.id} className="mb-3">
                      <Link href="/academic/schedule">
                        <Card className="cursor-pointer hover:shadow-card-hover">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge
                                color={
                                  schedule.category === "exam" ? "red" : "blue"
                                }
                                size="sm"
                              >
                                {getCategoryLabel(schedule.category)}
                              </Badge>
                              <h3 className="font-semibold text-neutral-900 mt-2">
                                {schedule.title}
                              </h3>
                              <p className="text-xs text-neutral-600 mt-1">
                                {formatDate(schedule.startDate)} ~{" "}
                                {formatDate(schedule.endDate)}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-neutral-600">
                              {schedule.category === "exam" ? "시험" : "일정"}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    </div>
                  ))
              )}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
