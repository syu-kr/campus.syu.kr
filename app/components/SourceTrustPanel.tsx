import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";

type SourceTrustBadge = {
  color?: "blue" | "red" | "green" | "yellow" | "purple" | "gray";
  label: string;
};

type SourceTrustItem = {
  href?: string;
  label: string;
  value: string;
};

type SourceTrustPanelProps = {
  badges?: SourceTrustBadge[];
  description: string;
  items: SourceTrustItem[];
  note?: string;
  title: string;
};

export function SourceTrustPanel({
  badges = [],
  description,
  items,
  note,
  title,
}: SourceTrustPanelProps) {
  return (
    <Card
      as="section"
      hover={false}
      className="border border-neutral-200 bg-white shadow-none"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {badges.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Badge key={badge.label} color={badge.color ?? "gray"}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
            <h2 className="text-base font-bold text-neutral-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              {description}
            </p>
          </div>
        </div>

        <dl className="grid gap-2 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
            >
              <dt className="text-xs font-semibold text-neutral-500">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm font-medium leading-6 text-neutral-900">
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-700 hover:underline"
                  >
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {note && (
          <p className="border-t border-neutral-100 pt-3 text-xs leading-5 text-neutral-500">
            {note}
          </p>
        )}
      </div>
    </Card>
  );
}
