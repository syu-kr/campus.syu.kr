import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { getPublicContentAlias } from "@/lib/public-content-aliases";
import { formatShuttleAdditionalCountdown, formatShuttleAdditionalService, type NextShuttleDeparture } from "@/lib/shuttle-schedule";

export function ShuttleUpcomingDeparturesCard({ departures }: { departures: NextShuttleDeparture[] }) {
  const text = useDictionary().pages.busInfo;
  const locale = useLocale();
  if (!departures.length) return null;

  return (
    <Card as="section" aria-label={text.upcomingBuses} className="shuttle-upcoming mb-6 border border-neutral-200 bg-white">
      <div className="mb-3">
        <h2 className="mb-2 text-xs font-semibold text-neutral-600 sm:text-sm">{text.upcomingBuses}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {departures.map((bus, index) => {
          const extra = bus.additionalService && formatShuttleAdditionalService(bus.additionalService, locale);
          return (
            <div key={`${bus.routeName}-${bus.time}-${index}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900 sm:text-lg">{extra?.label ?? getPublicContentAlias(bus.routeName, locale)}</h3>
                {extra && <Badge color="purple" size="sm">{text.specialSchedule}</Badge>}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-700 sm:text-base">
                  {extra?.value ?? <><strong>{bus.time}</strong> {text.departs}</>}
                </p>
                <p className="text-sm font-semibold text-primary-700 sm:text-base">
                  {bus.additionalService
                    ? formatShuttleAdditionalCountdown(bus.additionalService, bus.minutesUntil, locale)
                    : `${bus.minutesUntil}${locale === "ko" ? "" : " "}${text.departsIn}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
