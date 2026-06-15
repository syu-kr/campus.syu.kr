"use client";

import { useState } from "react";
import { ContactModal } from "@/app/components/ContactModal";
import { useDictionary } from "@/app/components/LocaleProvider";

export function FooterContactButton() {
  const [isOpen, setIsOpen] = useState(false);
  const dictionary = useDictionary();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
      >
        {dictionary.footer.contact}
      </button>
      <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
