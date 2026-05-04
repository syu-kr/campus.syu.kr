"use client";

import { ContactForm } from "@/app/components/ContactForm";
import { Modal } from "@/app/components/Modal";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const currentUrl =
    typeof window === "undefined" ? "" : window.location.href;

  return (
    <Modal
      isOpen={isOpen}
      title="사이트 문의하기"
      description="오류, 정보 수정, 기능 제안 등을 남겨주세요."
      onClose={onClose}
    >
      <ContactForm defaultPageUrl={currentUrl} onSuccessConfirm={onClose} />
    </Modal>
  );
}
