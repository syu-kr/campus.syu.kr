"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { CampusTipSuggestionForm } from "@/app/features/campus-tips/CampusTipSuggestionForm";
import { localizePath } from "@/lib/i18n";

export default function CampusTipSuggestPage() {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.campusTipsSuggest;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <Card hover={false}>
        <CampusTipSuggestionForm
          idPrefix="tip-page"
          onSuccessConfirm={() =>
            router.push(localizePath("/campus/campus-tips", locale))
          }
        />
      </Card>
    </Container>
  );
}
