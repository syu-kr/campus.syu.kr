import { Card } from "@/app/components/Card";

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

export function AnswerSummaryCard({ summary }: { summary: AnswerSummary }) {
  return (
    <Card
      as="section"
      hover={false}
      className="border border-primary-100 bg-primary-50/70 shadow-none"
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-700">
            {summary.eyebrow}
          </p>
          <h2 className="text-lg font-bold text-neutral-950">
            {summary.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-700">
            {summary.question}
          </p>
        </div>

        <p className="text-base leading-7 text-neutral-900">
          {summary.answer}
        </p>

        {summary.items && summary.items.length > 0 && (
          <dl className="grid gap-2 sm:grid-cols-2">
            {summary.items.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/80 bg-white/85 px-3 py-2"
              >
                <dt className="text-xs font-semibold text-neutral-500">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm font-medium leading-6 text-neutral-900">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-col gap-1 border-t border-primary-100 pt-3 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <span>{summary.source}</span>
          <span>{summary.updatedAt}</span>
        </div>
      </div>
    </Card>
  );
}
