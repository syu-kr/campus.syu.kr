"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/app/components/Modal";
import { buttonStyles } from "@/app/components/Button";
import { Icon } from "@/app/components/Icon";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { useContentTranslation, PublicContentTranslation } from "@/app/components/ContentTranslation";
import { getVisibleTimetableDays } from "@/lib/timetable-display";
import type { LectureDay, LectureTimeSlot, LectureTimetableCourse } from "@/lib/lecture-timetable";
import "./academic-presentation.css";

interface Props {
  contextLabel?: string;
  referenceCourses?: LectureTimetableCourse[];
  selectedCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  dayLabel: (day: LectureDay) => string;
  periodLabel: (period: number) => string;
  periodTimeLabel: (period: number) => string;
  completionLabel: (value: string) => string;
  renderWeek: (onOpenCourse?: (course: LectureTimetableCourse) => void) => ReactNode;
}

export function publicCourseFields(course: LectureTimetableCourse) {
  return { courseName: course.courseName, departmentName: course.departmentName ?? "", collegeName: course.collegeName ?? "", areaType: course.areaType ?? "", place: course.place ?? "", note: course.note ?? "" };
}

function TranslatedCourse({ course, children }: { course: LectureTimetableCourse; children: (translation: ReturnType<typeof useContentTranslation>) => ReactNode }) {
  return <PublicContentTranslation source={{ kind: "course", id: course.id }} content={publicCourseFields(course)}>{children}</PublicContentTranslation>;
}

export function getAcademicAgendaRows(courses: LectureTimetableCourse[], day: LectureDay) {
  return courses.flatMap((course) => course.timeSlots
    .filter((slot) => slot.day === day)
    .map((slot, index) => ({ course, slot, key: `${course.id}-${slot.startPeriod}-${slot.endPeriod}-${index}` })))
    .sort((first, second) => first.slot.startPeriod - second.slot.startPeriod || first.slot.endPeriod - second.slot.endPeriod);
}

export function getAcademicSlotTime(slot: LectureTimeSlot, periodTimeLabel: (period: number) => string) {
  const start = periodTimeLabel(slot.startPeriod).split("-")[0];
  const end = periodTimeLabel(slot.endPeriod).split("-").at(-1);
  return { start, end, label: `${start}–${end}` };
}

export function AcademicTimetableCell({ course, onOpenCourse, className, children }: {
  course: LectureTimetableCourse;
  onOpenCourse?: (course: LectureTimetableCourse) => void;
  className?: string;
  children: ReactNode;
}) {
  const text = useDictionary().pages.timetable.presentation;
  const translation = useContentTranslation({ kind: "course", id: course.id }, { courseName: course.courseName });
  if (!onOpenCourse) return <div className={className}>{children}</div>;
  return (
    <button type="button" className={`m3-academic-week-course ${className || ""}`}
      onClick={() => onOpenCourse(course)} aria-label={`${translation.text("courseName", course.courseName)} ${text.details}`}
      aria-haspopup="dialog" data-academic-course-id={course.id}>
      {children}
    </button>
  );
}

