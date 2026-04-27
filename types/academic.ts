export interface AcademicSchedule {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  category: "registration" | "exam" | "holiday" | "event";
  description?: string;
}
