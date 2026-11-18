import { expect, it } from "vitest";
import { createGraduationAnswerSummary, createPhoneAnswerSummary } from "./academic-aeo";
import { getDictionary } from "./i18n";

it.each(["ko", "en"] as const)("keeps verified graduation facts separate from request time in %s", locale => {
  const summary = createGraduationAnswerSummary({ text: getDictionary(locale).pages.graduation.answer, metadata: { sourceTitle: "2026학년도 요람", lastVerifiedAt: "2026-09-14" } });
  expect(summary.answer).toContain("2026학년도 요람");
  expect(summary.answer).toContain("2026-09-14");
  expect(summary.answer).toContain("SU-WINGs");
  expect(summary).not.toHaveProperty("updatedAt");
});

it.each(["ko", "en"] as const)("answers academic contact questions using the matching department in %s", locale => {
  const summary = createPhoneAnswerSummary({ locale, text: getDictionary(locale).pages.phone.answer, phoneNumbers: [
    { department: "도서관", phone: "02-3399-3055", description: "도서 대출" },
    { department: "교무처 학사지원팀", phone: "02-3399-3153", description: "졸업·학적·수업·증명서" },
  ] });
  expect(summary.answer).toContain("02-3399-3153");
  expect(summary.answer).not.toContain("02-3399-3055");
  expect(summary).not.toHaveProperty("updatedAt");
});

it.each(["ko", "en"] as const)("never labels another department as an academic contact in %s", locale => {
  expect(createPhoneAnswerSummary({ locale, text: getDictionary(locale).pages.phone.answer, phoneNumbers: [{ department: "학생복지팀", phone: "02-3399-3225", description: "장학" }] }).answer)
    .toBe(getDictionary(locale).pages.phone.answer.academicUnavailableBody);
  expect(createPhoneAnswerSummary({ locale, text: getDictionary(locale).pages.phone.answer, phoneNumbers: [] }).answer)
    .toBe(getDictionary(locale).pages.phone.answer.emptyBody);
});
