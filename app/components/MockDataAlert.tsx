"use client";

import { Icon } from "@/app/components/Icon";

export interface MockDataAlertProps {
  title?: string;
  message: string;
  type?: "info" | "warning";
}

export function MockDataAlert({
  title = "알림",
  message,
  type = "info",
}: MockDataAlertProps) {
  const bgColor = type === "warning" ? "bg-yellow-50" : "bg-blue-50";
  const borderColor =
    type === "warning" ? "border-yellow-200" : "border-blue-200";
  const textColor = type === "warning" ? "text-yellow-800" : "text-blue-800";
  const iconName = type === "warning" ? "alert-triangle" : "lightbulb";
  const iconColor = type === "warning" ? "text-yellow-600" : "text-blue-600";

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-6 ${textColor}`}
    >
      <p className="font-semibold mb-1 flex items-center gap-2">
        <Icon
          name={iconName}
          size={18}
          className={`flex-shrink-0 ${iconColor}`}
        />
        {title}
      </p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
