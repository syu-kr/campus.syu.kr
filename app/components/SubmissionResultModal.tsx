"use client";

import { useRef } from "react";
import { Modal } from "@/app/components/Modal";

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

  return (
    <Modal
      isOpen
      title={title}
      description={message}
      onClose={onClose}
      size="sm"
      hideHeader
      initialFocus="none"
      bodyClassName="p-0"
    >
      <div className="p-5">
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
    </Modal>
  );
}
