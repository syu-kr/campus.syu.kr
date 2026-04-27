export interface Scholarship {
  id: string;
  name: string;
  type: "internal" | "external";
  amount: number;
  eligibility: string;
  deadline: string;
  description: string;
  url?: string;
  isPinned?: boolean;
}
