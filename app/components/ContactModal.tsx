"use client";

import { ContactForm } from "@/app/components/ContactForm";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Modal } from "@/app/components/Modal";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const dictionary = useDictionary();
  const currentUrl =
    typeof window === "undefined" ? "" : window.location.href;

  return (
    <Modal
      isOpen={isOpen}
      title={dictionary.footer.contact}
      description={dictionary.footer.contactDescription}
      onClose={onClose}
    >
      <ContactForm defaultPageUrl={currentUrl} onSuccessConfirm={onClose} />
    </Modal>
  );
}
