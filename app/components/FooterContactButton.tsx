"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useDictionary } from "@/app/components/LocaleProvider";

const ContactModal = dynamic(() =>
  import("./ContactModal").then((module) => module.ContactModal),
);

export function FooterContactButton() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
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
      {isOpen !== null && (
        <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
