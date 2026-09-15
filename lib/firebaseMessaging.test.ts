import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEachForMulticast = vi.fn();

vi.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ sendEachForMulticast }),
}));
vi.mock("@/lib/firebaseAdmin", () => ({
  initializeFirebaseAdmin: () => ({}),
}));

import { sendFCMMessage } from "./firebaseMessaging";

describe("sendFCMMessage", () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset();
  });

  it("checkpoints each 500-token batch without storing token values", async () => {
    sendEachForMulticast
      .mockResolvedValueOnce({
        successCount: 499,
        failureCount: 1,
        responses: Array.from({ length: 500 }, (_, index) =>
          index === 0
            ? {
                success: false,
                error: { code: "messaging/registration-token-not-registered" },
              }
            : { success: true },
        ),
      })
      .mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
    const onBatchComplete = vi.fn(async () => undefined);
    const tokens = Array.from({ length: 501 }, (_, index) => `token-${index}`);

    const result = await sendFCMMessage(
      tokens,
      "title",
      "body",
      undefined,
      onBatchComplete,
    );

    expect(result).toEqual({
      successCount: 500,
      failureCount: 1,
      invalidTokens: ["token-0"],
    });
    expect(onBatchComplete).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        batchIndex: 0,
        tokensCount: 500,
        successCount: 499,
        failureCount: 1,
      }),
    );
    expect(onBatchComplete).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ batchIndex: 1, tokensCount: 1 }),
    );
  });
});
