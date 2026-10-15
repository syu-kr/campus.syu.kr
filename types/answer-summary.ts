type AnswerSummaryItem = {
  label: string;
  value: string;
};

export type AnswerSummary = {
  eyebrow: string;
  title: string;
  question: string;
  answer: string;
  source: string;
  updatedAt?: string;
  items?: AnswerSummaryItem[];
};

export type AnswerSource = {
  name: string;
  url: string;
  checkedAt?: string | null;
  note?: string;
};
