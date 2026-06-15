import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import Link from "next/link";
import { Icon } from "@/app/components/Icon";

export default function MorePage() {
  const moreMenus = [
    {
      id: "service-notices",
      title: "서비스 공지",
      description: "SYU CAMPUS 서비스 공지",
      iconName: "megaphone",
      href: "/service/notices",
    },
    {
      id: "meet",
      title: "일정 잡기",
      description: "초대 링크로 가능한 시간 찾기",
      iconName: "calendar",
      href: "/more/meet",
    },
    {
      id: "privacy",
      title: "알림 및 개인정보",
      description: "알림 권한과 분석 도구 안내",
      iconName: "info",
      href: "/more/privacy",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          더보기
        </h1>
        <p className="text-neutral-600">추가 기능을 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {moreMenus.map((menu) => (
          <Link key={menu.id} href={menu.href} className="block">
            <Card
              hover={false}
              className="cursor-pointer border border-neutral-200 bg-white transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-1 text-neutral-900">
                    {menu.title}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    {menu.description}
                  </p>
                </div>
                <span className="text-primary-600">
                  <Icon
                    name={menu.iconName}
                    size={28}
                    strokeWidth={1.75}
                    color="currentColor"
                  />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card
        hover={false}
        className="mt-6 border border-neutral-200 bg-neutral-50"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">번역 안내</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              외국어 번역이 필요하다면 Chrome, Edge, Safari의 브라우저 번역
              기능을 사용하세요. PWA 앱에서는 현재 페이지를 브라우저에서 연 뒤
              번역 메뉴를 사용할 수 있습니다.
            </p>
          </div>
          <span className="text-primary-600">
            <Icon name="info" size={24} strokeWidth={1.75} color="currentColor" />
          </span>
        </div>
      </Card>
    </Container>
  );
}
