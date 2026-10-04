"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { getRoommateText } from "@/lib/i18n/roommates";
import { localizePath } from "@/lib/i18n";
import type { RoommatePost, RoommatePostInput } from "@/types/roommates";
import { jsonRequest, roommateRequest } from "./client";
import { RoommateHeading } from "./RoommateShared";
import RoommateForm from "./RoommateForm";

export default function RoommateNew() {
  const locale = useLocale(); const text = getRoommateText(locale); const router = useRouter(); const queryClient = useQueryClient();
  async function submit(input: RoommatePostInput) {
    const { post } = await roommateRequest<{ post: RoommatePost }>("posts", jsonRequest("POST", input));
    await queryClient.invalidateQueries({ queryKey: ["roommates"] });
    router.replace(localizePath(`/campus/roommates/${post.id}`, locale));
  }
  return <><RoommateHeading title={text.create} /><RoommateForm onSubmit={submit} /><p className="mt-5 text-sm text-neutral-500">{text.termsHint}</p></>;
}
