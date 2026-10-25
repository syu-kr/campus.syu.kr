"use client";

import { useEffect } from "react";
import { useDictionary } from "./LocaleProvider";

export function focusFormError(form: HTMLFormElement) {
  requestAnimationFrame(() => {
    if (!form.isConnected || form.closest("[hidden], [inert]")) return;
    const field = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  });
}

export function FormFieldCounter({
  id,
  value,
  max,
}: {
  id: string;
  value: string;
  max: number;
}) {
  const dictionary = useDictionary();

  useEffect(() => {
    const field = document.getElementById(id.replace(/-count$/, ""));
    if (!field) return;
    const descriptions = new Set(
      (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean),
    );
    descriptions.add(id);
    field.setAttribute("aria-describedby", [...descriptions].join(" "));
  });

  return (
    <p id={id} className="m3-field-counter">
      <span className="sr-only">{dictionary.labels.charactersUsed}</span>
      {value.length} / {max}
    </p>
  );
}
