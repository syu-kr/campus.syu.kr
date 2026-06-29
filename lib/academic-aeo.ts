import type { AnswerSummary } from "@/app/components/AnswerSummaryCard";
import { getDictionary, type Locale } from "@/lib/i18n";
import { isScheduleOnDate, type TodayInfo } from "@/lib/home";
import { formatDateRange } from "@/lib/utils";
import type { AcademicSchedule, PhoneNumber } from "@/types";

type GraduationMetadata = {
  sourceTitle: string;
  lastVerifiedAt: string;
};

export function createAcademicScheduleAnswerSummary({
  locale,
  now,
  schedules,
  todayInfo,
}: {
  locale: Locale;
  now: Date;
  schedules: AcademicSchedule[];
  todayInfo: TodayInfo;
}): AnswerSummary {
  const dictionary = getDictionary(locale);
  const text = dictionary.pages.academicSchedule;
  const answerText = text.answer;
  const todaySchedules = schedules
    .filter((schedule) => isScheduleOnDate(schedule, todayInfo.dateStringDot))
    .sort(compareScheduleDates);
  const nextSchedule = schedules
    .filter(
      (schedule) =>
        schedule.endDate >= todayInfo.dateStringDot &&
        !isScheduleOnDate(schedule, todayInfo.dateStringDot),
    )
    .sort(compareScheduleDates)[0];
  const todayLabel = formatDateRange(
    todayInfo.dateStringDot,
    todayInfo.dateStringDot,
    locale,
  );
  const nextScheduleText = nextSchedule
    ? applyTemplate(answerText.nextSchedule, {
        date: formatDateRange(
          nextSchedule.startDate,
          nextSchedule.endDate,
          locale,
        ),
        title: nextSchedule.title,
      })
    : answerText.noNext;
  const answer = todaySchedules.length
    ? applyTemplate(answerText.today, {
        date: todayLabel,
        items: formatScheduleTitleList(todaySchedules, locale),
        next: nextScheduleText,
      })
    : applyTemplate(answerText.noToday, {
        date: todayLabel,
        next: nextScheduleText,
      });

  return {
    eyebrow: answerText.eyebrow,
    title: answerText.title,
    question: answerText.question,
    answer,
    source: answerText.source,
    updatedAt: formatUpdatedAt(now, locale, answerText.updatedPrefix),
    items: [
      {
        label: answerText.dateLabel,
        value: todayLabel,
      },
      {
        label: answerText.todayCountLabel,
        value: todaySchedules.length.toLocaleString(
          locale === "ko" ? "ko-KR" : "en-US",
        ),
      },
      {
        label: answerText.nextScheduleLabel,
        value: nextSchedule ? nextSchedule.title : answerText.noNextShort,
      },
    ],
  };
}

export function createGraduationAnswerSummary({
  locale,
  metadata,
  now,
}: {
  locale: Locale;
  metadata: GraduationMetadata;
  now: Date;
}): AnswerSummary {
  const dictionary = getDictionary(locale);
  const answerText = dictionary.pages.graduation.answer;

  return {
    eyebrow: answerText.eyebrow,
    title: answerText.title,
    question: answerText.question,
    answer: applyTemplate(answerText.body, {
      lastVerifiedAt: metadata.lastVerifiedAt,
      sourceTitle: metadata.sourceTitle,
    }),
    source: applyTemplate(answerText.source, {
      sourceTitle: metadata.sourceTitle,
    }),
    updatedAt: formatUpdatedAt(now, locale, answerText.updatedPrefix),
    items: [
      {
        label: answerText.sourceLabel,
        value: metadata.sourceTitle,
      },
      {
        label: answerText.verifiedLabel,
        value: metadata.lastVerifiedAt,
      },
      {
        label: answerText.cautionLabel,
        value: answerText.cautionValue,
      },
    ],
  };
}

export function createPhoneAnswerSummary({
  locale,
  now,
  phoneNumbers,
}: {
  locale: Locale;
  now: Date;
  phoneNumbers: PhoneNumber[];
}): AnswerSummary {
  const dictionary = getDictionary(locale);
  const answerText = dictionary.pages.phone.answer;
  const academicContact =
    phoneNumbers.find(
      (phone) =>
        phone.department.includes("학사지원팀") ||
        phone.description?.includes("학적"),
    ) ?? phoneNumbers[0];
  const scholarshipContact = phoneNumbers.find((phone) =>
    phone.description?.includes("장학"),
  );
  const contact = academicContact ?? scholarshipContact;
  const answer = contact
    ? applyTemplate(answerText.body, {
        count: phoneNumbers.length.toLocaleString(
          locale === "ko" ? "ko-KR" : "en-US",
        ),
        department: contact.department,
        description: contact.description ?? answerText.noDescription,
        phone: contact.phone,
      })
    : answerText.emptyBody;

  return {
    eyebrow: answerText.eyebrow,
    title: answerText.title,
    question: answerText.question,
    answer,
    source: answerText.source,
    updatedAt: formatUpdatedAt(now, locale, answerText.updatedPrefix),
    items: [
      {
        label: answerText.totalLabel,
        value: applyTemplate(answerText.totalValue, {
          count: phoneNumbers.length.toLocaleString(
            locale === "ko" ? "ko-KR" : "en-US",
          ),
        }),
      },
      ...(academicContact
        ? [
            {
              label: answerText.academicLabel,
              value: formatPhoneContact(academicContact, answerText),
            },
          ]
        : []),
      ...(scholarshipContact
        ? [
            {
              label: answerText.scholarshipLabel,
              value: formatPhoneContact(scholarshipContact, answerText),
            },
          ]
        : []),
    ],
  };
}

function formatScheduleTitleList(
  schedules: AcademicSchedule[],
  locale: Locale,
) {
  const dictionary = getDictionary(locale);
  const answerText = dictionary.pages.academicSchedule.answer;
  const visibleSchedules = schedules.slice(0, 3);
  const visibleText = visibleSchedules
    .map((schedule) => schedule.title)
    .join(answerText.itemSeparator);
  const remainingCount = schedules.length - visibleSchedules.length;

  if (remainingCount <= 0) return visibleText;

  return `${visibleText}${applyTemplate(answerText.moreSuffix, {
    count: remainingCount.toLocaleString(locale === "ko" ? "ko-KR" : "en-US"),
  })}`;
}

function formatPhoneContact(
  contact: PhoneNumber,
  answerText: ReturnType<typeof getDictionary>["pages"]["phone"]["answer"],
) {
  return applyTemplate(answerText.contactValue, {
    department: contact.department,
    description: contact.description ?? answerText.noDescription,
    phone: contact.phone,
  });
}

function compareScheduleDates(a: AcademicSchedule, b: AcademicSchedule) {
  return a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate);
}

function formatUpdatedAt(now: Date, locale: Locale, prefix: string) {
  const dateTime = new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    },
  ).format(now);

  return `${prefix} ${dateTime}`;
}

function applyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
