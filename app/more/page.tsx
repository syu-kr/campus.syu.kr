import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function MorePage() {
  const moreMenus = [
    {
      id: "1",
      title: "연락처 검색",
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {moreMenus.map((menu) => (
          <a
            key={menu.id}
            href={menu.href}
            className="flex flex-col items-center justify-center py-6 rounded-lg hover:bg-primary-50 transition-colors border border-neutral-200"
          >
            <span className="text-3xl mb-2">{menu.icon}</span>
            <span className="text-sm font-medium text-center text-neutral-900">
              {menu.title}
            </span>
          </a>
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
