"use client";

import type { ReactNode } from "react";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { isCafeteriaClosedDay, isClosedMealItems } from "@/lib/cafeteria";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { CafeteriaMenu, MenuItem } from "@/types";
import { PublicContentTranslation } from "@/app/components/ContentTranslation";

type MealColor = "blue" | "green" | "red";
type CafeteriaDictionary = Dictionary["pages"]["cafeteria"];

interface MealSectionProps {
  title: string;
  color: MealColor;
  items: MenuItem[];
  dividerColor?: string;
  menuId: string;
  meal: "breakfast" | "dinner";
}

interface LunchSectionProps {
  lunch: CafeteriaMenu["lunch"];
  highlighted?: boolean;
  menuId: string;
}

export function MealItemCard({ item, name = item.name, allergens = item.allergens, lang = "ko" }: { item: MenuItem; name?: string; allergens?: string[]; lang?: string }) {
  return (
    <div className="text-sm">
      <p lang={lang} className="text-neutral-700 font-medium">{name}</p>
      {item.calories && (
        <p className="text-xs text-neutral-500">{item.calories}kcal</p>
      )}
      {allergens && (
        <p lang={lang} className="text-xs text-red-600 flex items-center">
          <Icon
            name="alert-circle"
            size={14}
            className="mr-1 flex-shrink-0"
            color="rgb(220, 38, 38)"
          />
          {allergens.join(", ")}
        </p>
      )}
    </div>
  );
}

function mealFields(items: MenuItem[], prefix: string) {
  return Object.fromEntries(items.flatMap((item, index) => [[`${prefix}.${index}`, item.name], ...(item.allergens ?? []).map((allergen, allergenIndex) => [`allergens.${prefix}.${index}.${allergenIndex}`, allergen])]));
}

function MealSection({ title, color, items, menuId, meal }: MealSectionProps) {
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
      <PublicContentTranslation source={{ kind: "cafeteria", id: menuId }}
        content={mealFields(items, meal)}>{translation => <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item, idx) => (
          <MealItemCard key={`${item.name}-${idx}`} item={item} name={translation.text(`${meal}.${idx}`, item.name)} allergens={item.allergens?.map((allergen, index) => translation.text(`allergens.${meal}.${idx}.${index}`, allergen))} lang={translation.lang} />
        ))}
      </div>}</PublicContentTranslation>
    </div>
  );
}

function LunchCorner({
  title,
  items,
  highlighted,
  menuId,
  corner,
}: {
  title: string;
  items?: MenuItem[];
  highlighted?: boolean;
  menuId: string;
  corner: "a" | "b";
}) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={`border border-green-200 rounded-lg p-3 ${
        highlighted ? "bg-white/50" : ""
      }`}
    >
      <p className="text-xs font-semibold text-green-700 mb-2">{title}</p>
      <PublicContentTranslation source={{ kind: "cafeteria", id: menuId }}
        content={mealFields(items, `lunch.${corner}`)}>{translation => <div className="space-y-2">
        {items.map((item, idx) => (
          <MealItemCard key={`${title}-${item.name}-${idx}`} item={item} name={translation.text(`lunch.${corner}.${idx}`, item.name)} allergens={item.allergens?.map((allergen, index) => translation.text(`allergens.lunch.${corner}.${idx}.${index}`, allergen))} lang={translation.lang} />
        ))}
      </div>}</PublicContentTranslation>
    </div>
  );
}

function LunchSection({ lunch, highlighted, menuId }: LunchSectionProps) {
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
        <LunchCorner title={text.cornerA} items={lunch.a} highlighted={highlighted} menuId={menuId} corner="a" />
        <LunchCorner title={text.cornerB} items={lunch.b} highlighted={highlighted} menuId={menuId} corner="b" />
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
      <MealSection title={text.breakfast} color="blue" items={menu.breakfast} menuId={menu.id} meal="breakfast" />
      <hr className={dividerColor} />
      <LunchSection lunch={menu.lunch} highlighted={highlighted} menuId={menu.id} />
      <hr className={dividerColor} />
      <MealSection title={text.dinner} color="red" items={menu.dinner} menuId={menu.id} meal="dinner" />
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

export function CafeteriaInfoCards({ restaurant = "su-lounge" }: { restaurant?: "su-lounge" | "manna" }) {
  const text = useDictionary().pages.cafeteria;
  const hours = restaurant === "manna" ? text.studentRestaurant : text;
  const operatingHours = [hours.breakfastHours, hours.lunchHours, hours.dinnerHours].map(splitOperatingHour);

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
            <strong>{text.allergyTitle}</strong> {restaurant === "manna" ? text.studentRestaurant.allergyMessage : text.allergyMessage}
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
        <strong>{text.noticeTitle}</strong> {text.restaurantNotice}
      </p>
    </div>
  );
}

export function TodayMenuCardFrame({
  date,
  location,
  children,
  headingId,
}: {
  date: string;
  location: string;
  children: ReactNode;
  headingId?: string;
}) {
  const text = useDictionary().pages.cafeteria;

  return (
    <Card
      className="mb-8 border border-neutral-200 shadow-none"
      hover={false}
    >
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge color="green" size="sm">
            {text.todayMarker}
          </Badge>
          <h2 id={headingId} className="text-xl font-bold text-neutral-900">
            {text.todayMenu}
          </h2>
          <span className="text-sm font-medium text-neutral-600">
            {date}
          </span>
        </div>
        <p className="text-sm text-neutral-600">{location}</p>
      </div>

      {children}
    </Card>
  );
}

export function TodayMenuCard({ menu }: { menu: CafeteriaMenu }) {
  return (
    <PublicContentTranslation source={{ kind: "cafeteria", id: menu.id }} content={{ location: menu.location }}>{translation => <TodayMenuCardFrame date={menu.date} location={translation.text("location", menu.location)}>
      <MenuSections menu={menu} />
    </TodayMenuCardFrame>}</PublicContentTranslation>
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
        <PublicContentTranslation source={{ kind: "cafeteria", id: menu.id }} content={{ location: menu.location }}>{translation => <p lang={translation.lang} className="text-sm text-neutral-600">{translation.text("location", menu.location)}</p>}</PublicContentTranslation>
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
