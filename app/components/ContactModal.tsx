"use client";

import { useEffect, useRef } from "react";
import { ContactForm } from "@/app/components/ContactForm";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentUrl =
    typeof window === "undefined" ? "" : window.location.href;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 pt-16 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2
              id="contact-modal-title"
              className="text-lg font-bold text-neutral-900"
            >
              사이트 문의하기
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              오류, 정보 수정, 기능 제안 등을 남겨주세요.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="문의 모달 닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ContactForm defaultPageUrl={currentUrl} onSuccessConfirm={onClose} />
        </div>
      </div>
    </div>
  );
}
