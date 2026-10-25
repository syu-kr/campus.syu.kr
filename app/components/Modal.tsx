"use client";

import { createContext, ReactNode, useContext, useEffect, useId, useRef, useState } from "react";
import { useDictionary } from "@/app/components/LocaleProvider";
import { buttonStyles } from "./Button";

const ModalVisibilityContext = createContext(true);
export function useModalVisibility() { return useContext(ModalVisibilityContext); }
let scrollLockCount = 0;
let originalBodyOverflow = "";

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  initialFocus?: "close" | "none";
  className?: string;
  overlayClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
  showCloseButton?: boolean;
  keepMounted?: boolean;
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
  overlayClassName = "",
  headerClassName = "",
  bodyClassName = "",
  hideHeader = false,
  showCloseButton = true,
  keepMounted = false,
}: ModalProps) {
  const parentVisible = useContext(ModalVisibilityContext);
  const visible = isOpen && parentVisible;
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  const dictionary = useDictionary();
  const closeLabel = dictionary.labels.closeModal;
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;

    const previousActiveElement = document.activeElement;
    if (previousActiveElement instanceof HTMLElement &&
        !dialogRef.current?.contains(previousActiveElement)) {
      returnFocusRef.current = previousActiveElement;
    }
    const returnFocusElement = returnFocusRef.current;
    if (scrollLockCount === 0) originalBodyOverflow = document.body.style.overflow;
    scrollLockCount += 1;
    document.body.style.overflow = "hidden";

    if (initialFocus === "close" &&
        !dialogRef.current?.querySelector('[role="dialog"][aria-modal="true"]')) {
      closeButtonRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogRef.current?.closest('[role="dialog"]') !== dialogs[dialogs.length - 1]) {
        return;
      }
      if (event.key === "Escape") {
        if (event.defaultPrevented || dialogRef.current?.querySelector('[data-slot="select-trigger"][aria-expanded="true"]')) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      scrollLockCount -= 1;
      if (scrollLockCount === 0) document.body.style.overflow = originalBodyOverflow;
      if (returnFocusElement?.isConnected && !returnFocusElement.closest("[hidden]")) {
        returnFocusElement.focus();
      } else {
        const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
        dialogs[dialogs.length - 1]?.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
      }
    };
  }, [initialFocus, visible]);

  if (!visible && !(keepMounted && hasOpened)) return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  }[size];

  return (
    <ModalVisibilityContext.Provider value={visible}>
    <div
      className={`fixed inset-0 z-50 ${visible ? "flex" : "hidden"} items-end justify-center bg-black/40 px-4 pb-4 pt-16 sm:items-center sm:p-6 ${overlayClassName}`}
      hidden={!visible}
      role={visible ? "dialog" : undefined}
      aria-hidden={!visible || undefined}
      aria-modal={visible || undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
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
            {showCloseButton && <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="sr-only"
            >
              {closeLabel}
            </button>}
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
            {showCloseButton && <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={buttonStyles("ghost", "m3-icon-button shrink-0 px-0")}
              aria-label={closeLabel}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>}
          </div>
        )}

        <div className={`flex-1 overflow-y-auto px-5 py-5 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
    </ModalVisibilityContext.Provider>
  );
}
