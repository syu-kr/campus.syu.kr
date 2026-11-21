"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "./Button";
import { useDictionary } from "./LocaleContext";

const PwaInstallHelp = dynamic(() => import("./PwaInstallHelp").then((module) => module.PwaInstallHelp));

export function PwaInstallHelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const { home: text } = useDictionary();

  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={(event) => {
        trigger.current = event.currentTarget;
        setIsOpen(true);
      }}>
        {text.pwaHelpAction}
      </Button>
      {isOpen && <PwaInstallHelp onClose={() => {
        setIsOpen(false);
        window.requestAnimationFrame(() => trigger.current?.focus());
      }} />}
    </>
  );
}
