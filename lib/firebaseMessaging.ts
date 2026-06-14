import { getMessaging } from "firebase-admin/messaging";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";

export async function sendFCMMessage(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
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
          icon: "/images/syu-kr-logo.png",
          badge: "/images/syu-kr-logo.png",
        },
        data: data || {},
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((result, responseIndex) => {
      if (!result.success && isInvalidFcmTokenError(result.error?.code)) {
        invalidTokens.push(batchTokens[responseIndex]);
      }
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
