"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/app/components/Modal";
import { Icon } from "@/app/components/Icon";
import { useDictionary } from "@/app/components/LocaleProvider";
import { getPhoneNumberOptions, getTelHref } from "@/lib/phone";
import { buttonStyles } from "./Button";

interface PhoneCallButtonProps {
  department: string;
  phone: string;
  phoneNumbers?: string[];
  className?: string;
  children?: ReactNode;
}

export function PhoneCallButton({
  department,
  phone,
  phoneNumbers,
  className,
  children,
}: PhoneCallButtonProps) {
  const dictionary = useDictionary();
  const text = dictionary.pages.phone;
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const numbers = useMemo(
    () => getPhoneNumberOptions({ phone, phoneNumbers }),
    [phone, phoneNumbers],
  );
  const label = children ?? (
    <>
      <Icon name="phone" size={14} />
      <span>{text.call}</span>
    </>
  );

  if (numbers.length <= 1) {
    return (
      <a
        href={getTelHref(numbers[0] ?? phone)}
        className={buttonStyles("primary", className)}
        aria-label={`${department} ${text.call}`}
      >
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        className={buttonStyles("primary", className)}
        aria-haspopup="dialog"
        aria-label={`${department} ${text.call}`}
      >
        {label}
      </button>
      <Modal
        isOpen={isPickerOpen}
        title={text.callOptionsTitle}
        description={text.callOptionsDescription}
        onClose={() => setIsPickerOpen(false)}
        size="sm"
      >
        <div className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900">
          {department}
        </div>
        <div className="space-y-2">
          {numbers.map((number) => (
            <a
              key={number}
              href={getTelHref(number)}
              onClick={() => setIsPickerOpen(false)}
              className={buttonStyles("secondary", "w-full justify-between")}
            >
              <span>{number}</span>
              <Icon name="phone" size={16} className="text-primary-600" />
            </a>
          ))}
        </div>
      </Modal>
    </>
  );
}
