"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type {
  AdminSubmissionAiClassification,
  AdminSubmissionItem,
  AdminSubmissionKind,
  SubmissionStatus,
} from "@/types/submissions";

const statuses: Array<{ value: SubmissionStatus; label: string }> = [
  { value: "pending", label: "대기" },
  { value: "reviewing", label: "검토중" },
  { value: "accepted", label: "반영예정" },
  { value: "rejected", label: "보류" },
  { value: "done", label: "완료" },
];

const kindLabels: Record<AdminSubmissionKind, string> = {
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

const aiCategoryLabels: Record<string, string> = {
  bug: "오류",
  "data-correction": "정보 수정",
  "feature-request": "기능 요청",
  "campus-tip": "꿀팁 제보",
  "abuse-spam": "스팸/무관",
  "privacy-security": "개인정보/보안",
  other: "기타",
};

const aiUrgencyLabels: Record<string, string> = {
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

const emptyCounts: Record<SubmissionStatus, number> = {
  pending: 0,
  reviewing: 0,
  accepted: 0,
  rejected: 0,
  done: 0,
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | AdminSubmissionKind>(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>(
    "pending",
  );
  const [query, setQuery] = useState("");
  const [counts, setCounts] =
    useState<Record<SubmissionStatus, number>>(emptyCounts);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [classifyingKey, setClassifyingKey] = useState("");
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthReady(true);
    });
  }, []);

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return submissions.filter((item) => {
      const matchesKind = kindFilter === "all" || item.kind === kindFilter;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          item.title,
          item.contact,
          item.message,
          item.description,
          item.pageUrl,
          item.url,
          item.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesKind && matchesStatus && matchesQuery;
    });
  }, [kindFilter, query, statusFilter, submissions]);

  const selectedSubmission =
    filteredSubmissions.find((item) => item.id === selectedId) ||
    filteredSubmissions[0] ||
    null;

  useEffect(() => {
    if (!selectedSubmission) {
      setSelectedId("");
      return;
    }

    if (selectedSubmission.id !== selectedId) {
      setSelectedId(selectedSubmission.id);
    }
  }, [selectedId, selectedSubmission]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
    } catch {
      setLoginError("이메일 또는 비밀번호를 확인해주세요.");
    }
  };

  const loadSubmissions = useCallback(
    async (currentUser = user) => {
      if (!currentUser) return;

      setIsLoading(true);
      setPageError("");

      try {
        const token = await currentUser.getIdToken();
        const params = new URLSearchParams({
          kind: kindFilter,
          status: statusFilter,
        });
        const response = await fetch(`/api/admin/submissions?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await readAdminApiResponse<{
          error?: string;
          submissions?: AdminSubmissionItem[];
          counts?: Partial<Record<SubmissionStatus, number>>;
        }>(response);

        if (!response.ok) {
          throw new Error(data.error || "목록을 불러오지 못했습니다");
        }

        setSubmissions(data.submissions || []);
        setCounts({ ...emptyCounts, ...(data.counts || {}) });
      } catch (error) {
        setPageError(
          error instanceof Error ? error.message : "목록을 불러오지 못했습니다",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [kindFilter, statusFilter, user],
  );

  useEffect(() => {
    if (!user) return;
    void loadSubmissions(user);
  }, [loadSubmissions, user]);

  const updateStatus = async (
    item: AdminSubmissionItem,
    status: SubmissionStatus,
  ) => {
    if (!user || item.status === status) return;

    setIsSaving(true);
    setPageError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: item.id, kind: item.kind, status }),
      });
      const data = await readAdminApiResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error || "상태를 변경하지 못했습니다");
      }

      const updatedAt = new Date().toISOString();
      setSubmissions((items) =>
        items
          .map((current) =>
            current.id === item.id && current.kind === item.kind
              ? { ...current, status, updatedAt }
              : current,
          )
          .filter(
            (current) =>
              statusFilter === "all" ||
              current.id !== item.id ||
              current.kind !== item.kind ||
              status === statusFilter,
          ),
      );
      setCounts((current) => ({
        ...current,
        [item.status]: Math.max(0, current[item.status] - 1),
        [status]: current[status] + 1,
      }));
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "상태를 변경하지 못했습니다",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const classifySubmission = async (item: AdminSubmissionItem) => {
    if (!user) return;

    const key = `${item.kind}-${item.id}`;
    setClassifyingKey(key);
    setPageError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/submissions/classify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: item.id, kind: item.kind }),
      });
      const data = await readAdminApiResponse<{
        error?: string;
        classification?: AdminSubmissionAiClassification;
        reused?: boolean;
      }>(response);

      if (!response.ok || !data.classification) {
        throw new Error(data.error || "AI 분류를 생성하지 못했습니다");
      }

      setSubmissions((items) =>
        items.map((current) =>
          current.id === item.id && current.kind === item.kind
            ? {
                ...current,
                aiClassification: data.classification,
                updatedAt: current.updatedAt,
              }
            : current,
        ),
      );
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "AI 분류를 생성하지 못했습니다",
      );
    } finally {
      setClassifyingKey("");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-neutral-100 px-6 py-10">
        <div className="mx-auto max-w-7xl text-sm text-neutral-600">
          관리자 세션을 확인하는 중입니다.
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-100 px-6 py-12">
        <section className="mx-auto max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <p className="text-sm font-semibold text-primary-600">Admin</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950">
              제보 및 문의 관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              컴공의 자존심으로 뚫어보고 싶다면 말리진 않겠습니다.
              <br /> 하지만 정문은 Firebase Authentication 로그인입니다.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-neutral-900">
                이메일
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-neutral-900">
                비밀번호
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700"
            >
              로그인
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-600">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">
              제보 및 문의 관리
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              접수된 문의와 캠퍼스 꿀팁 제보를 확인하고 처리 상태를 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">{user.email}</span>
            <button
              type="button"
              onClick={() => void loadSubmissions()}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              로그아웃
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-5">
          {statuses.map((status) => (
            <button
              key={status.value}
              type="button"
              onClick={() => setStatusFilter(status.value)}
              className={`rounded-lg border bg-white p-4 text-left shadow-sm hover:border-primary-300 ${
                statusFilter === status.value
                  ? "border-primary-400 ring-2 ring-primary-100"
                  : "border-neutral-200"
              }`}
            >
              <span className="text-sm font-medium text-neutral-600">
                {status.label}
              </span>
              <strong className="mt-2 block text-2xl text-neutral-950">
                {counts[status.value]}
              </strong>
            </button>
          ))}
        </section>

        <section className="mb-4 grid gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
          <select
            value={kindFilter}
            onChange={(event) =>
              setKindFilter(event.target.value as "all" | AdminSubmissionKind)
            }
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">전체 유형</option>
            <option value="inquiry">문의</option>
            <option value="campus-tip">꿀팁 제보</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | SubmissionStatus)
            }
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">전체 상태</option>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 내용, 연락처, URL 검색"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </section>

        {pageError && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-bold text-neutral-900">
                접수 목록 {filteredSubmissions.length}
              </h2>
              {isLoading && (
                <span className="text-xs text-neutral-500">불러오는 중</span>
              )}
            </div>

            <div className="max-h-[680px] overflow-y-auto">
              {filteredSubmissions.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">
                  조건에 맞는 접수 내역이 없습니다.
                </p>
              ) : (
                filteredSubmissions.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`block w-full border-b border-neutral-100 px-4 py-4 text-left hover:bg-neutral-50 ${
                      selectedSubmission?.id === item.id
                        ? "bg-primary-50"
                        : "bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                        {kindLabels[item.kind]}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <strong className="line-clamp-2 text-sm text-neutral-950">
                      {item.title}
                    </strong>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-600">
                      {item.kind === "inquiry"
                        ? item.message
                        : item.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-md bg-white px-2 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                        {statusLabel(item.status)}
                      </span>
                      {item.aiClassification && (
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${aiUrgencyClass(
                            item.aiClassification.urgency,
                          )}`}
                        >
                          {aiUrgencyLabels[item.aiClassification.urgency]} /{" "}
                          {aiCategoryLabels[item.aiClassification.category]}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <SubmissionDetail
            item={selectedSubmission}
            isSaving={isSaving}
            isClassifying={
              selectedSubmission
                ? classifyingKey ===
                  `${selectedSubmission.kind}-${selectedSubmission.id}`
                : false
            }
            onStatusChange={updateStatus}
            onClassify={classifySubmission}
          />
        </section>
      </div>
    </div>
  );
}

function SubmissionDetail({
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

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">처리 상태</h3>
            {statuses.map((status) => (
              <button
                key={status.value}
                type="button"
                disabled={isSaving}
                onClick={() => void onStatusChange(item, status.value)}
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

function aiUrgencyClass(value: string) {
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

function statusLabel(value: SubmissionStatus) {
  return statuses.find((status) => status.value === value)?.label || value;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readAdminApiResponse<T>(response: Response): Promise<T> {
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
