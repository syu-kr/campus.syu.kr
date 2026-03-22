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
      href: "/more/scholarship",
      bgColor: "from-blue-50 to-blue-100",
      borderColor: "border-blue-300",
      textColor: "text-blue-900",
    },
    {
      id: "2",
      title: "서비스 공지",
      description: "SYU CAMPUS 서비스 공지",
      icon: "📢",
      href: "/service/notices",
      bgColor: "from-green-50 to-green-100",
      borderColor: "border-green-300",
      textColor: "text-green-900",
    },
    {
      id: "3",
      title: "연락처 검색",
      description: "부서 및 담당자 연락처",
      icon: "☎️",
      href: "/more/phone",
      bgColor: "from-purple-50 to-purple-100",
      borderColor: "border-purple-300",
      textColor: "text-purple-900",
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
            <Card
              className={`cursor-pointer hover:shadow-card-hover h-full bg-gradient-to-br ${menu.bgColor} border-2 ${menu.borderColor}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl flex-shrink-0">{menu.icon}</span>
                <div className="flex-1">
                  <h3 className={`font-semibold ${menu.textColor} text-lg`}>
                    {menu.title}
                  </h3>
                  <p className={`text-sm ${menu.textColor} opacity-75 mt-1`}>
                    {menu.description}
                  </p>
                </div>
                <span className={`text-lg ${menu.textColor} flex-shrink-0`}>
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
