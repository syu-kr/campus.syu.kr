export type RoommateDorm = "peniel" | "salem" | "sion" | "eden";
export type RoommatePostStatus = "recruiting" | "completed" | "hidden" | "deleted";
export type RoommateReportReason = "spam" | "false_info" | "inappropriate" | "privacy" | "other";
export type RoommateReportStatus = "pending" | "reviewing" | "done" | "rejected";

export interface RoommateHabits {
  bedtime?: "before22" | "22to24" | "0to2" | "after2" | "flexible";
  wakeTime?: "before6" | "6to8" | "8to10" | "after10" | "flexible";
  cleaning?: "often" | "regular" | "discuss";
  calls?: "outside" | "short" | "discuss";
  sleepHabits?: ("none" | "snoring" | "grinding" | "talking" | "unknown")[];
  smoking?: "nonsmoker" | "smoker";
  temperature?: ("heat" | "cold" | "discuss")[];
  sharing?: "never" | "permission" | "discuss";
}

export interface RoommatePostInput {
  nickname: string;
  dorm: RoommateDorm;
  roomSize: number;
  stayStart: string;
  stayEnd: string;
  roommatesNeeded: number;
  recruitUntil: string;
  habits: RoommateHabits;
  description: string;
  openChatUrl: string;
}

export interface RoommatePostSubmission extends RoommatePostInput {
  disclosureConsent: true;
}

export interface RoommatePostSummary extends Omit<RoommatePostInput, "description" | "openChatUrl"> {
  id: string;
  status: RoommatePostStatus | "expired";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoommatePost extends RoommatePostSummary {
  description: string;
  openChatUrl: string;
  expiresAt: string;
  isOwner?: boolean;
}

export interface RoommatePostFilters {
  dorm?: RoommateDorm;
  roomSize?: number;
  stayStart?: string;
  stayEnd?: string;
  habits?: RoommateHabits;
}

export interface RoommatePostList {
  items: RoommatePostSummary[];
  nextCursor: string | null;
}

export interface RoommateMyPost {
  post: RoommatePost | null;
  holdUntil: string | null;
  holdReason: string | null;
}

export interface RoommateReportInput {
  reason: RoommateReportReason;
  description: string;
}
