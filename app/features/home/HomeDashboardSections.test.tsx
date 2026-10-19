import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import { HomeNoticesSection, TodaySchedulesSection } from "./HomeDashboardSections";

describe.each(["ko", "en"] as const)("remaining home sections for %s", (locale) => {
  it.each(["notices", "schedules"] as const)("retains the localized error and retry for %s", (section) => {
    const dictionary = getDictionary(locale);
    const onRetry = vi.fn();
    render(
      <ClientLocaleProvider locale={locale} dictionary={dictionary}>
        {section === "notices" ? (
          <HomeNoticesSection onCategoryChange={vi.fn()} serviceNotices={[]}
            serviceNoticesLoading={false} announcementsLoading={false}
            hasError onRetry={onRetry} homeNotices={[]} />
        ) : (
          <TodaySchedulesSection isLoading={false} isError onRetry={onRetry} schedules={[]} />
        )}
      </ClientLocaleProvider>,
    );

    expect(screen.getByText(dictionary.home.dashboard.loadFailedMessage)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionary.home.dashboard.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText(section === "notices"
      ? dictionary.home.notices.emptyCategory
      : dictionary.home.dashboard.scheduleEmpty)).not.toBeInTheDocument();
  });
});
