"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import {
  SubmissionResultModal,
  type SubmissionSummaryItem,
} from "@/app/components/SubmissionResultModal";

const categories = [
  { value: "school", label: "학교" },
  { value: "campus-life", label: "캠퍼스생활" },
  { value: "finance", label: "금융/장학" },
  { value: "certificate", label: "자격증" },
  { value: "activity", label: "공모전/대외활동" },
  { value: "career", label: "취업" },
  { value: "culture", label: "문화생활" },
  { value: "local", label: "별내동" },
  { value: "reference", label: "참고자료" },
];

export default function CampusTipSuggestPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("campus-life");
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
    const shouldReturnToTips = resultModal?.type === "success";
    setResultModal(null);

    if (shouldReturnToTips) {
      router.push("/more/campus-tips");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResultModal(null);
    setFieldErrors({});

    const clientErrors = validateCampusTipSuggestion({
      title,
      description,
      url,
    });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setResultModal({
        type: "error",
        title: "입력 내용을 확인해주세요",
        message: "표시된 항목을 수정한 뒤 다시 제출해주세요.",
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
        if (data.field) {
          setFieldErrors({ [data.field]: data.error });
        }
        throw new Error(data.error || "꿀팁 제보를 접수하지 못했습니다");
      }

      setResultModal({
        type: "success",
        title: "제보가 접수되었습니다",
        message: "검토 후 캠퍼스 꿀팁에 반영될 수 있습니다.",
        summary: [
          { label: "제목", value: submittedTitle },
          { label: "카테고리", value: submittedCategory },
          ...(submittedUrl ? [{ label: "링크", value: submittedUrl }] : []),
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
        title: "제보를 접수하지 못했습니다",
        message:
          err instanceof Error
            ? err.message
            : "꿀팁 제보를 접수하지 못했습니다",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href="/more/campus-tips"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-4"
        >
          ← 캠퍼스 꿀팁
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          꿀팁 제보하기
        </h1>
        <p className="text-neutral-600">
          학교생활에 도움이 되는 정보나 링크를 알려주세요. 검토 후 서비스에
          반영될 수 있습니다.
        </p>
      </div>

      <Card hover={false}>
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
              htmlFor="tip-title"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              제목
            </label>
            <input
              id="tip-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="예: 중앙도서관 프린트 이용 팁"
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "tip-title-error" : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                fieldErrors.title ? "border-red-300" : "border-neutral-300"
              }`}
            />
            {fieldErrors.title && (
              <p id="tip-title-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tip-category"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              카테고리
            </label>
            <select
              id="tip-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
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
              htmlFor="tip-description"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              꿀팁 내용
            </label>
            <textarea
              id="tip-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              maxLength={1200}
              placeholder="무엇을 어디에서 확인할 수 있는지, 왜 유용한지 적어주세요."
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description ? "tip-description-error" : undefined
              }
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                fieldErrors.description
                  ? "border-red-300"
                  : "border-neutral-300"
              }`}
            />
            {fieldErrors.description && (
              <p
                id="tip-description-error"
                className="mt-1 text-xs text-red-600"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tip-url"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              관련 링크
            </label>
            <input
              id="tip-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={500}
              placeholder="https://..."
              aria-invalid={Boolean(fieldErrors.url)}
              aria-describedby={fieldErrors.url ? "tip-url-error" : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                fieldErrors.url ? "border-red-300" : "border-neutral-300"
              }`}
            />
            {fieldErrors.url && (
              <p id="tip-url-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.url}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tip-tags"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              태그
            </label>
            <input
              id="tip-tags"
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="도서관, 프린트, 과제"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              쉼표로 구분해주세요.
            </p>
          </div>

          <div>
            <label
              htmlFor="tip-note"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              추가 메모
            </label>
            <textarea
              id="tip-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="운영자가 확인하면 좋을 내용을 적어주세요."
              className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label
              htmlFor="tip-contact"
              className="block text-sm font-semibold text-neutral-900 mb-2"
            >
              연락처
              <span className="ml-1 text-xs font-normal text-neutral-500">
                선택
              </span>
            </label>
            <input
              id="tip-contact"
              type="text"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              maxLength={120}
              placeholder="확인이 필요한 경우 참고할 이메일 또는 연락처"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              검토 연락용 선택 항목이며, 개별 답변을 보장하지 않습니다. 처리
              기준은{" "}
              <Link href="/privacy" className="text-primary-600 hover:text-primary-700">
                개인정보처리방침
              </Link>
              을 따릅니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSubmitting ? "접수 중..." : "꿀팁 제보하기"}
          </button>
        </form>
      </Card>

      {resultModal && (
        <SubmissionResultModal
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          summary={resultModal.summary}
          onClose={closeResultModal}
        />
      )}
    </Container>
  );
}

function validateCampusTipSuggestion({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!title.trim()) {
    errors.title = "제목을 입력해주세요";
  }

  if (!description.trim()) {
    errors.description = "꿀팁 내용을 입력해주세요";
  }

  if (url.trim() && !isValidHttpUrl(url.trim())) {
    errors.url = "관련 링크 형식이 올바르지 않습니다";
  }

  return errors;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
