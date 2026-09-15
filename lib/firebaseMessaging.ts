import { getMessaging } from "firebase-admin/messaging";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";

export interface FcmBatchResult {
  batchIndex: number;
  tokensCount: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export async function sendFCMMessage(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  onBatchComplete?: (result: FcmBatchResult) => Promise<void>,
) {
  const messaging = getMessaging(initializeFirebaseAdmin());
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += 500) {
    const batchTokens = tokens.slice(index, index + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/images/syu-campus-app-icon-192.png",
          badge: "/images/syu-campus-notification-badge-96.png",
        },
        data: data || {},
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;
    const batchInvalidTokens: string[] = [];
    response.responses.forEach((result, responseIndex) => {
      if (!result.success && isInvalidFcmTokenError(result.error?.code)) {
        batchInvalidTokens.push(batchTokens[responseIndex]);
      }
    });
    invalidTokens.push(...batchInvalidTokens);
    await onBatchComplete?.({
      batchIndex: index / 500,
      tokensCount: batchTokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens: batchInvalidTokens,
    });
  }

  return { successCount, failureCount, invalidTokens };
}

function isInvalidFcmTokenError(code: string | undefined) {
  return (
    code === "messaging/invalid-registration-token" ||
    code === "messaging/registration-token-not-registered"
  );
}
