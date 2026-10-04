/** Disable analytics before Next changes history, including navigation from a public page. */
export function protectRoommateLinkPrivacy() {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as Window & { "ga-disable-G-SD8QFQWFVQ"?: boolean };
  analyticsWindow["ga-disable-G-SD8QFQWFVQ"] = true;
}
