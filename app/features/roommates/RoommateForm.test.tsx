import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getRoommateText } from "@/lib/i18n/roommates";
import { DAY_MS, koreaDate } from "@/lib/roommates";
import type { RoommatePost } from "@/types/roommates";
import RoommateForm from "./RoommateForm";

afterEach(() => vi.unstubAllGlobals());

function listing(): RoommatePost {
  const now = Date.now();
  return {
    id: "00000000000000000001", nickname: "학생님", dorm: "peniel", roomSize: 2,
    roommatesNeeded: 1, stayStart: koreaDate(now), stayEnd: koreaDate(now + 60 * DAY_MS),
    recruitUntil: koreaDate(now + 20 * DAY_MS), habits: {}, description: "함께 지낼 분",
    openChatUrl: "https://open.kakao.com/o/FormTest123", status: "recruiting", version: 1,
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 50 * DAY_MS).toISOString(),
  };
}

describe("roommate listing disclosure consent", () => {
  it("shows the disclosure notice and blocks new submissions until the writer explicitly agrees", async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    const text = getRoommateText("ko"); const submit = vi.fn().mockResolvedValue(undefined);
    render(<RoommateForm onSubmit={submit} />);
    for (const copy of [text.disclosureRecipients, text.disclosurePurpose, text.disclosureItems, text.disclosurePeriod, text.disclosureRefusal, text.disclosureWithdrawal]) {
      expect(screen.getByText(copy)).toBeVisible();
    }
    expect(screen.getByRole("link", { name: text.privacyPolicy })).toHaveAttribute("href", "/privacy");
    const consent = screen.getByRole("checkbox", { name: text.disclosureAgree });
    expect(consent).not.toBeChecked();
    const form = screen.getByRole("button", { name: text.create }).closest("form")!;
    await act(async () => fireEvent.submit(form));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(text.validation.disclosureConsent);
    expect(consent).toHaveFocus(); expect(consent).toHaveAttribute("aria-invalid", "true");
    const post = listing();
    for (const name of ["nickname", "stayStart", "stayEnd", "recruitUntil", "openChatUrl"] as const) {
      fireEvent.change(form.querySelector(`[name="${name}"]`)!, { target: { value: post[name] } });
    }
    fireEvent.click(consent);
    await act(async () => fireEvent.submit(form));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ disclosureConsent: true, habits: {}, nickname: post.nickname }));
  });

  it("requires a fresh unchecked consent when editing and localizes the privacy policy link", async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    const text = getRoommateText("en"); const submit = vi.fn().mockResolvedValue(undefined); const post = listing();
    render(<LocaleProvider locale="en"><RoommateForm post={post} onSubmit={submit} /></LocaleProvider>);
    expect(screen.getByRole("link", { name: text.privacyPolicy })).toHaveAttribute("href", "/en/privacy");
    const consent = screen.getByRole("checkbox", { name: text.disclosureAgree });
    expect(consent).not.toBeChecked();
    const form = screen.getByRole("button", { name: text.save }).closest("form")!;
    await act(async () => fireEvent.submit(form));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(consent);
    await act(async () => fireEvent.submit(form));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ disclosureConsent: true, nickname: post.nickname, openChatUrl: post.openChatUrl }));
  });
});
