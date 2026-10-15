"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/app/components/Badge";
import { Button } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { getCafeteriaWeekMenus } from "@/lib/cafeteria";
import { fetchJson } from "@/lib/fetch-json";
import { parseStudentRestaurantMenu, parseStudentRestaurantPublicUrl, type StudentRestaurantMenu as StudentRestaurantData } from "@/lib/student-restaurant";

async function fetchStudentRestaurantMenu(jsonUrl: string) {
  const url = parseStudentRestaurantPublicUrl(jsonUrl);
  const value = await fetchJson<unknown>(url.href, {
    fallback: null,
    throwOnError: true,
    timeoutMs: 12_000,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  return parseStudentRestaurantMenu(value);
}

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
              {day[meal].map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}
            </ul>
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
  const jsonUrl = process.env.NEXT_PUBLIC_CAFETERIA_JSON_URL?.trim() ?? "";
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["student-restaurant", jsonUrl],
    queryFn: () => fetchStudentRestaurantMenu(jsonUrl),
    enabled: Boolean(jsonUrl),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  const weeklyMenus = getCafeteriaWeekMenus(data?.days, today);
  const todayMenu = weeklyMenus.find((day) => day.date === today);
  const hasOtherWeek = Boolean(data?.days.length && weeklyMenus.length === 0);
  const latestDate = data?.days.at(-1)?.date;
  const isPreviousWeek = Boolean(latestDate && latestDate < today);
  const dateFormatter = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    weekday: "long", timeZone: "UTC",
  });

  return (
    <section aria-label={text.title}>
      <section id="today-menu" className="mb-8 scroll-mt-24 md:scroll-mt-40" aria-labelledby="manna-today-heading">
        <h2 id="manna-today-heading" className="mb-4 text-xl font-bold text-neutral-900">{cafeteriaText.todayMenu}</h2>
        {!jsonUrl && <StateCard type="info" message={text.notConfigured} />}
        {jsonUrl && isPending && (
          <div role="status" aria-busy="true" aria-label={text.loading}>
            <Skeleton count={1} height="200px" />
            <p className="sr-only">{text.loading}</p>
          </div>
        )}
        {isError && (
          <StateCard
            type="error"
            title={text.errorTitle}
            message={text.errorMessage}
            action={<Button onClick={() => refetch()} disabled={isFetching}>{dictionary.home.dashboard.retry}</Button>}
          />
        )}
        {data && !todayMenu && <StateCard type="info" message={cafeteriaText.missingToday} />}
        {todayMenu && (
          <Card hover={false} className="border border-neutral-200 shadow-none">
            <div className="mb-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge color="green" size="sm">{cafeteriaText.todayMarker}</Badge>
                <time className="text-sm font-medium text-neutral-500" dateTime={todayMenu.date}>{todayMenu.date}</time>
              </div>
              <p className="text-sm text-neutral-600">{text.title}</p>
            </div>
            <StudentRestaurantMeals day={todayMenu} />
          </Card>
        )}
      </section>

      <section className="mb-8" aria-labelledby="manna-weekly-heading">
        <h2 id="manna-weekly-heading" className="mb-4 text-lg font-bold text-neutral-900">{cafeteriaText.weeklyMenu}</h2>
        {jsonUrl && isPending && <Skeleton count={3} height="200px" />}
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

      <p className="text-sm leading-6 text-neutral-600">{text.extractionNote}</p>
      {data && (
        <p className="mt-2 text-xs text-neutral-500">
          {text.updatedAt}{" "}
          <time dateTime={data.updatedAt}>
            {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
              dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul",
            }).format(new Date(data.updatedAt))}
          </time>{" "}{text.koreaTime}
        </p>
      )}
    </section>
  );
}
