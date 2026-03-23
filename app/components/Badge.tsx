"use client";

import React, { memo } from "react";
import clsx from "clsx";

interface BadgeProps {
  color?: "blue" | "red" | "green" | "yellow" | "purple" | "gray";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

const colorClasses = {
  blue: "bg-primary-50 text-primary-700",
  red: "bg-red-50 text-red-700",
  green: "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-700",
  purple: "bg-purple-50 text-purple-700",
  gray: "bg-neutral-100 text-neutral-700",
};

const sizeClasses = {
  sm: "text-xs px-2 py-1 rounded",
  md: "text-sm px-3 py-1 rounded-md",
};

function BadgeComponent({
  color = "blue",
  size = "sm",
  children,
  className,
}: BadgeProps) {
  return (
    <span className={clsx(colorClasses[color], sizeClasses[size], className)}>
      {children}
    </span>
  );
}

export const Badge = memo(BadgeComponent);

export default Badge;
