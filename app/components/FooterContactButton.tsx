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
        className="cursor-pointer text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        {dictionary.footer.contact}
      </button>
      <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
