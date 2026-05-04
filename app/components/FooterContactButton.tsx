"use client";

import { useState } from "react";
import { ContactModal } from "@/app/components/ContactModal";

export function FooterContactButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
      >
        사이트 문의하기
      </button>
      <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
