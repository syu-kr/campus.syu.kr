"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { useDictionary } from "@/app/components/LocaleProvider";

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  initialFocus?: "close" | "none";
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
}

export function Modal({
  isOpen,
  title,
  description,
  onClose,
  children,
  size = "md",
  initialFocus = "close",
  className = "",
  headerClassName = "",
  bodyClassName = "",
  hideHeader = false,
}: ModalProps) {
  const dictionary = useDictionary();
  const closeLabel = dictionary.labels.closeModal;
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (initialFocus === "close") {
      closeButtonRef.current?.focus();
    }

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
  }, [initialFocus, isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 pt-16 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[calc(100dvh-2rem)] w-full ${sizeClass} flex-col overflow-hidden rounded-xl bg-white shadow-xl ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {hideHeader ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="sr-only">
                {description}
              </p>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="sr-only"
            >
              {closeLabel}
            </button>
          </>
        ) : (
          <div
            className={`flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 ${headerClassName}`}
          >
            <div>
              <h2 id={titleId} className="text-lg font-bold text-neutral-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-neutral-600">
                  {description}
                </p>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label={closeLabel}
            >
              x
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto px-5 py-5 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
