"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { localizePath } from "@/lib/i18n";
import { useDictionary, useLocale } from "./LocaleProvider";
import { Modal } from "./Modal";
import { SearchBar } from "./SearchBar";

export default function SearchDialog({ onClose }: { onClose: () => void }) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { body.current?.querySelector("input")?.focus(); }, []);
  return <Modal isOpen title={dictionary.search.label} onClose={onClose} initialFocus="none" overlayClassName="m3-search-overlay" className="m3-search-dialog" bodyClassName="m3-search-dialog-body">
    <div ref={body}><SearchBar defaultValue={typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("search") ?? ""} onSearch={query => {
      const value = query.trim();
      if (!value) return;
      router.push(`${localizePath("/", locale)}?search=${encodeURIComponent(value)}`);
      onClose();
    }} /></div>
  </Modal>;
}
