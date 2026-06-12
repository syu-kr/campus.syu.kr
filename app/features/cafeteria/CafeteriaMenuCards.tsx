import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";
import { StateCard } from "@/app/components/StateCard";
import { isCafeteriaClosedDay, isClosedMealItems } from "@/lib/cafeteria";
import type { CafeteriaMenu, MenuItem } from "@/types";

type MealColor = "blue" | "green" | "red";

interface MealSectionProps {
  title: string;
  color: MealColor;
  items: MenuItem[];
  dividerColor?: string;
}

interface LunchSectionProps {
  lunch: CafeteriaMenu["lunch"];
  highlighted?: boolean;
}

function MealItemCard({ item }: { item: MenuItem }) {
  return (
    <div className="text-sm">
      <p className="text-neutral-700 font-medium">{item.name}</p>
      {item.calories && (
        <p className="text-xs text-neutral-500">{item.calories}kcal</p>
      )}
      {item.allergens && (
        <p className="text-xs text-red-600 flex items-center">
          <Icon
            name="alert-circle"
            size={14}
            className="mr-1 flex-shrink-0"
            color="rgb(220, 38, 38)"
          />
          {item.allergens.join(", ")}
        </p>
      )}
    </div>
  );
}

function MealSection({ title, color, items }: MealSectionProps) {
  if (isClosedMealItems(items)) {
    return (
      <div>
        <Badge color={color} size="sm" className="mb-2">
          {title}
        </Badge>
        <p className="text-sm text-neutral-600">운영 없음</p>
      </div>
    );
  }

  return (
    <div>
      <Badge color={color} size="sm" className="mb-2">
        {title}
      </Badge>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item, idx) => (
          <MealItemCard key={`${item.name}-${idx}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function LunchCorner({
  title,
  items,
  highlighted,
}: {
  title: string;
  items?: MenuItem[];
  highlighted?: boolean;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={`border border-green-200 rounded-lg p-3 ${
        highlighted ? "bg-white/50" : ""
      }`}
    >
      <p className="text-xs font-semibold text-green-700 mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <MealItemCard key={`${title}-${item.name}-${idx}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function LunchSection({ lunch, highlighted }: LunchSectionProps) {
  if (isClosedMealItems(lunch.a) && isClosedMealItems(lunch.b)) {
    return (
      <div>
        <Badge color="green" size="sm" className="mb-2">
          중식
        </Badge>
        <p className="text-sm text-neutral-600">운영 없음</p>
      </div>
    );
  }

  return (
    <div>
      <Badge color="green" size="sm" className="mb-2">
        중식
      </Badge>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LunchCorner title="A 코너" items={lunch.a} highlighted={highlighted} />
        <LunchCorner title="B 코너" items={lunch.b} highlighted={highlighted} />
      </div>
    </div>
  );
}

function MenuSections({
  menu,
  highlighted,
}: {
  menu: CafeteriaMenu;
  highlighted?: boolean;
}) {
  if (isCafeteriaClosedDay(menu)) {
    return (
      <StateCard
        type="info"
        title="운영하지 않는 날입니다"
        message="공휴일 또는 운영하지 않는 날로 식단이 제공되지 않습니다."
      />
    );
  }

  const dividerColor = highlighted ? "border-green-200" : "border-neutral-200";

  return (
    <div className="space-y-4">
      <MealSection title="조식" color="blue" items={menu.breakfast} />
      <hr className={dividerColor} />
      <LunchSection lunch={menu.lunch} highlighted={highlighted} />
      <hr className={dividerColor} />
      <MealSection title="석식" color="red" items={menu.dinner} />
    </div>
  );
}

export function CafeteriaInfoCards() {
  return (
    <>
      <Card className="mb-8 bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <div>
            <p className="font-semibold text-blue-900 mb-2">운영 시간</p>
            <div className="space-y-1 text-sm text-blue-800">
              <p>조식: 08:00 ~ 09:30</p>
              <p>중식: 11:30 ~ 14:00 (A/B 코너 운영)</p>
              <p>석식: 17:30 ~ 18:30 (금요일 휴무)</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-8 bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-900 flex items-start gap-2">
          <Icon
            name="alert-circle"
            size={16}
            className="flex-shrink-0 mt-0.5"
            color="rgb(161, 98, 7)"
          />
          <span>
            <strong>알레르기 정보:</strong> 음식 알레르기가 있다면 표시된
            항목을 참고하여 식사를 선택하세요. 제공 데이터 기준이므로 중증
            알레르기가 있다면 식당에 직접 확인하세요.
          </span>
        </p>
      </Card>
    </>
  );
}

export function CafeteriaNoticeCards() {
  return (
    <Card className="mt-8 bg-yellow-50 border border-yellow-200" hover={false}>
      <p className="text-sm text-yellow-900">
        <strong>알림:</strong> 현재 만나의 집 식단은 제공되지 않습니다.
      </p>
    </Card>
  );
}

export function TodayMenuCard({ menu }: { menu: CafeteriaMenu }) {
  return (
    <Card
      id="today-menu"
      className="mb-8 scroll-mt-24 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-bold text-green-900">오늘의 메뉴</h2>
          <span className="text-green-700 font-semibold text-lg">
            ({menu.date})
          </span>
        </div>
        <p className="text-sm text-green-700">{menu.location}</p>
      </div>

      <MenuSections menu={menu} highlighted />
    </Card>
  );
}

export function WeeklyMenuCard({
  menu,
  isToday,
}: {
  menu: CafeteriaMenu;
  isToday: boolean;
}) {
  const scrollToTodayMenu = () => {
    if (!isToday) return;

    document
      .getElementById("today-menu")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card
      className={
        isToday
          ? "border-2 border-green-400 bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          : ""
      }
      clickable={isToday}
      role={isToday ? "button" : undefined}
      tabIndex={isToday ? 0 : undefined}
      aria-label={isToday ? "오늘의 메뉴로 이동" : undefined}
      onClick={scrollToTodayMenu}
      onKeyDown={(event) => {
        if (!isToday || (event.key !== "Enter" && event.key !== " ")) return;

        event.preventDefault();
        scrollToTodayMenu();
      }}
    >
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2
            className={`text-lg font-bold ${
              isToday ? "text-green-900" : "text-neutral-900"
            }`}
          >
            {menu.dayOfWeek}요일 ({menu.date})
            {isToday && (
              <span className="ml-2 text-green-700 font-semibold text-base">
                (오늘)
              </span>
            )}
          </h2>
        </div>
        <p className={`text-sm ${isToday ? "text-green-700" : "text-neutral-600"}`}>
          {menu.location}
        </p>
      </div>

      {isToday ? (
        <p className="text-sm text-green-800">
          오늘 식단은 위의 오늘의 메뉴에서 확인하세요.
        </p>
      ) : (
        <MenuSections menu={menu} highlighted={isToday} />
      )}
    </Card>
  );
}
