"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  SubmissionResultModal,
  type SubmissionSummaryItem,
} from "@/app/components/SubmissionResultModal";
import type { SiteInquiryType } from "@/types/submissions";

const inquiryTypes: Array<{ value: SiteInquiryType; label: string }> = [
  { value: "bug", label: "오류 제보" },
  { value: "suggestion", label: "서비스 제안" },
  { value: "data-correction", label: "정보 수정 요청" },
  { value: "feature", label: "기능 요청" },
  { value: "other", label: "기타" },
];

interface ContactFormProps {
  defaultPageUrl?: string;
  onSuccessConfirm?: () => void;
}

export function ContactForm({
  defaultPageUrl,
  onSuccessConfirm,
}: ContactFormProps) {
  const [type, setType] = useState<SiteInquiryType>("suggestion");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState(defaultPageUrl || "");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [resultModal, setResultModal] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    summary?: SubmissionSummaryItem[];
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeResultModal = () => {
    const shouldCloseParent = resultModal?.type === "success";
    setResultModal(null);

    if (shouldCloseParent) {
      onSuccessConfirm?.();
    }
  };

  useEffect(() => {
    if (defaultPageUrl || pageUrl) return;
    setPageUrl(window.location.href);
  }, [defaultPageUrl, pageUrl]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResultModal(null);
    setFieldErrors({});

    const clientErrors = validateSiteInquiry({ title, message, pageUrl });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setResultModal({
        type: "error",
        title: "입력 내용을 확인해주세요",
        message: "표시된 항목을 수정한 뒤 다시 제출해주세요.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submittedType =
        inquiryTypes.find((item) => item.value === type)?.label || type;
      const submittedTitle = title.trim();
      const submittedPageUrl = pageUrl.trim();
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          title,
          message,
          pageUrl,
          contact,
          website,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.field) {
          setFieldErrors({ [data.field]: data.error });
        }
        throw new Error(data.error || "문의를 접수하지 못했습니다");
      }

      setResultModal({
        type: "success",
        title: "문의가 접수되었습니다",
        message:
          "개별 답장은 어려울 수 있으나 접수된 내용은 서비스 개선에 참고하겠습니다.",
        summary: [
          { label: "유형", value: submittedType },
          { label: "제목", value: submittedTitle },
          ...(submittedPageUrl
            ? [{ label: "페이지", value: submittedPageUrl }]
            : []),
        ],
      });
      setTitle("");
      setMessage("");
      setContact("");
      setWebsite("");
    } catch (err) {
      setResultModal({
        type: "error",
        title: "문의를 접수하지 못했습니다",
        message: err instanceof Error ? err.message : "문의를 접수하지 못했습니다",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div>
          <label
            htmlFor="inquiry-type"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            문의 유형
          </label>
          <select
            id="inquiry-type"
            value={type}
            onChange={(event) => setType(event.target.value as SiteInquiryType)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {inquiryTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="inquiry-title"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            제목
          </label>
          <input
            id="inquiry-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="예: 셔틀 시간이 이상하게 보여요"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={
              fieldErrors.title ? "inquiry-title-error" : undefined
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.title ? "border-red-300" : "border-neutral-300"
            }`}
          />
          {fieldErrors.title && (
            <p id="inquiry-title-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="inquiry-message"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            내용
          </label>
          <textarea
            id="inquiry-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            maxLength={2000}
            placeholder="어떤 문제가 있었는지, 어떤 개선이 필요하다고 느꼈는지 적어주세요."
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={
              fieldErrors.message ? "inquiry-message-error" : undefined
            }
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.message ? "border-red-300" : "border-neutral-300"
            }`}
          />
          {fieldErrors.message && (
            <p id="inquiry-message-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="page-url"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            관련 페이지 URL
          </label>
          <input
            id="page-url"
            type="url"
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            maxLength={500}
            placeholder="https://campus.syu.kr/..."
            aria-invalid={Boolean(fieldErrors.pageUrl)}
            aria-describedby={fieldErrors.pageUrl ? "page-url-error" : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.pageUrl ? "border-red-300" : "border-neutral-300"
            }`}
          />
          {fieldErrors.pageUrl && (
            <p id="page-url-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.pageUrl}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="contact"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            연락처
            <span className="ml-1 text-xs font-normal text-neutral-500">
              선택
            </span>
          </label>
          <input
            id="contact"
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            maxLength={120}
            placeholder="확인이 필요한 경우 참고할 이메일 또는 연락처"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            연락처를 남겨도 개별 답장을 보장하지는 않습니다.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSubmitting ? "접수 중..." : "문의 등록하기"}
        </button>
      </form>

      {resultModal && (
        <SubmissionResultModal
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          summary={resultModal.summary}
          onClose={closeResultModal}
        />
      )}
    </>
  );
}

function validateSiteInquiry({
  title,
  message,
  pageUrl,
}: {
  title: string;
  message: string;
  pageUrl: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!title.trim()) {
    errors.title = "제목을 입력해주세요";
  }

  if (!message.trim()) {
    errors.message = "문의 내용을 입력해주세요";
  }

  if (pageUrl.trim() && !isValidHttpUrl(pageUrl.trim())) {
    errors.pageUrl = "관련 페이지 URL 형식이 올바르지 않습니다";
  }

  return errors;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
