"use client";

import { useEffect, useRef } from "react";

export interface SubmissionSummaryItem {
  label: string;
  value: string;
}

interface SubmissionResultModalProps {
  type: "success" | "error";
  title: string;
  message: string;
  summary?: SubmissionSummaryItem[];
  onClose: () => void;
}

export function SubmissionResultModal({
  type,
  title,
  message,
  summary = [],
  onClose,
}: SubmissionResultModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = closeButtonRef.current;
      if (focusable) {
        event.preventDefault();
        focusable.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 pt-16 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-result-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {type === "success" ? "접수 완료" : "접수 실패"}
        </div>
        <h2
          id="submission-result-title"
          className="text-lg font-bold text-neutral-900"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{message}</p>

        {summary.length > 0 && (
          <dl className="mt-4 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            {summary.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-sm"
              >
                <dt className="font-medium text-neutral-500">{item.label}</dt>
                <dd className="truncate text-neutral-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          확인
        </button>
      </div>
    </div>
  );
}
