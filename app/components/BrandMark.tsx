import { useId } from "react";

const BEAN_PATH = "M31 5C46 1 59 12 59 26C59 34 53 37 51 43C48 55 37 61 24 58C10 55 4 44 5 31C6 17 17 7 31 5Z";

export function BrandMark({ className = "" }: { className?: string }) {
  const faceMaskId = useId();
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" focusable="false">
      <defs>
        <mask id={faceMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64" style={{ maskType: "luminance" }}>
          <path d={BEAN_PATH} fill="white" />
          <circle cx="22" cy="26" r="2.6" fill="black" />
          <circle cx="38" cy="26" r="2.6" fill="black" />
          <path d="M23 36Q30 43 37 36" fill="none" stroke="black" strokeWidth="3.6" strokeLinecap="round" />
        </mask>
      </defs>
      <path d={BEAN_PATH} mask={`url(#${faceMaskId})`} />
    </svg>
  );
}
