"use client";

import type { ReactNode } from "react";
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
  action,
  className = "",
  compact = false,
}: {
  title: string;
  message: string;
  action?: ReactNode;
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
        {action && <div className="mt-3">{action}</div>}
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
  const operatingHours = [
    splitOperatingHour(text.breakfastHours),
    splitOperatingHour(text.lunchHours),
    splitOperatingHour(text.dinnerHours),
  ];

  return (
    <>
      <Card className="mb-6 border border-neutral-200 shadow-none" hover={false}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <Icon name="clock" size={18} color="currentColor" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 font-semibold text-neutral-900">
              {text.operationHours}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {operatingHours.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5"
                >
                  <p className="text-xs font-semibold text-neutral-500">
                    {item.label}
                  </p>
                  <p className="mt-1 break-keep text-sm font-medium leading-5 text-neutral-800">
                    {item.detail || item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
        <p className="flex items-start gap-2 text-sm leading-6 text-amber-900">
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
      </div>
    </>
  );
}

function splitOperatingHour(value: string) {
  const separatorIndex = value.indexOf(":");

  if (separatorIndex === -1) {
    return { label: value, detail: "" };
  }

  return {
    label: value.slice(0, separatorIndex).trim(),
    detail: value.slice(separatorIndex + 1).trim(),
  };
}

export function CafeteriaNoticeCards() {
  const text = useDictionary().pages.cafeteria;

  return (
    <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-sm leading-6 text-neutral-700">
        <strong>{text.noticeTitle}</strong> {text.mannaUnavailable}
      </p>
    </div>
  );
}

export function TodayMenuCard({ menu }: { menu: CafeteriaMenu }) {
  const text = useDictionary().pages.cafeteria;

  return (
    <Card
      id="today-menu"
      className="mb-8 scroll-mt-24 border border-neutral-200 shadow-none"
      hover={false}
    >
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge color="green" size="sm">
            {text.todayMarker}
          </Badge>
          <h2 className="text-xl font-bold text-neutral-900">
            {text.todayMenu}
          </h2>
          <span className="text-sm font-medium text-neutral-500">
            {menu.date}
          </span>
        </div>
        <p className="text-sm text-neutral-600">{menu.location}</p>
      </div>

      <MenuSections menu={menu} />
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
          ? "border border-neutral-200 bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
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
          <h2 className="text-lg font-bold text-neutral-900">
            {formatCafeteriaDay(menu.dayOfWeek, locale, text)} ({menu.date})
            {isToday && (
              <span className="ml-2 text-base font-semibold text-primary-700">
                ({text.todayMarker})
              </span>
            )}
          </h2>
        </div>
        <p className="text-sm text-neutral-600">
          {menu.location}
        </p>
      </div>

      {isToday ? (
        <p className="text-sm text-neutral-600">
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
