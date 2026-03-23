"use client";

import React, { memo } from "react";
import clsx from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
  clickable?: boolean;
  as?: "div" | "article" | "section";
}

function CardComponent({
  children,
  hover = true,
  clickable = false,
  as: Component = "div",
  className,
  ...props
}: CardProps) {
  return (
    <Component
      className={clsx(
        "bg-white rounded-card p-4 shadow-card",
        hover && "hover:shadow-card-hover transition-shadow duration-200",
        clickable && "cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export const Card = memo(CardComponent);

export default Card;
