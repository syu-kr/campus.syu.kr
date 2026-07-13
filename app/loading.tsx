import { getDictionary } from "@/lib/i18n";

export default function Loading() {
  const text = getDictionary("ko").errorBoundary;

  return (
    <div
      className="mx-auto max-w-7xl px-6 py-10 text-sm text-neutral-600"
      role="status"
      aria-live="polite"
    >
      {text.loading}
    </div>
  );
}
