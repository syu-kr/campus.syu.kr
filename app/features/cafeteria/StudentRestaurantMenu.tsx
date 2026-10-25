"use client";

import { Badge } from "@/app/components/Badge";
import { Button } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { CafeteriaInfoCards, MealItemCard, TodayMenuCardFrame } from "@/app/features/cafeteria/CafeteriaMenuCards";
import { useStudentRestaurantMenu } from "@/app/features/cafeteria/useStudentRestaurantMenu";
import { getCafeteriaWeekMenus } from "@/lib/cafeteria";
import { type StudentRestaurantMenu as StudentRestaurantData } from "@/lib/student-restaurant";

function StudentRestaurantMeals({ day }: { day: StudentRestaurantData["days"][number] }) {
  const text = useDictionary().pages.cafeteria;
  return (
    <div className="space-y-4">
      {(["breakfast", "lunch", "dinner"] as const).map((meal, index) => (
        <div key={meal} className={index ? "border-t border-neutral-200 pt-4" : ""}>
          <Badge color={meal === "breakfast" ? "blue" : meal === "lunch" ? "green" : "red"} size="sm" className="mb-2">
            {text[meal]}
          </Badge>
          {day[meal] === null ? (
            <p className="text-sm text-neutral-600">{text.studentRestaurant.unknownMeal}</p>
          ) : day[meal].length === 0 ? (
            <p className="text-sm text-neutral-600">{text.closedMeal}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 text-sm text-neutral-700 sm:grid-cols-3">
              {day[meal].map((item, itemIndex) => <li key={`${item}-${itemIndex}`}><MealItemCard item={{ name: item }} /></li>)}
            </ul>
          )}
          {day.ingredients && (
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              <strong className="font-medium">{text.studentRestaurant.ingredientsTitle}</strong>{" "}
              {day.ingredients[meal] === null
                ? text.studentRestaurant.ingredientsUnavailable
                : day.ingredients[meal].length
                  ? day.ingredients[meal].join(", ")
                  : text.studentRestaurant.ingredientsNotListed}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function StudentRestaurantMenu({ today }: { today: string }) {
  const dictionary = useDictionary();
  const cafeteriaText = dictionary.pages.cafeteria;
  const text = cafeteriaText.studentRestaurant;
  const locale = useLocale();
  const { data, isPending, isError, refetch, isFetching, isConfigured } = useStudentRestaurantMenu();
  const weeklyMenus = getCafeteriaWeekMenus(data?.days, today);
  const todayMenu = data?.days.find((day) => day.date === today);
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const hasOtherWeek = Boolean(data?.days.length && weeklyMenus.length === 0);
  const latestDate = data?.days.at(-1)?.date;
  const isPreviousWeek = Boolean(latestDate && latestDate < today);
  const dateFormatter = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    weekday: "long", timeZone: "UTC",
  });

  return (
    <section aria-label={text.title}>
      <p className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">{text.extractionNote}</p>
      <section id="today-menu" className="scroll-mt-24 md:scroll-mt-40" aria-labelledby="manna-today-heading">
        {!todayMenu && <h2 id="manna-today-heading" className="mb-4 text-xl font-bold text-neutral-900">{cafeteriaText.todayMenu}</h2>}
        {!isConfigured && <StateCard type="info" className="mb-8" message={text.notConfigured} />}
        {isConfigured && isPending && (
          <div role="status" aria-busy="true" aria-label={text.loading}>
            <Skeleton count={1} height="200px" />
            <p className="sr-only">{text.loading}</p>
          </div>
        )}
        {isError && (
          <StateCard
            type="error"
            className="mb-8"
            title={text.errorTitle}
            message={text.errorMessage}
            action={<Button onClick={() => refetch()} disabled={isFetching}>{dictionary.home.dashboard.retry}</Button>}
          />
        )}
        {data && !todayMenu && <StateCard type="info" className="mb-8" message={isWeekend ? cafeteriaText.weekendMessage : cafeteriaText.missingToday} />}
        {todayMenu && (
          <TodayMenuCardFrame date={todayMenu.date} location={text.title} headingId="manna-today-heading">
            <StudentRestaurantMeals day={todayMenu} />
          </TodayMenuCardFrame>
        )}
      </section>

      <CafeteriaInfoCards restaurant="manna" />

      <section className="mb-8" aria-labelledby="manna-weekly-heading">
        <h2 id="manna-weekly-heading" className="mb-4 text-lg font-bold text-neutral-900">{cafeteriaText.weeklyMenu}</h2>
        {isConfigured && isPending && <Skeleton count={3} height="200px" />}
        {hasOtherWeek && (
          <StateCard
            type="warning"
            title={isPreviousWeek ? text.staleTitle : text.upcomingTitle}
            message={isPreviousWeek ? text.staleMessage : text.upcomingMessage}
          />
        )}
        {data?.days.length === 0 && <StateCard type="info" message={text.empty} />}
        <div className="space-y-6">
          {weeklyMenus.map((day) => (
            <Card key={day.date} hover={false} className={day.date === today ? "border border-neutral-200 bg-neutral-50" : ""}>
              <div className="mb-4">
                <h3 className="mb-2 text-lg font-bold text-neutral-900">
                  {dateFormatter.format(new Date(`${day.date}T00:00:00Z`))}{" "}
                  (<time dateTime={day.date}>{day.date}</time>)
                  {day.date === today && <span className="ml-2 text-base font-semibold text-primary-700">({cafeteriaText.todayMarker})</span>}
                </h3>
                <p className="text-sm text-neutral-600">{text.title}</p>
              </div>
              {day.date === today ? (
                <button
                  type="button"
                  className="text-left text-sm text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  onClick={() => document.getElementById("today-menu")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  {cafeteriaText.todayMenuRedirect}
                </button>
              ) : <StudentRestaurantMeals day={day} />}
            </Card>
          ))}
        </div>
      </section>

    </section>
  );
}
