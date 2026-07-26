"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AdminSubmissionItem,
  AdminSubmissionKind,
  SubmissionStatus,
} from "@/types/submissions";

export const statuses: Array<{ value: SubmissionStatus; label: string }> = [
  { value: "pending", label: "대기" },
  { value: "reviewing", label: "검토중" },
  { value: "accepted", label: "반영예정" },
  { value: "rejected", label: "보류" },
  { value: "done", label: "완료" },
];

export const kindLabels: Record<AdminSubmissionKind, string> = {
  inquiry: "문의",
  "campus-tip": "꿀팁 제보",
};

const inquiryTypeLabels: Record<string, string> = {
  bug: "오류 제보",
  suggestion: "서비스 제안",
  "data-correction": "정보 수정 요청",
  feature: "기능 요청",
  other: "기타",
};

const categoryLabels: Record<string, string> = {
  school: "학교",
  "campus-life": "캠퍼스생활",
  career: "취업",
  certificate: "자격증",
  activity: "공모전/대외활동",
  culture: "문화생활",
  local: "별내동",
  finance: "금융/장학",
  reference: "참고자료",
};

export const aiCategoryLabels: Record<string, string> = {
  bug: "오류",
  "data-correction": "정보 수정",
  "feature-request": "기능 요청",
  "campus-tip": "꿀팁 제보",
  "abuse-spam": "스팸/무관",
  "privacy-security": "개인정보/보안",
  other: "기타",
};

export const aiUrgencyLabels: Record<string, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  critical: "긴급",
};

const aiConfidenceLabels: Record<string, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

const responseTemplates = [
  {
    id: "received",
    label: "접수 안내",
    build: (item: AdminSubmissionItem) =>
      `안녕하세요. SYU Campus 운영팀입니다.\n\n보내주신 ${kindLabels[item.kind]}은(는) 정상 접수되었고, 담당자가 내용을 확인하고 있습니다.\n\n제목: ${item.title}\n접수일: ${formatDateTime(item.createdAt)}\n\n확인 후 필요한 경우 추가로 연락드리겠습니다. 감사합니다.`,
  },
  {
    id: "need-more-info",
    label: "추가 정보 요청",
    build: (item: AdminSubmissionItem) =>
      `안녕하세요. SYU Campus 운영팀입니다.\n\n보내주신 ${kindLabels[item.kind]}을(를) 확인했으나 정확한 처리를 위해 추가 정보가 필요합니다.\n\n제목: ${item.title}\n필요한 정보: 문제가 발생한 화면, 발생 시각, 재현 방법 또는 참고 링크\n\n가능한 범위에서 회신해 주시면 이어서 확인하겠습니다. 감사합니다.`,
  },
  {
    id: "completed",
    label: "처리 완료",
    build: (item: AdminSubmissionItem) =>
      `안녕하세요. SYU Campus 운영팀입니다.\n\n보내주신 ${kindLabels[item.kind]} 검토가 완료되었습니다.\n\n제목: ${item.title}\n처리 결과: 반영 완료 또는 처리 완료\n\n서비스 개선에 도움을 주셔서 감사합니다.`,
  },
] as const;

export function SubmissionDetail({
  item,
  isSaving,
  isClassifying,
  onStatusChange,
  onClassify,
}: {
  item: AdminSubmissionItem | null;
  isSaving: boolean;
  isClassifying: boolean;
  onStatusChange: (
    item: AdminSubmissionItem,
    status: SubmissionStatus,
  ) => Promise<void>;
  onClassify: (item: AdminSubmissionItem) => Promise<void>;
}) {
  if (!item) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500 shadow-sm">
        왼쪽 목록에서 접수 항목을 선택하세요.
      </div>
    );
  }

  return (
    <article className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
            {kindLabels[item.kind]}
          </span>
          <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
            {statusLabel(item.status)}
          </span>
        </div>
        <h2 className="text-2xl font-bold leading-8 text-neutral-950">
          {item.title}
        </h2>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-6">
          <DetailBlock
            title={item.kind === "inquiry" ? "문의 내용" : "제보 내용"}
            content={item.kind === "inquiry" ? item.message : item.description}
          />

          {item.kind === "campus-tip" && (
            <DetailBlock title="추가 메모" content={item.note || "없음"} />
          )}

          <dl className="grid gap-4 md:grid-cols-2">
            <DetailItem
              label={item.kind === "inquiry" ? "문의 유형" : "카테고리"}
              value={
                item.kind === "inquiry"
                  ? inquiryTypeLabels[item.type || ""] || item.type || "-"
                  : categoryLabels[item.category || ""] || item.category || "-"
              }
            />
            <DetailItem label="연락처" value={item.contact || "-"} />
            <DetailItem
              label={item.kind === "inquiry" ? "관련 페이지" : "관련 링크"}
              value={
                item.kind === "inquiry" ? item.pageUrl || "-" : item.url || "-"
              }
            />
            <DetailItem label="접수일" value={formatDateTime(item.createdAt)} />
            <DetailItem label="수정일" value={formatDateTime(item.updatedAt)} />
            <DetailItem label="문서 ID" value={item.id} />
          </dl>

          {item.kind === "campus-tip" && item.tags && item.tags.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-neutral-900">태그</h3>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <DetailBlock
            title="User Agent"
            content={item.userAgent || "-"}
            small
          />
        </div>

        <aside className="space-y-5">
          <AiClassificationPanel
            item={item}
            isClassifying={isClassifying}
            onClassify={onClassify}
          />

          <ResponseTemplatePanel item={item} />

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">처리 상태</h3>
            {statuses.map((status) => (
              <button
                key={status.value}
                type="button"
                disabled={isSaving}
                onClick={() => void onStatusChange(item, status.value)}
                aria-pressed={item.status === status.value}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                  item.status === status.value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {status.label}
              </button>
            ))}
          </section>
        </aside>
      </div>
    </article>
  );
}

