"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MANAGED_POPUP_BOOTSTRAP } from "@/lib/managed-popup-bootstrap";
import { Modal } from "./Modal";

type PopupDialog = HTMLDialogElement & { __campusPopupCleanup?: () => void };

interface NativeManagedPopupProps {
  title: string;
  titleLang?: string;
  onClose: () => void;
  children: ReactNode;
  ready: boolean;
  nonce?: string;
  storageKey: string;
  startsAt: string | null;
  endsAt: string | null;
}

export function NativeManagedPopup({ title, titleLang, onClose, children, ready, nonce, storageKey, startsAt, endsAt }: NativeManagedPopupProps) {
  const dialogRef = useRef<PopupDialog>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const titleId = useId();
  const starts = startsAt ? Date.parse(startsAt) : null;
  const ends = endsAt ? Date.parse(endsAt) : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      dialog?.__campusPopupCleanup?.();
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!ready || !dialog) return;
    dialog.__campusPopupCleanup?.();
    dialog.dataset.hydrated = "true";
    const now = Date.now(), dismissed = dialog.dataset.dismissedUntil;
    if (dismissed === "closed" || Number(dismissed) > now || (starts !== null && starts > now) || (ends !== null && ends <= now)) {
      if (dialog.open) dialog.close();
      return;
    }
    const otherDialog = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')).some(node => node !== dialog && !node.closest('[hidden], [aria-hidden="true"]') && !(node.tagName === "DIALOG" && !(node as HTMLDialogElement).open));
    if (otherDialog) {
      if (dialog.open) dialog.close();
      return;
    }
    if (typeof dialog.showModal !== "function") {
      setFallback(true);
      return;
    }
    if (!dialog.open) {
      try {
        dialog.showModal();
        dialog.querySelector<HTMLElement>('button[data-popup-action="close"]')?.focus({ preventScroll: true });
      } catch {
        setFallback(true);
      }
    }
  }, [ready, starts, ends]);

  useEffect(() => {
    if (fallback) fallbackRef.current?.querySelector<HTMLElement>('button[data-popup-action="close"]')?.focus({ preventScroll: true });
  }, [fallback]);

  if (fallback && ready) return <Modal isOpen title={title} titleLang={titleLang} onClose={onClose} initialFocus="none" showCloseButton={false} size="sm" className="m3-managed-popup" overlayClassName="m3-managed-popup-overlay" headerClassName="m3-managed-popup-header" bodyClassName="m3-managed-popup-body">
    <div ref={fallbackRef}>{children}</div>
  </Modal>;

  return <>
    <dialog ref={dialogRef} className="m3-managed-popup-overlay" aria-modal="true" aria-labelledby={titleId}
      data-managed-popup={storageKey} data-starts-at={starts ?? ""} data-ends-at={ends ?? ""} suppressHydrationWarning
      onCancel={ready ? event => { event.preventDefault();onClose(); } : undefined}
      onClick={ready ? event => { if (event.target === event.currentTarget) onClose(); } : undefined}>
      <div className="m3-managed-popup">
        <div className="m3-managed-popup-header"><h2 id={titleId} lang={titleLang}>{title}</h2></div>
        <div className="m3-managed-popup-body">{children}</div>
      </div>
    </dialog>
    <script nonce={nonce} dangerouslySetInnerHTML={{ __html: MANAGED_POPUP_BOOTSTRAP }} />
  </>;
}



