import {
  serializeJsonLd,
  type JsonLdValue,
} from "@/lib/structured-data";

type StructuredDataScriptProps = {
  id: string;
  data: JsonLdValue;
  nonce?: string;
};

export function StructuredDataScript({
  id,
  data,
  nonce,
}: StructuredDataScriptProps) {
  return (
    <script
      id={id}
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  );
}