function AiClassificationPanel({
  item,
  isClassifying,
  onClassify,
}: {
  item: AdminSubmissionItem;
  isClassifying: boolean;
  onClassify: (item: AdminSubmissionItem) => Promise<void>;
}) {
  const classification = item.aiClassification;

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-neutral-900">AI 분류</h3>
        <button
          type="button"
          disabled={isClassifying}
          onClick={() => void onClassify(item)}
          className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isClassifying ? "분류 중" : classification ? "분류 확인" : "분류"}
        </button>
      </div>

      {classification ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${aiUrgencyClass(
                classification.urgency,
              )}`}
            >
              긴급도 {aiUrgencyLabels[classification.urgency]}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
              {aiCategoryLabels[classification.category]}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
              신뢰도 {aiConfidenceLabels[classification.confidence]}
            </span>
          </div>
          <p className="rounded-md bg-white p-3 text-sm leading-6 text-neutral-700 ring-1 ring-neutral-200">
            {classification.handlingHint}
          </p>
          <p className="text-xs text-neutral-500">
            생성 {formatDateTime(classification.generatedAt)}
          </p>
        </div>
      ) : (
        <p className="text-sm leading-6 text-neutral-600">
          분류 결과가 아직 없습니다.
        </p>
      )}
    </section>
  );
}

function ResponseTemplatePanel({ item }: { item: AdminSubmissionItem }) {
  const [activeTemplateId, setActiveTemplateId] = useState<
    (typeof responseTemplates)[number]["id"]
  >(responseTemplates[0].id);
  const [templateText, setTemplateText] = useState(() =>
    responseTemplates[0].build(item),
  );
  const [copyStatus, setCopyStatus] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const template =
      responseTemplates.find((entry) => entry.id === activeTemplateId) ||
      responseTemplates[0];

    setTemplateText(template.build(item));
    setCopyStatus("");
  }, [activeTemplateId, item]);

  const copyTemplate = async () => {
    setCopyStatus("");

    try {
      await navigator.clipboard.writeText(templateText);
      setCopyStatus("템플릿을 클립보드에 복사했습니다.");
    } catch {
      textareaRef.current?.focus();
      textareaRef.current?.select();
      setCopyStatus("자동 복사에 실패했습니다. 선택된 텍스트를 복사해 주세요.");
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-neutral-900">답변 템플릿</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          접수 항목에 맞춰 문안을 만들고 필요한 곳에 붙여넣을 수 있습니다.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {responseTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setActiveTemplateId(template.id)}
            aria-pressed={activeTemplateId === template.id}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
              activeTemplateId === template.id
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {template.label}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        aria-label="답변 템플릿 내용"
        value={templateText}
        onChange={(event) => {
          setTemplateText(event.target.value);
          setCopyStatus("");
        }}
        rows={8}
        className="w-full resize-y rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      <button
        type="button"
        onClick={() => void copyTemplate()}
        className="mt-3 w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        템플릿 복사
      </button>

      {copyStatus && (
        <p role="status" className="mt-2 text-xs leading-5 text-neutral-600">
          {copyStatus}
        </p>
      )}
    </section>
  );
}

function DetailBlock({
  title,
  content,
  small = false,
}: {
  title: string;
  content?: string;
  small?: boolean;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-neutral-900">{title}</h3>
      <p
        className={`whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-4 leading-6 text-neutral-700 ${
          small ? "text-xs" : "text-sm"
        }`}
      >
        {content || "-"}
      </p>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
      <dd className="mt-2 break-words text-sm font-medium text-neutral-900">
        {value}
      </dd>
    </div>
  );
}

export function aiUrgencyClass(value: string) {
  switch (value) {
    case "critical":
      return "bg-red-50 text-red-700 ring-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "low":
      return "bg-neutral-50 text-neutral-600 ring-neutral-200";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

export function submissionKey(
  item: Pick<AdminSubmissionItem, "id" | "kind">,
) {
  return `${item.kind}:${item.id}`;
}

export function statusLabel(value: SubmissionStatus) {
  return statuses.find((status) => status.value === value)?.label || value;
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function readAdminApiResponse<T>(
  response: Response,
): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      response.ok
        ? "관리자 API가 올바르지 않은 응답을 반환했습니다"
        : `관리자 API 서버 오류가 발생했습니다 (${response.status})`,
    );
  }

  return (await response.json()) as T;
}
