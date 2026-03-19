export interface MockDataAlertProps {
  title?: string;
  message: string;
  type?: "info" | "warning";
}

export function MockDataAlert({
  title = "💡 알림",
  message,
  type = "info",
}: MockDataAlertProps) {
  const bgColor = type === "warning" ? "bg-yellow-50" : "bg-blue-50";
  const borderColor =
    type === "warning" ? "border-yellow-200" : "border-blue-200";
  const textColor = type === "warning" ? "text-yellow-800" : "text-blue-800";

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-6 ${textColor}`}
    >
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
