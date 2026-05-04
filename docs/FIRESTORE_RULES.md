# Firestore 보안 규칙

이 프로젝트는 클라이언트에서 Firestore를 직접 읽거나 쓰지 않고, Next.js API Route와 Firebase Admin SDK를 통해서만 접근합니다. Firebase 콘솔의 Firestore Rules에는 아래 규칙을 적용하세요.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /meet_rooms/{roomId} {
      allow read, write: if false;

      match /participants/{participantId} {
        allow read, write: if false;
      }
    }

    match /campus_tip_suggestions/{suggestionId} {
      allow read, write: if false;
    }

    match /site_inquiries/{inquiryId} {
      allow read, write: if false;
    }

    match /user_devices/{deviceId} {
      allow read, write: if false;
    }

    match /notifications_sent/{notificationId} {
      allow read, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

사용 컬렉션:

- `meet_rooms`: 일정 잡기 방 정보
- `meet_rooms/{roomId}/participants`: 일정 잡기 참여자 가능 시간
- `campus_tip_suggestions`: 캠퍼스 꿀팁 제보
- `site_inquiries`: 사이트 문의
- `user_devices`: FCM 구독 토큰
- `notifications_sent`: 발송된 푸시 알림 기록
