import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import Link from "next/link";

export default function MorePage() {
  const moreMenus = [
    {
      id: "1",
      title: "장학금",
      description: "장학금 공지 및 신청",
      icon: "🎓",
      href: "/tuition/scholarship",
    },
    {
      id: "2",
      title: "서비스 공지",
      description: "SYU CAMPUS 서비스 공지",
      icon: "📢",
      href: "/service/notices",
    },
    {
      id: "3",
      title: "연락처 검색",
      description: "부서 및 담당자 연락처",
      icon: "☎️",
      href: "/admin/directory",
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {moreMenus.map((menu) => (
          <Link key={menu.id} href={menu.href}>
            <Card className="cursor-pointer hover:shadow-card-hover h-full">
              <div className="flex items-start gap-4">
                <span className="text-4xl flex-shrink-0">{menu.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900 text-lg">
                    {menu.title}
                  </h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    {menu.description}
                  </p>
                </div>
                <span className="text-lg text-neutral-400 flex-shrink-0">
                  →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          🚧 <strong>개발 예정:</strong> 더 많은 기능이 준비 중입니다.
        </p>
      </Card>
    </Container>
  );
}
