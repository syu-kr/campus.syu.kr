// 유틸리티 함수들

/**
 * 날짜 포맷팅 (YYYY-MM-DD to MM.DD)
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}.${day}`;
  } catch {
    return dateString;
  }
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD to YYYY.MM.DD)
 */
export function formatDateWithYear(dateString: string): string {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  } catch {
    return dateString;
  }
}

/**
 * 날짜 한글 포맷팅 (2024년 1월 15일)
 */
export function formatDateKorean(dateString: string): string {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return dateString;
  }
}

/**
 * 상대적 시간 (1분 전, 1시간 전 등)
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return formatDate(dateString);
}

/**
 * 조회수 포맷팅 (1234 to 1.2K)
 */
export function formatViews(views: number): string {
  if (views < 1000) return views.toString();
  if (views < 1000000) return `${(views / 1000).toFixed(1)}K`;
  return `${(views / 1000000).toFixed(1)}M`;
}

/**
 * 숫자 포맷팅 (가격: 3000000 to 3,000,000)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

/**
 * 카테고리 한글 레이블
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    academic: "학사공지",
    scholarship: "장학금",
    campus: "캠퍼스",
    admin: "행정",
    activity: "학생활동",
    registration: "수강신청",
    exam: "시험",
    holiday: "휴무",
    event: "행사",
    internal: "교내",
    external: "교외",
  };
  return labels[category] || category;
}

/**
 * 카테고리 색상
 */
export function getCategoryColor(
  category: string,
): "blue" | "red" | "green" | "yellow" | "purple" {
  const colors: Record<string, "blue" | "red" | "green" | "yellow" | "purple"> =
    {
      academic: "blue",
      scholarship: "yellow",
      campus: "green",
      admin: "purple",
      activity: "yellow",
      registration: "blue",
      exam: "red",
      holiday: "green",
      event: "yellow",
      internal: "blue",
      external: "green",
    };
  return colors[category] || "blue";
}

/**
 * 날짜 범위 바꾸기
 */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDateKorean(start);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}
