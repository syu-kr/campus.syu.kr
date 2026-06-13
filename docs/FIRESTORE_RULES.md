# Firestore 보안 규칙

SYU CAMPUS는 클라이언트에서 Firestore를 직접 읽거나 쓰지 않습니다. Firestore 접근은 Next.js API Route와 Firebase Admin SDK를 통해 처리합니다.

Firebase 콘솔의 Firestore Rules에는 아래 규칙을 적용하세요.

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

    match /timetable_shares/{shareId} {
      allow read, write: if false;
    }

    match /api_rate_limits/{rateLimitId} {
      allow read, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 사용 컬렉션

| 컬렉션 | 용도 |
| --- | --- |
| `meet_rooms` | 일정 잡기 방 정보 |
| `meet_rooms/{roomId}/participants` | 일정 잡기 참여자 가능 시간 |
| `campus_tip_suggestions` | 캠퍼스 꿀팁 제보 |
| `site_inquiries` | 사이트 문의 |
| `user_devices` | FCM 구독 토큰 |
| `notifications_sent` | 발송된 푸시 알림 기록 |
| `timetable_shares` | 공유 시간표 정보 |
| `api_rate_limits` | 서버리스 인스턴스 간 공용 요청 제한 카운터 |

## 운영 원칙

- 클라이언트 SDK에서 Firestore read/write를 추가하지 않습니다.
- 새 컬렉션을 추가할 때도 기본값은 `allow read, write: if false`입니다.
- 접근이 필요한 경우 API Route에서 인증/검증 후 Firebase Admin SDK로 처리합니다.
- 보안 규칙 변경 후 Firebase Emulator 또는 콘솔 Rules Playground로 확인합니다.
- 결제가 활성화된 환경에서는 Firestore TTL 정책을 사용하고, 무료 요금제에서는 예약 정리 워크플로를 사용합니다.

## TTL 설정값

Firestore 관리형 TTL 삭제는 무료 사용량에 포함되지 않으므로 Google Cloud 프로젝트에 결제가 활성화되어 있어야 합니다.

Firestore TTL은 보존 기간을 정책에 입력하는 방식이 아닙니다. 각 문서의 `expires_at` 필드에 저장된 **절대 만료 시각**을 기준으로 삭제합니다.

| 컬렉션 그룹 | TTL 필드 | 코드가 저장하는 만료 시각 |
| --- | --- | --- |
| `meet_rooms` | `expires_at` | 방 생성 시점부터 90일 후 |
| `participants` | `expires_at` | 부모 `meet_rooms` 문서와 같은 만료 시각 |
| `timetable_shares` | `expires_at` | 공유 링크 생성 시점부터 90일 후 |
| `api_rate_limits` | `expires_at` | 해당 요청 제한 구간이 끝나는 시각. 현재 API는 1시간 구간을 사용 |

Google Cloud Console의 Firestore **Time-to-live > Create Policy** 화면에서는 컬렉션 그룹 이름과 timestamp 필드 이름만 입력합니다. 표준 Firestore TTL 정책에는 만료 오프셋이나 단위를 별도로 설정하지 않습니다.

- 만료 오프셋 입력란이 없는 경우: 아무 값도 추가하지 않습니다.
- 다른 관리 화면에서 오프셋과 단위를 반드시 요구하는 경우: `0 seconds`를 선택합니다.
- `90 days`를 입력하지 않습니다. 코드가 이미 `expires_at`을 90일 후의 절대 시각으로 저장하므로, 정책에 90일을 추가하면 총 180일 가까이 보존될 수 있습니다.

TTL 삭제는 만료 시각 즉시 실행되지 않으며 일반적으로 만료 후 24시간 안에 처리됩니다. API는 TTL 삭제 전에도 만료된 방과 공유 링크를 반환하지 않습니다.

TTL로 부모 `meet_rooms` 문서를 삭제해도 Firestore는 `participants` 하위 컬렉션을 자동으로 삭제하지 않습니다. 따라서 `participants` 컬렉션 그룹에도 `expires_at` TTL 정책이 반드시 필요합니다.

### TTL 최초 활성화 순서

기존 참여자 문서에는 `expires_at` 필드가 없을 수 있으므로 아래 순서를 지킵니다.

1. 참여자 저장 시 `expires_at`을 기록하는 현재 코드를 먼저 운영 배포합니다.
2. `FIREBASE_SERVICE_ACCOUNT`를 설정한 로컬 환경에서 아래 일회성 보정 명령을 실행합니다.
   ```powershell
   npm run backfill-meet-participant-expiry
   ```
3. Firestore에서 `participants` 컬렉션 그룹의 `expires_at` TTL을 먼저 활성화합니다.
4. 보정 결과를 확인한 뒤 `meet_rooms` 컬렉션 그룹의 `expires_at` TTL을 활성화합니다.
5. `timetable_shares`, `api_rate_limits`의 `expires_at` TTL을 활성화합니다.

`meet_rooms` TTL을 먼저 활성화하면 부모 방 문서가 삭제된 뒤 기존 하위 참여자 문서를 보정하기 어려워집니다.

### 무료 요금제 대체 방식

결제를 활성화하지 않아 TTL 정책을 만들 수 없는 환경에서는 `.github/workflows/cleanup-expired-firestore.yml`이 매일 만료 문서를 정리합니다.

- GitHub Actions 저장소 비밀값에 `FIREBASE_SERVICE_ACCOUNT`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`를 등록합니다.
- 워크플로는 `npm run cleanup-expired-firestore`를 실행합니다.
- 정리 대상은 만료된 `meet_rooms`와 하위 `participants`, `timetable_shares`, `api_rate_limits`입니다.
- 일반 Firestore 읽기·삭제 작업으로 처리되므로 무료 일일 할당량을 사용합니다.
- 관리형 TTL을 나중에 활성화해도 `expires_at` 필드와 호환됩니다. 중복 정리가 필요 없다면 예약 워크플로를 비활성화합니다.

로컬에서 직접 정리하려면 `FIREBASE_SERVICE_ACCOUNT`가 설정된 상태에서 아래 명령을 실행합니다.

```powershell
npm run cleanup-expired-firestore
```

## 최종 업데이트

2026-06-13
