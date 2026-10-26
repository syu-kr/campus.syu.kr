"use client";

import { ContactModal } from "./components/ContactModal";
import { Button, buttonStyles } from "./components/Button";
import { Icon } from "./components/Icon";
import { useDictionary, useLocale } from "./components/LocaleProvider";
import { localizePath } from "@/lib/i18n/routing";
import Link from "next/link";
import { useState } from "react";

export default function NotFound() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <section className="rounded-card bg-white p-6 sm:p-8" aria-labelledby="not-found-title">
        <p className="mb-3 text-sm font-semibold text-primary-600" aria-hidden="true">404</p>
        <h1 id="not-found-title" className="mb-3 break-keep">{dictionary.notFound.title}</h1>
        <p className="text-neutral-600">{dictionary.notFound.description}</p>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600">
          {dictionary.notFound.helpItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={localizePath("/", locale)} className={buttonStyles("primary", "w-full sm:w-auto")}>
            <Icon name="home" size={20} />
            <span>{dictionary.notFound.homeAction}</span>
          </Link>
          <Button variant="secondary" type="button" onClick={() => setIsContactOpen(true)} className="w-full sm:w-auto">
            <Icon name="megaphone" size={20} />
            <span>{dictionary.notFound.contactAction}</span>
          </Button>
        </div>
      </section>
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
