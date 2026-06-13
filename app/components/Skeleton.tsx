import clsx from "clsx";

interface SkeletonProps {
  variant?: "card" | "text" | "line" | "circle";
  width?: string;
  height?: string;
  className?: string;
  count?: number;
}

export function Skeleton({
  variant = "card",
  width,
  height,
  className,
  count = 1,
}: SkeletonProps) {
  const variantClasses = {
    card: "rounded-card h-24 bg-neutral-100",
    text: "rounded h-4 bg-neutral-100 w-3/4",
    line: "rounded h-2 bg-neutral-100 w-full",
    circle: "rounded-full w-10 h-10 bg-neutral-100",
  };

  const styles = {
    width: width || (variant === "circle" ? "40px" : "100%"),
    height: height || (variant === "card" ? "96px" : "16px"),
  };

  return (
    <div className="animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx(variantClasses[variant], className, i > 0 && "mt-4")}
          style={styles}
        />
      ))}
    </div>
  );
}
