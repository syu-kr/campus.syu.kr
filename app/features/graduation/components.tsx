import clsx from "clsx";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import type { EvaluationStatus } from "@/lib/graduation";

const STEPS = ["대학", "학과/전공", "입학/전공형태", "이수학점", "결과"];

export function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 pb-1">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                index <= activeStep
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-400",
              )}
            >
              {index + 1}
            </div>
            <span
              className={clsx(
                "text-sm font-medium",
                index <= activeStep ? "text-neutral-900" : "text-neutral-400",
              )}
            >
              {step}
            </span>
            {index < STEPS.length - 1 && (
              <div
                className={clsx(
                  "h-0.5 w-8",
                  index < activeStep ? "bg-primary-600" : "bg-neutral-200",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card hover={false} className="border border-neutral-200">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {children}
    </Card>
  );
}

export function ChoiceButton({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-lg border p-4 text-left transition",
        selected
          ? "border-primary-500 bg-primary-50 ring-2 ring-primary-100"
          : "border-neutral-200 bg-white hover:border-primary-300",
      )}
    >
      <span className="block font-semibold text-neutral-900">{title}</span>
      {description && (
        <span className="mt-1 block text-xs text-neutral-500">
          {description}
        </span>
      )}
    </button>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

export function CourseSelectCard({
  title,
  description,
  credits,
  required,
  count,
  optional = false,
  onClick,
}: {
  title: string;
  description: string;
  credits: number;
  required: number;
  count: number;
  optional?: boolean;
  onClick: () => void;
}) {
  const shortage = optional ? 0 : Math.max(required - credits, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        </div>
        <Badge color={shortage > 0 ? "yellow" : "green"} className="shrink-0">
          {count}개
        </Badge>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">선택 학점</p>
          <p className="text-2xl font-bold text-primary-700">{credits}</p>
        </div>
        {!optional && (
          <p className="text-right text-xs text-neutral-500">
            요구 {required}학점
            <br />
            부족 {shortage}학점
          </p>
        )}
      </div>
    </button>
  );
}

export function CourseModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-6">
      <div className="max-h-[88vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-bold text-neutral-900 sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[calc(88vh-57px)] overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-semibold text-neutral-900">
        {value || "-"}
      </span>
    </div>
  );
}

export function ResultBanner({ status }: { status: EvaluationStatus }) {
  const config =
    status === "short"
      ? {
          title: "졸업요건 부족",
          description: "학점 부족 항목이 있습니다. 부족학점을 먼저 확인하세요.",
          className: "border-red-200 bg-red-50 text-red-900",
        }
      : status === "checkRequired"
        ? {
            title: "학점 충족, 추가 확인 필요",
            description:
              "입력한 학점은 충족했지만 시험, 실습, 인증 등 확인 필요 조건이 남아 있습니다.",
            className: "border-amber-200 bg-amber-50 text-amber-900",
          }
        : {
            title: "졸업요건 충족",
            description: "입력한 학점 기준으로 모든 항목을 충족했습니다.",
            className: "border-green-200 bg-green-50 text-green-900",
          };

  return (
    <div className={clsx("rounded-lg border p-4", config.className)}>
      <p className="font-bold">{config.title}</p>
      <p className="mt-1 text-sm">{config.description}</p>
    </div>
  );
}
