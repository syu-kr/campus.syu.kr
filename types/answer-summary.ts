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
  updatedAt: string;
  items?: AnswerSummaryItem[];
};
