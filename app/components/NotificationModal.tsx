"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useDictionary } from "@/app/components/LocaleProvider";

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

let notificationSetter: ((payload: NotificationPayload) => void) | null = null;

export function setNotificationHandler(payload: NotificationPayload) {
  if (notificationSetter) {
    notificationSetter(payload);
  }
}

export function NotificationModal() {
  const dictionary = useDictionary();
  const labels = dictionary.labels;
  const [notification, setNotification] = useState<NotificationPayload | null>(
    null,
  );
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    notificationSetter = (payload) => {
      setNotification(payload);
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleClick = () => {
    if (notification?.url) {
      window.location.href = notification.url;
    }
    handleClose();
  };

  if (!isVisible || !notification) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end z-50 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-title"
    >
      <div
        className="pointer-events-auto w-full bg-white rounded-t-2xl shadow-2xl p-6 sm:rounded-lg sm:m-4 sm:max-w-md sm:ml-auto sm:mr-auto animate-in slide-in-from-bottom-5"
        onClick={handleClick}
      >
        <div className="flex items-start gap-4">
          {notification.icon && (
            <Image
              src={notification.icon}
              alt={`${notification.title} ${labels.notificationIconAltSuffix}`}
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3
              id="notification-title"
              className="font-semibold text-gray-900 break-words"
            >
              {notification.title}
            </h3>
            <p className="text-sm text-gray-600 mt-1 break-words">
              {notification.body}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}
