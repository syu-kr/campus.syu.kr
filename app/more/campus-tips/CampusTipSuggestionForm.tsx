"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import {
  SubmissionResultModal,
  type SubmissionSummaryItem,
} from "@/app/components/SubmissionResultModal";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { localizePath, type Dictionary } from "@/lib/i18n";
import type { CampusTipCategory } from "@/types";

type CampusTipsDictionary = Dictionary["pages"]["campusTips"];
type CampusTipSuggestDictionary = Dictionary["pages"]["campusTipsSuggest"];

interface CampusTipSuggestionFormProps {
  idPrefix?: string;
  onSuccessConfirm?: () => void;
}

export function CampusTipSuggestionForm({
  idPrefix = "tip",
  onSuccessConfirm,
}: CampusTipSuggestionFormProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.campusTipsSuggest;
  const categories = getCampusTipCategories(dictionary.pages.campusTips);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CampusTipCategory>("campus-life");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [resultModal, setResultModal] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    summary?: SubmissionSummaryItem[];
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeResultModal = () => {
    const shouldCloseParent = resultModal?.type === "success";
    setResultModal(null);

    if (shouldCloseParent) {
      onSuccessConfirm?.();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResultModal(null);
    setFieldErrors({});

    const clientErrors = validateCampusTipSuggestion(
      {
        title,
        category,
        description,
        url,
      },
      text,
    );
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setResultModal({
        type: "error",
        title: text.validationTitle,
        message: text.validationMessage,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submittedTitle = title.trim();
      const submittedCategory =
        categories.find((item) => item.value === category)?.label || category;
      const submittedUrl = url.trim();
      const response = await fetch("/api/campus-tips/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          category,
          description,
          url,
          tags,
          note,
          contact,
          website,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        const serverError = getServerFieldError(data.field, text);
        if (data.field) {
          setFieldErrors({ [data.field]: serverError });
        }
        throw new Error(serverError || text.submitFailed);
      }

      setResultModal({
        type: "success",
        title: text.successTitle,
        message: text.successMessage,
        summary: [
          { label: text.summaryTitle, value: submittedTitle },
          { label: text.summaryCategory, value: submittedCategory },
          ...(submittedUrl
            ? [{ label: text.summaryLink, value: submittedUrl }]
            : []),
        ],
      });
      setTitle("");
      setDescription("");
      setUrl("");
      setTags("");
      setNote("");
      setContact("");
      setWebsite("");
    } catch (err) {
      setResultModal({
        type: "error",
        title: text.submitFailed,
        message: err instanceof Error ? err.message : text.submitFailed,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleId = `${idPrefix}-title`;
  const categoryId = `${idPrefix}-category`;
  const descriptionId = `${idPrefix}-description`;
  const urlId = `${idPrefix}-url`;
  const tagsId = `${idPrefix}-tags`;
  const noteId = `${idPrefix}-note`;
  const contactId = `${idPrefix}-contact`;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div>
          <label
            htmlFor={titleId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.titleLabel}
          </label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder={text.titlePlaceholder}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={
              fieldErrors.title ? `${titleId}-error` : undefined
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.title ? "border-red-300" : "border-neutral-300"
            }`}
          />
          {fieldErrors.title && (
            <p id={`${titleId}-error`} className="mt-1 text-xs text-red-600">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={categoryId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.categoryLabel}
          </label>
          <select
            id={categoryId}
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as CampusTipCategory)
            }
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={descriptionId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.descriptionLabel}
          </label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            maxLength={1200}
            placeholder={text.descriptionPlaceholder}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={
              fieldErrors.description ? `${descriptionId}-error` : undefined
            }
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.description ? "border-red-300" : "border-neutral-300"
            }`}
          />
          {fieldErrors.description && (
            <p
              id={`${descriptionId}-error`}
              className="mt-1 text-xs text-red-600"
            >
              {fieldErrors.description}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={urlId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.urlLabel}
          </label>
          <input
            id={urlId}
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            maxLength={500}
            placeholder={text.urlPlaceholder}
            aria-invalid={Boolean(fieldErrors.url)}
            aria-describedby={fieldErrors.url ? `${urlId}-error` : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.url ? "border-red-300" : "border-neutral-300"
            }`}
          />
          {fieldErrors.url && (
            <p id={`${urlId}-error`} className="mt-1 text-xs text-red-600">
              {fieldErrors.url}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={tagsId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.tagsLabel}
          </label>
          <input
            id={tagsId}
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={text.tagsPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-neutral-500">{text.tagsHelp}</p>
        </div>

        <div>
          <label
            htmlFor={noteId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.noteLabel}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={text.notePlaceholder}
            className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label
            htmlFor={contactId}
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.contactLabel}
            <span className="ml-1 text-xs font-normal text-neutral-500">
              {text.optional}
            </span>
          </label>
          <input
            id={contactId}
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            maxLength={120}
            placeholder={text.contactPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {text.contactHelpPrefix}{" "}
            <Link
              href={localizePath("/privacy", locale)}
              className="text-primary-600 hover:text-primary-700"
            >
              {text.privacyPolicy}
            </Link>
            {text.contactHelpSuffix}
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSubmitting ? text.submitting : text.submit}
        </button>
      </form>

      {resultModal && (
        <SubmissionResultModal
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          summary={resultModal.summary}
          onClose={closeResultModal}
        />
      )}
    </>
  );
}

function validateCampusTipSuggestion(
  {
    title,
    category,
    description,
    url,
  }: {
    title: string;
    category: CampusTipCategory;
    description: string;
    url: string;
  },
  text: CampusTipSuggestDictionary,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!title.trim()) {
    errors.title = text.titleRequired;
  }

  if (!category) {
    errors.category = text.categoryRequired;
  }

  if (!description.trim()) {
    errors.description = text.descriptionRequired;
  }

  if (url.trim() && !isValidHttpUrl(url.trim())) {
    errors.url = text.invalidUrl;
  }

  return errors;
}

function getCampusTipCategories(text: CampusTipsDictionary): Array<{
  value: CampusTipCategory;
  label: string;
}> {
  return [
    { value: "school", label: text.categories.school },
    { value: "campus-life", label: text.categories.campusLife },
    { value: "finance", label: text.categories.finance },
    { value: "certificate", label: text.categories.certificate },
    { value: "activity", label: text.categories.activity },
    { value: "career", label: text.categories.career },
    { value: "culture", label: text.categories.culture },
    { value: "local", label: text.categories.local },
    { value: "reference", label: text.categories.reference },
  ];
}

function getServerFieldError(
  field: string | undefined,
  text: CampusTipSuggestDictionary,
) {
  if (field === "title") return text.titleRequired;
  if (field === "category") return text.categoryRequired;
  if (field === "description") return text.descriptionRequired;
  if (field === "url") return text.invalidUrl;

  return text.submitFailed;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
