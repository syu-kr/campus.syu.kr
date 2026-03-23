import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  children: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  isLoading = false,
  disabled = false,
  className = "",
  ...props
}: ButtonProps) {
  // Size mapping
  const sizeClasses = {
    xs: "px-3 py-1.5 text-xs",
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Variant mapping
  const variantClasses = {
    primary:
      "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-neutral-300 disabled:text-neutral-600",
    secondary:
      "border-2 border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 disabled:border-neutral-300 disabled:text-neutral-300",
    ghost:
      "text-primary-600 hover:bg-primary-50 active:bg-primary-100 disabled:text-neutral-300",
  };

  const baseClasses =
    "font-medium rounded-button transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed";

  const finalClassName = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  return (
    <button
      className={finalClassName}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin"></span>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
