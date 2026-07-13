"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notificationSetter = (payload) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      setNotification(payload);
      setIsVisible(true);
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        hideTimeoutRef.current = null;
      }, 5000);
    };

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      notificationSetter = null;
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
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-5"
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
