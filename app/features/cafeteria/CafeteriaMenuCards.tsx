"use client";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { isCafeteriaClosedDay, isClosedMealItems } from "@/lib/cafeteria";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { CafeteriaMenu, MenuItem } from "@/types";

type MealColor = "blue" | "green" | "red";
type CafeteriaDictionary = Dictionary["pages"]["cafeteria"];

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
  const text = useDictionary().pages.cafeteria;

  if (isClosedMealItems(items)) {
    return (
      <div>
        <Badge color={color} size="sm" className="mb-2">
          {title}
        </Badge>
        <p className="text-sm text-neutral-600">{text.closedMeal}</p>
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
  const text = useDictionary().pages.cafeteria;

  if (isClosedMealItems(lunch.a) && isClosedMealItems(lunch.b)) {
    return (
      <div>
        <Badge color="green" size="sm" className="mb-2">
          {text.lunch}
        </Badge>
        <p className="text-sm text-neutral-600">{text.closedMeal}</p>
      </div>
    );
  }

  return (
    <div>
      <Badge color="green" size="sm" className="mb-2">
        {text.lunch}
      </Badge>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LunchCorner title={text.cornerA} items={lunch.a} highlighted={highlighted} />
        <LunchCorner title={text.cornerB} items={lunch.b} highlighted={highlighted} />
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
  const text = useDictionary().pages.cafeteria;

  if (isCafeteriaClosedDay(menu)) {
    return (
      <CafeteriaClosedCard
        compact
        title={text.closedDayTitle}
        message={text.closedDayMessage}
      />
    );
  }

  const dividerColor = highlighted ? "border-green-200" : "border-neutral-200";

  return (
    <div className="space-y-4">
      <MealSection title={text.breakfast} color="blue" items={menu.breakfast} />
      <hr className={dividerColor} />
      <LunchSection lunch={menu.lunch} highlighted={highlighted} />
      <hr className={dividerColor} />
      <MealSection title={text.dinner} color="red" items={menu.dinner} />
    </div>
  );
}

export function CafeteriaClosedCard({
  title,
  message,
  className = "",
  compact = false,
}: {
  title: string;
  message: string;
  className?: string;
  compact?: boolean;
}) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <Icon name="utensils" size={18} color="currentColor" />
      </div>
      <div className="min-w-0">
        <h3 className="mb-1 text-base font-semibold text-neutral-900">
          {title}
        </h3>
        <p className="text-sm leading-6 text-neutral-600">{message}</p>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div
        className={`rounded-lg border border-neutral-200 bg-neutral-50 p-4 ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Card
      hover={false}
      className={`border border-neutral-200 bg-neutral-50 shadow-none ${className}`}
    >
      {content}
    </Card>
  );
}

export function CafeteriaInfoCards() {
  const text = useDictionary().pages.cafeteria;

  return (
    <>
      <Card className="mb-8 bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <div>
            <p className="font-semibold text-blue-900 mb-2">
              {text.operationHours}
            </p>
            <div className="space-y-1 text-sm text-blue-800">
              <p>{text.breakfastHours}</p>
              <p>{text.lunchHours}</p>
              <p>{text.dinnerHours}</p>
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
            <strong>{text.allergyTitle}</strong> {text.allergyMessage}
          </span>
        </p>
      </Card>
    </>
  );
}

export function CafeteriaNoticeCards() {
  const text = useDictionary().pages.cafeteria;

  return (
    <Card className="mt-8 bg-yellow-50 border border-yellow-200" hover={false}>
      <p className="text-sm text-yellow-900">
        <strong>{text.noticeTitle}</strong> {text.mannaUnavailable}
      </p>
    </Card>
  );
}

export function TodayMenuCard({ menu }: { menu: CafeteriaMenu }) {
  const text = useDictionary().pages.cafeteria;

  return (
    <Card
      id="today-menu"
      className="mb-8 scroll-mt-24 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-bold text-green-900">{text.todayMenu}</h2>
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
  const text = useDictionary().pages.cafeteria;
  const locale = useLocale();

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
      aria-label={isToday ? text.todayMenuAria : undefined}
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
            {formatCafeteriaDay(menu.dayOfWeek, locale, text)} ({menu.date})
            {isToday && (
              <span className="ml-2 text-green-700 font-semibold text-base">
                ({text.todayMarker})
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
          {text.todayMenuRedirect}
        </p>
      ) : (
        <MenuSections menu={menu} highlighted={isToday} />
      )}
    </Card>
  );
}

function formatCafeteriaDay(
  dayOfWeek: string,
  locale: Locale,
  text: CafeteriaDictionary,
) {
  if (locale === "ko") return `${dayOfWeek}${text.daySuffix}`;

  const labels: Record<string, string> = {
    월: "Mon",
    화: "Tue",
    수: "Wed",
    목: "Thu",
    금: "Fri",
    토: "Sat",
    일: "Sun",
  };

  return labels[dayOfWeek] ?? dayOfWeek;
}
