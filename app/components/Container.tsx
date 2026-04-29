import React from "react";
import clsx from "clsx";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
}

export function Container({
  children,
  size = "md",
  className,
  ...props
}: ContainerProps) {
  const sizeClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    full: "w-full",
  };

  return (
    <div
      className={clsx("mx-auto px-4", sizeClasses[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
