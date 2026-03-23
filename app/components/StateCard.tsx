import React from "react";
import { Icon } from "./Icon";

interface StateCardProps {
  type: "error" | "warning" | "info";
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export function StateCard({
  type,
  title,
  message,
  action,
  className = "",
}: StateCardProps) {
  const stateConfig = {
    error: {
      bg: "bg-red-50",
      border: "border-red-300",
      iconName: "alert-circle",
      iconColor: "text-red-600",
      titleColor: "text-red-900",
      textColor: "text-red-700",
    },
    warning: {
      bg: "bg-orange-50",
      border: "border-orange-300",
      iconName: "alert-triangle",
      iconColor: "text-orange-600",
      titleColor: "text-orange-900",
      textColor: "text-orange-700",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-300",
      iconName: "info",
      iconColor: "text-blue-600",
      titleColor: "text-blue-900",
      textColor: "text-blue-700",
    },
  };

  const config = stateConfig[type];

  return (
    <div
      className={`${config.bg} border ${config.border} rounded-lg p-4 ${className}`}
      role="alert"
    >
      <div className="flex gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
          <Icon name={config.iconName} size={20} color="currentColor" />
        </div>
        <div className="flex-1">
          {title && (
            <h3 className={`font-semibold mb-1 ${config.titleColor}`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${config.textColor}`}>{message}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