export function AcademicTimetablePresentation({ contextLabel, referenceCourses, selectedCourses,
  conflictCourseIds, dayLabel, periodLabel, periodTimeLabel, completionLabel, renderWeek }: Props) {
  const locale = useLocale();
  const text = useDictionary().pages.timetable;
  const copy = text.presentation;
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState<LectureDay>(() => getVisibleTimetableDays([])[0]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const days = getVisibleTimetableDays(referenceCourses ?? selectedCourses);
  const activeDay = days.includes(day) ? day : days[0];
  const rows = getAcademicAgendaRows(selectedCourses, activeDay);
  const unscheduled = selectedCourses.filter((course) => course.timeSlots.length === 0);
  const detailCourse = selectedCourses.find((course) => course.id === detailId);
  const openCourse = (course: LectureTimetableCourse) => setDetailId(course.id);
  const scopedLabel = (label: string) => contextLabel ? `${contextLabel} · ${label}` : label;
  const dayName = (value: LectureDay) => copy.fullDayLabel.replace("{day}", dayLabel(value));
  const credit = (course: LectureTimetableCourse) => course.credits == null ? "—" : `${course.credits}${locale === "ko" ? "" : " "}${text.creditsUnit}`;
  const courseRow = (course: LectureTimetableCourse, time?: ReturnType<typeof getAcademicSlotTime>, key = course.id) => (
    <TranslatedCourse key={key} course={course}>{translation => <li>
      <button type="button" className="m3-academic-agenda-course" onClick={() => openCourse(course)}
        aria-label={`${translation.text("courseName", course.courseName)} ${copy.details}`} aria-haspopup="dialog" data-academic-course-id={course.id}>
        <span className="m3-academic-agenda-time">{time ? <>{time.start}<span>–{time.end}</span></> : text.timeMissing}</span>
        <span className="m3-academic-agenda-copy">
          <strong lang={translation.lang}>{translation.text("courseName", course.courseName)}</strong><span lang={translation.lang}>{translation.text("place", course.place || text.placeMissing)}</span>
          <span><span lang={course.professor ? "ko" : locale} translate="no">{course.professor || text.professorMissing}</span>{[course.completionType ? completionLabel(course.completionType) : undefined, credit(course)].filter(Boolean).map((part, index) => <span key={index}> · {part}</span>)}</span>
          {conflictCourseIds.has(course.id) && <span className="m3-academic-conflict">{text.conflictBadge}</span>}
        </span>
        <span className="m3-academic-agenda-chevron" aria-hidden="true">›</span>
      </button>
    </li>}</TranslatedCourse>
  );

  // Both compact selected-course views are server-rendered; CSS chooses the viewport without a hydration swap.
  return (
    <div className="m3-academic-timetable m3-academic-responsive" data-mobile-view={view}>
      <div className="m3-academic-mobile-controls">
        <div className="m3-academic-view-switch" role="group" aria-label={scopedLabel(copy.viewLabel)}>
          <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
            {copy.dayList}
          </button>
          <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}><Icon name="calendar" size={20} />{copy.weekGrid}</button>
        </div>
        {view === "week" && <p className="m3-academic-week-help">{copy.weekHelp}</p>}
      </div>
      <div className="m3-academic-weekly">{renderWeek(openCourse)}</div>
      <section className="m3-academic-agenda" aria-label={scopedLabel(copy.agendaLabel)}>
        <div className="m3-academic-day-picker" role="group" aria-label={scopedLabel(copy.dayPickerLabel)}>
          {days.map((value) => <button type="button" key={value} aria-label={dayName(value)} aria-pressed={value === activeDay} onClick={() => setDay(value)}>{dayLabel(value)}</button>)}
        </div>
        <p className="m3-academic-agenda-summary" role="status" aria-live="polite">
          {copy.dayClassCount.replace("{day}", dayName(activeDay)).replace("{count}", String(rows.length))}
        </p>
        {rows.length ? <ul className="m3-academic-agenda-list">{rows.map(({ course, slot, key }) => courseRow(course, getAcademicSlotTime(slot, periodTimeLabel), key))}</ul>
          : <div className="m3-academic-agenda-empty"><strong>{copy.emptyDayTitle}</strong><p>{copy.emptyDayDescription}</p></div>}
        {unscheduled.length > 0 && <section className="m3-academic-unscheduled"><h3>{text.timeMissing}</h3><p>{copy.unscheduledDescription}</p><ul className="m3-academic-agenda-list">{unscheduled.map((course) => courseRow(course))}</ul></section>}
      </section>
      <section className="m3-academic-print-surface" aria-label={scopedLabel(copy.printTitle)}>
        <h3>{scopedLabel(copy.printTitle)}</h3>
        {days.map((value) => {
          const printRows = getAcademicAgendaRows(selectedCourses, value);
          return printRows.length > 0 && <section key={value}><h4>{dayName(value)}</h4><ul>
            {printRows.map(({ course, slot, key }) => <TranslatedCourse key={key} course={course}>{translation => <li>
              <strong lang={translation.lang}>{getAcademicSlotTime(slot, periodTimeLabel).label} · {translation.text("courseName", course.courseName)}</strong>
              <span><span lang={course.professor ? "ko" : locale} translate="no">{course.professor || text.professorMissing}</span> · {translation.text("place", course.place || text.placeMissing)} · {credit(course)}</span>
              {conflictCourseIds.has(course.id) && <span>{text.conflictBadge}</span>}
            </li>}</TranslatedCourse>)}
          </ul></section>;
        })}
        {unscheduled.length > 0 && <section><h4>{text.timeMissing}</h4><ul>{unscheduled.map((course) => <TranslatedCourse key={course.id} course={course}>{translation => <li>
          <strong lang={translation.lang}>{translation.text("courseName", course.courseName)}</strong><span><span lang={course.professor ? "ko" : locale} translate="no">{course.professor || text.professorMissing}</span> · {translation.text("place", course.place || text.placeMissing)} · {credit(course)}</span>
        </li>}</TranslatedCourse>)}</ul></section>}
        {selectedCourses.length === 0 && <p>{text.selectedEmpty}</p>}
      </section>
      {detailCourse && <TranslatedCourse course={detailCourse}>{translation => <Modal isOpen onClose={() => setDetailId(null)} title={translation.text("courseName", detailCourse.courseName)}
        description={copy.detailsDescription} size="sm" className="m3-academic-course-dialog">
        {conflictCourseIds.has(detailCourse.id) && <p className="m3-academic-detail-conflict">{text.conflictSummaryTitle}</p>}
        <dl className="m3-academic-course-details">
          <Detail label={copy.courseId} value={detailCourse.id} />
          {detailCourse.courseCode && <Detail label={copy.courseCode} value={detailCourse.courseCode} />}
          {detailCourse.departmentName && <Detail label={text.department} value={translation.text("departmentName", detailCourse.departmentName)} />}
          {detailCourse.collegeName && <Detail label={text.college} value={translation.text("collegeName", detailCourse.collegeName)} />}
          {detailCourse.grade && <Detail label={text.grade} value={String(detailCourse.grade)} />}
          <Detail label={copy.professor} value={<span lang={detailCourse.professor ? "ko" : locale} translate="no">{detailCourse.professor || text.professorMissing}</span>} />
          <Detail label={text.time} value={<span translate="no">{detailCourse.classTime || text.timeMissing}</span>} />
          {detailCourse.timeSlots.length > 0 && <Detail label={copy.classTimes} value={<ul>{detailCourse.timeSlots.map((slot, index) => <li key={index}>
            {dayLabel(slot.day)} {periodLabel(slot.startPeriod)}{slot.endPeriod !== slot.startPeriod ? `–${periodLabel(slot.endPeriod)}` : ""}<br />{getAcademicSlotTime(slot, periodTimeLabel).label}
          </li>)}</ul>} />}
          <Detail label={text.place} value={translation.text("place", detailCourse.place || text.placeMissing)} />
          <Detail label={copy.credits} value={credit(detailCourse)} />
          {detailCourse.completionType && <Detail label={text.completionType} value={completionLabel(detailCourse.completionType)} />}
          {detailCourse.areaType && <Detail label={text.areaType} value={translation.text("areaType", detailCourse.areaType)} />}
          {detailCourse.teamTeaching && <Detail label={text.teamTeaching} value={<span translate="no">{detailCourse.teamTeaching}</span>} />}
          {detailCourse.note && <Detail label={text.note} value={translation.text("note", detailCourse.note)} />}
        </dl>
        <button type="button" className={buttonStyles("primary", "m3-academic-detail-close")} onClick={() => setDetailId(null)}>{text.close}</button>
      </Modal>}</TranslatedCourse>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
