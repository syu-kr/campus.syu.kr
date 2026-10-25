"use client";

import { focusFormError, FormFieldCounter } from "@/app/components/FormFieldFeedback";

import { FormEvent, useEffect, useState } from "react";
import {
  SubmissionResultModal,
  type SubmissionSummaryItem,
} from "@/app/components/SubmissionResultModal";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Button } from "./Button";
import { M3Select } from "./M3Select";
import type { Dictionary } from "@/lib/i18n";
import type { SiteInquiryType } from "@/types/submissions";

type ContactFormDictionary = Dictionary["pages"]["contactForm"];

interface ContactFormProps {
  defaultPageUrl?: string;
  onSuccessConfirm?: () => void;
}

export function ContactForm({
  defaultPageUrl,
  onSuccessConfirm,
}: ContactFormProps) {
  const dictionary = useDictionary();
  const text = dictionary.pages.contactForm;
  const inquiryTypes = getInquiryTypes(text);
  const [type, setType] = useState<SiteInquiryType>("suggestion");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState(defaultPageUrl || "");
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

  useEffect(() => {
    if (defaultPageUrl || pageUrl) return;
    setPageUrl(window.location.href);
  }, [defaultPageUrl, pageUrl]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedForm=event.currentTarget;
    setResultModal(null);
    setFieldErrors({});

    const clientErrors = validateSiteInquiry({ title, message, pageUrl }, text);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      focusFormError(event.currentTarget);
      return;
    }

    setIsSubmitting(true);

    try {
      const submittedType =
        inquiryTypes.find((item) => item.value === type)?.label || type;
      const submittedTitle = title.trim();
      const submittedPageUrl = pageUrl.trim();
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          title,
          message,
          pageUrl,
          contact,
          website,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.field && ["title","message","pageUrl"].includes(data.field)) {
          setFieldErrors({
            [data.field]: getServerFieldError(data.code, data.error, text),
          });
          focusFormError(submittedForm);
          return;
        }
        throw new Error(
          getServerFieldError(data.code, data.error, text) ||
            text.submitFailed,
        );
      }

      setResultModal({
        type: "success",
        title: text.successTitle,
        message: text.successMessage,
        summary: [
          { label: text.typeSummary, value: submittedType },
          { label: text.titleSummary, value: submittedTitle },
          ...(submittedPageUrl
            ? [{ label: text.pageSummary, value: submittedPageUrl }]
            : []),
        ],
      });
      setTitle("");
      setMessage("");
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

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={isSubmitting}>
        {Object.keys(fieldErrors).length>0 && <p className="m3-validation-summary col-span-full" role="alert">{text.validationMessage}</p>}
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
            id="inquiry-type-label"
            htmlFor="inquiry-type"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.typeLabel}
          </label>
          <M3Select
            id="inquiry-type"
            value={type}
            onValueChange={(value) => setType(value as SiteInquiryType)}
            options={inquiryTypes}
          />
        </div>

        <div>
          <label
            htmlFor="inquiry-title"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.titleLabel}
          </label>
          <input
            id="inquiry-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder={text.titlePlaceholder}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={
              fieldErrors.title ? "inquiry-title-error" : undefined
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.title ? "border-red-300" : "border-neutral-300"
            }`}
          />
          <FormFieldCounter id="inquiry-title-count" value={title} max={120}/>
          {fieldErrors.title && (
            <p id="inquiry-title-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="inquiry-message"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.messageLabel}
          </label>
          <textarea
            id="inquiry-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            maxLength={2000}
            required
            placeholder={text.messagePlaceholder}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={
              fieldErrors.message ? "inquiry-message-error" : undefined
            }
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.message ? "border-red-300" : "border-neutral-300"
            }`}
          />
          <FormFieldCounter id="inquiry-message-count" value={message} max={2000}/>
          {fieldErrors.message && (
            <p id="inquiry-message-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="page-url"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.pageUrlLabel}
          </label>
          <input
            id="page-url"
            type="url"
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            maxLength={500}
            placeholder="https://campus.syu.kr/..."
            aria-invalid={Boolean(fieldErrors.pageUrl)}
            aria-describedby={fieldErrors.pageUrl ? "page-url-error" : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fieldErrors.pageUrl ? "border-red-300" : "border-neutral-300"
            }`}
          />
          <FormFieldCounter id="page-url-count" value={pageUrl} max={500}/>
          {fieldErrors.pageUrl && (
            <p id="page-url-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.pageUrl}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="contact"
            className="block text-sm font-semibold text-neutral-900 mb-2"
          >
            {text.contactLabel}
            <span className="ml-1 text-xs font-normal text-neutral-500">
              {text.optional}
            </span>
          </label>
          <input
            id="contact"
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            maxLength={120}
            placeholder={text.contactPlaceholder}
            aria-describedby="contact-help"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <FormFieldCounter id="contact-count" value={contact} max={120}/>
          <p id="contact-help" className="mt-1 text-xs text-neutral-500">
            {text.contactHelp}
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? text.submitting : text.submit}
        </Button>
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

function validateSiteInquiry({
  title,
  message,
  pageUrl,
}: {
  title: string;
  message: string;
  pageUrl: string;
}, text: ContactFormDictionary): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!title.trim()) {
    errors.title = text.titleRequired;
  }

  if (!message.trim()) {
    errors.message = text.messageRequired;
  }

  if (pageUrl.trim() && !isValidHttpUrl(pageUrl.trim())) {
    errors.pageUrl = text.invalidPageUrl;
  }

  return errors;
}

function getInquiryTypes(text: ContactFormDictionary): Array<{
  value: SiteInquiryType;
  label: string;
}> {
  return [
    { value: "bug", label: text.inquiryTypes.bug },
    { value: "suggestion", label: text.inquiryTypes.suggestion },
    { value: "data-correction", label: text.inquiryTypes.dataCorrection },
    { value: "feature", label: text.inquiryTypes.feature },
    { value: "other", label: text.inquiryTypes.other },
  ];
}

function getServerFieldError(
  code: string | undefined,
  error: string | undefined,
  text: ContactFormDictionary,
) {
  if (code === "TITLE_REQUIRED") return text.titleRequired;
  if (code === "MESSAGE_REQUIRED") return text.messageRequired;
  if (code === "INVALID_PAGE_URL") return text.invalidPageUrl;

  if (code === "RATE_LIMITED") return error || text.submitFailed;
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
