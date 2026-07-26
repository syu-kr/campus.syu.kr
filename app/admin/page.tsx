"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  AdminSubmissionPageResponse,
  AdminSubmissionPagination,
  SubmissionStatus,
} from "@/types/submissions";
import {
  aiCategoryLabels,
  aiUrgencyClass,
  aiUrgencyLabels,
  formatDateTime,
  kindLabels,
  readAdminApiResponse,
  statuses,
  statusLabel,
  submissionKey,
  SubmissionDetail,
} from "./AdminSubmissionDetail";

const emptyCounts: Record<SubmissionStatus, number> = {
  pending: 0,
  reviewing: 0,
  accepted: 0,
  rejected: 0,
  done: 0,
};

const PAGE_LIMIT = 20;
const emptyPagination: AdminSubmissionPagination = {
  page: 1,
  limit: PAGE_LIMIT,
  total: 0,
  totalPages: 1,
  hasNext: false,
  nextCursor: null,
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<
    "checking" | "ready" | "error"
  >("checking");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<"all" | AdminSubmissionKind>(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>(
    "pending",
  );
  const [page, setPage] = useState(1);
  const pageCursorsRef = useRef<Record<number, string>>({});
  const [pagination, setPagination] =
    useState<AdminSubmissionPagination>(emptyPagination);
  const [query, setQuery] = useState("");
  const [bulkStatus, setBulkStatus] = useState<SubmissionStatus>("reviewing");
  const [counts, setCounts] =
    useState<Record<SubmissionStatus, number>>(emptyCounts);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [classifyingKey, setClassifyingKey] = useState("");
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");

  useEffect(() => {
    let settled = false;
    setAuthStatus("checking");
    setAuthError("");

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      setAuthStatus("error");
      setAuthError("관리자 세션 확인 시간이 초과되었습니다.");
    }, 10_000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        settled = true;
        window.clearTimeout(timeoutId);
        setUser(nextUser);
        setAuthStatus("ready");
      },
      () => {
        settled = true;
        window.clearTimeout(timeoutId);
        setUser(null);
        setAuthStatus("error");
        setAuthError("관리자 세션을 확인하지 못했습니다.");
      },
    );

    return () => {
      settled = true;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [authCheckAttempt]);

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
    filteredSubmissions.find((item) => submissionKey(item) === selectedKey) ||
    filteredSubmissions[0] ||
    null;
  const selectedItems = useMemo(
    () =>
      filteredSubmissions.filter((item) =>
        selectedKeys.has(submissionKey(item)),
      ),
    [filteredSubmissions, selectedKeys],
  );
  const allVisibleSelected =
    filteredSubmissions.length > 0 &&
    filteredSubmissions.every((item) => selectedKeys.has(submissionKey(item)));

  useEffect(() => {
    if (!selectedSubmission) {
      setSelectedKey("");
      return;
    }

    const nextKey = submissionKey(selectedSubmission);
    if (nextKey !== selectedKey) {
      setSelectedKey(nextKey);
    }
  }, [selectedKey, selectedSubmission]);

  useEffect(() => {
    setPage(1);
    pageCursorsRef.current = {};
    setSelectedKeys(new Set());
  }, [kindFilter, statusFilter]);

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
      setPageNotice("");

      try {
        const token = await currentUser.getIdToken();
        const params = new URLSearchParams({
          kind: kindFilter,
          status: statusFilter,
          page: String(page),
          limit: String(PAGE_LIMIT),
        });
        const cursor = pageCursorsRef.current[page];
        if (page > 1 && !cursor) {
          return;
        }
        if (cursor) {
          params.set("cursor", cursor);
        }
        const response = await fetch(`/api/admin/submissions?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await readAdminApiResponse<
          Partial<AdminSubmissionPageResponse> & { error?: string }
        >(response);

        if (!response.ok) {
          throw new Error(data.error || "목록을 불러오지 못했습니다");
        }

        setSubmissions(data.submissions || []);
        setCounts({ ...emptyCounts, ...(data.counts || {}) });
        const nextPagination = data.pagination || emptyPagination;
        setPagination(nextPagination);
        pageCursorsRef.current = Object.fromEntries(
          Object.entries(pageCursorsRef.current).filter(
            ([cursorPage]) => Number(cursorPage) <= page,
          ),
        );
        if (nextPagination.nextCursor) {
          pageCursorsRef.current[page + 1] = nextPagination.nextCursor;
        }
        setSelectedKeys(new Set());
      } catch (error) {
        setPageError(
          error instanceof Error ? error.message : "목록을 불러오지 못했습니다",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [kindFilter, page, statusFilter, user],
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
    setPageNotice("");

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
      if (statusFilter !== "all" && status !== statusFilter) {
        setPagination((current) => ({
          ...current,
          total: Math.max(0, current.total - 1),
          totalPages: Math.max(
            1,
            Math.ceil(Math.max(0, current.total - 1) / current.limit),
          ),
        }));
      }
      setSelectedKeys((current) => {
        const next = new Set(current);
        next.delete(submissionKey(item));
        return next;
      });
      setPageNotice("처리 상태를 변경했습니다.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "상태를 변경하지 못했습니다",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSubmissionSelection = (item: AdminSubmissionItem) => {
    const key = submissionKey(item);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllVisibleSelection = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        filteredSubmissions.forEach((item) => next.delete(submissionKey(item)));
      } else {
        filteredSubmissions.forEach((item) => next.add(submissionKey(item)));
      }

      return next;
    });
  };

  const updateSelectedStatuses = async () => {
    if (!user || selectedItems.length === 0) return;

    setIsSaving(true);
    setPageError("");
    setPageNotice("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            id: item.id,
            kind: item.kind,
          })),
          status: bulkStatus,
        }),
      });
      const data = await readAdminApiResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error || "상태를 변경하지 못했습니다");
      }

      setSelectedKeys(new Set());
      await loadSubmissions();
      setPageNotice(`${selectedItems.length}개 항목의 상태를 변경했습니다.`);
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
    setPageNotice("");

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

  if (authStatus === "checking") {
    return (
      <div className="min-h-screen bg-neutral-100 px-6 py-10">
        <div
          className="mx-auto max-w-7xl text-sm text-neutral-600"
          role="status"
          aria-live="polite"
        >
          관리자 세션을 확인하는 중입니다.
        </div>
      </div>
    );
  }

  if (authStatus === "error") {
    return (
      <div className="min-h-screen bg-neutral-100 px-6 py-12">
        <section className="mx-auto max-w-md rounded-lg border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-red-700">Admin</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-950">
            관리자 세션 확인 실패
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600" role="alert">
            {authError}
          </p>
          <button
            type="button"
            onClick={() => setAuthCheckAttempt((attempt) => attempt + 1)}
            className="mt-6 w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            다시 시도
          </button>
        </section>
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
              Firebase Authentication으로 인증된 허용 계정만 접근할 수
              있습니다.
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
                aria-invalid={Boolean(loginError)}
                aria-describedby={loginError ? "admin-login-error" : undefined}
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
                aria-invalid={Boolean(loginError)}
                aria-describedby={loginError ? "admin-login-error" : undefined}
                required
              />
            </label>

            {loginError && (
              <p
                id="admin-login-error"
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
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
            placeholder="현재 페이지에서 제목, 내용, 연락처, URL 검색"
            aria-label="현재 페이지 접수 내역 검색"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </section>

        {selectedItems.length > 0 && (
          <section className="mb-4 flex flex-col gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">
              {selectedItems.length}개 항목 선택됨
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(event) =>
                  setBulkStatus(event.target.value as SubmissionStatus)
                }
                className="rounded-md border border-primary-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void updateSelectedStatuses()}
                className="rounded-md bg-primary-700 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                일괄 상태 변경
              </button>
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set())}
                className="rounded-md border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-100"
              >
                선택 해제
              </button>
            </div>
          </section>
        )}

        {pageError && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </p>
        )}

        {pageNotice && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {pageNotice}
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={filteredSubmissions.length === 0}
                  onChange={() => toggleAllVisibleSelection()}
                  aria-label="현재 페이지 항목 전체 선택"
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <h2 className="text-sm font-bold text-neutral-900">
                  접수 목록 {filteredSubmissions.length} / {pagination.total}
                </h2>
              </div>
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
                filteredSubmissions.map((item) => {
                  const key = submissionKey(item);
                  const isSelected = selectedKeys.has(key);
                  const isFocused = selectedSubmission
                    ? submissionKey(selectedSubmission) === key
                    : false;

                  return (
                    <div
                      key={key}
                      className={`flex gap-3 border-b border-neutral-100 px-4 py-4 hover:bg-neutral-50 ${
                        isFocused ? "bg-primary-50" : "bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSubmissionSelection(item)}
                        aria-label={`${item.title} 선택`}
                        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className="min-w-0 flex-1 text-left"
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
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm">
              <button
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                이전
              </button>
              <span className="text-neutral-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNext || isLoading}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                다음
              </button>
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
