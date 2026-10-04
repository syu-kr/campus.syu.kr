# Firestore 보안 규칙

SYU CAMPUS는 클라이언트에서 Firestore를 직접 읽거나 쓰지 않습니다. Firestore 접근은 Next.js API Route와 Firebase Admin SDK를 통해 처리합니다.

Firestore Rules의 소스 오브 트루스는 저장소 루트의 `firestore.rules`입니다. 복합 인덱스의 소스 오브 트루스는 `firestore.indexes.json`입니다. Firebase CLI 배포를 권장하지만, 운영자가 Firebase 콘솔에서 직접 반영해도 됩니다. 단, 콘솔 설정은 반드시 repo 파일과 같은 상태로 유지해야 합니다.

Firebase CLI를 쓰는 경우 rules와 indexes를 함께 배포합니다.

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

현재 rules 파일은 아래와 같이 모든 클라이언트 접근을 차단합니다. Firebase 콘솔에서 직접 반영할 때는 아래 내용 전체를 Rules 편집기에 붙여넣고 publish합니다.

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

    match /notifications_scheduled/{notificationId} {
      allow read, write: if false;
    }

    match /notification_send_locks/{lockId} {
      allow read, write: if false;
    }

    match /timetable_shares/{shareId} {
      allow read, write: if false;
    }

    match /api_rate_limits/{rateLimitId} {
      allow read, write: if false;
    }

    match /admin_audit_logs/{auditLogId} {
      allow read, write: if false;
    }

    match /roommate_sessions/{sessionId} {
      allow read, write: if false;
    }

    match /roommate_posts/{postId} {
      allow read, write: if false;
    }

    match /roommate_owner_state/{ownerKey} {
      allow read, write: if false;
    }

    match /roommate_reports/{reportId} {
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
| `notifications_scheduled` | 예약 알림 실행 기록 |
| `notification_send_locks` | 알림 중복 발송 방지 잠금 |
| `timetable_shares` | 공유 시간표 정보 |
| `api_rate_limits` | 서버리스 인스턴스 간 공용 요청 제한 카운터 |
| `admin_audit_logs` | 관리자 상태 변경·AI 분류 작업 감사 기록 |
| `roommate_sessions` | 학교 이메일 링크 인증 후 고정 만료하는 게시판 세션. 토큰 해시만 저장 |
| `roommate_posts` | 인증 전용 기숙사 모집글과 연락 링크 |
| `roommate_owner_state` | 이메일 HMAC 작성자 키별 활성 글 포인터와 기한 있는 작성 보류 |
| `roommate_reports` | 관리자 전용 신고와 당시 최소 근거. 접수 후 30일 정리 |

## 운영 원칙

- 클라이언트 SDK에서 Firestore read/write를 추가하지 않습니다.
- 새 컬렉션을 추가할 때도 기본값은 `allow read, write: if false`입니다.
- 접근이 필요한 경우 API Route에서 인증/검증 후 Firebase Admin SDK로 처리합니다.
- 보안 규칙 변경 후 Firebase Emulator 또는 콘솔 Rules Playground로 확인합니다.
- 쿼리에 `where`와 `orderBy`를 함께 추가하면 `firestore.indexes.json`에 필요한 복합 인덱스를 함께 등록합니다.
- 결제가 활성화된 환경에서는 Firestore TTL 정책을 사용하고, 무료 요금제에서는 예약 정리 워크플로를 사용합니다.

## 복합 인덱스

`firestore.indexes.json`은 관리자 제출 목록과 룸메이트 조회의 복합 인덱스를 관리합니다. 문서 ID 정렬은 마지막 정렬 필드의 방향을 따릅니다.

| 컬렉션 그룹 | 필드 |
| --- | --- |
| `site_inquiries` | `status` ASC, `created_at` DESC |
| `campus_tip_suggestions` | `status` ASC, `created_at` DESC |
| `roommate_posts` | `status` ASC, `created_at` DESC (학생 목록과 admin 상태 필터) |
| `roommate_posts` | `status` ASC, `recruit_until` ASC (현재 모집 수) |
| `roommate_reports` | `status` ASC, `expires_at` ASC (미처리 신고와 근거 정리 예정 순서) |
| `api_rate_limits` | `metric` ASC, `window_start` ASC (사이트 인증 메일 요청 수) |

## TTL 설정값

Firestore 관리형 TTL 삭제는 무료 사용량에 포함되지 않으므로 Google Cloud 프로젝트에 결제가 활성화되어 있어야 합니다.

Firestore TTL은 보존 기간을 정책에 입력하는 방식이 아닙니다. 각 문서의 `expires_at` 필드에 저장된 **절대 만료 시각**을 기준으로 삭제합니다.

| 컬렉션 그룹 | TTL 필드 | 코드가 저장하는 만료 시각 |
| --- | --- | --- |
| `meet_rooms` | `expires_at` | 방 생성 시점부터 90일 후 |
| `participants` | `expires_at` | 부모 `meet_rooms` 문서와 같은 만료 시각 |
| `timetable_shares` | `expires_at` | 공유 링크 생성 시점부터 90일 후 |
| `api_rate_limits` | `expires_at` | 해당 요청 제한 구간이 끝나는 시각. 현재 API는 1시간 구간을 사용 |
| `notification_send_locks` | `expires_at` | 알림 발송 중복 방지 키 생성 시점부터 14일 후 |
| `notifications_sent` | `expires_at` | 발송 시점부터 90일 후 |
| `notifications_scheduled` | `expires_at` | 실행 시점부터 90일 후 |
| `admin_audit_logs` | `expires_at` | 관리자 작업 시점부터 365일 후 |
| `roommate_sessions` | `expires_at` | 검증된 인증 시각부터 고정 30일 또는 12시간 |
| `roommate_posts` | `expires_at` | 최초 완료·삭제와 원래 모집 마감 중 이른 시각부터 30일 후 |

`roommate_reports`와 `roommate_owner_state`에는 관리형 TTL을 설정하지 않습니다. 신고는 만료 직전 미처리 보존 종료의 최소 감사 기록을 같은 트랜잭션에 남겨야 하고, 작성자 상태는 유효한 보류와 활성 글을 다시 확인해야 하기 때문입니다. 일일 정리 스크립트가 신고 접수 후 30일, 비활성 작성자 최종 활동 후 90일 기준으로 처리합니다. 유효한 보류 중에는 과거 `expires_at`만으로 작성자 상태를 삭제하지 않습니다.

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
5. `timetable_shares`, `api_rate_limits`, `notification_send_locks`, `notifications_sent`, `notifications_scheduled`, `admin_audit_logs`의 `expires_at` TTL을 활성화합니다.

`meet_rooms` TTL을 먼저 활성화하면 부모 방 문서가 삭제된 뒤 기존 하위 참여자 문서를 보정하기 어려워집니다.

### 무료 요금제 대체 방식

결제를 활성화하지 않아 TTL 정책을 만들 수 없는 환경에서는 `.github/workflows/cleanup-expired-firestore.yml`이 매일 만료 문서를 정리합니다.

- GitHub Actions 저장소 비밀값에 `FIREBASE_SERVICE_ACCOUNT`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`를 등록합니다.
- 워크플로는 `npm run cleanup-expired-firestore`를 실행합니다.
- 정리 대상은 만료된 `meet_rooms`와 하위 `participants`, `timetable_shares`, `api_rate_limits`, `notification_send_locks`, `notifications_sent`, `notifications_scheduled`, `admin_audit_logs`, `roommate_sessions`, `roommate_posts`, `roommate_reports`, `roommate_owner_state`입니다.
- 일반 Firestore 읽기·삭제 작업으로 처리되므로 무료 일일 할당량을 사용합니다.
- 관리형 TTL을 나중에 활성화해도 일반 문서의 `expires_at` 필드와 호환됩니다. 룸메이트 신고의 보존 종료 감사 기록과 작성자 상태의 재검사를 위해 예약 워크플로는 유지합니다.

로컬에서 직접 정리하려면 `FIREBASE_SERVICE_ACCOUNT`가 설정된 상태에서 아래 명령을 실행합니다.

```powershell
npm run cleanup-expired-firestore
```

### 알림 dedupe lock 복구

일일 알림 발송 API는 `notification_send_locks`로 같은 dedupe key의 중복 발송을 막습니다. 실패한 발송은 `failed` 상태로 남아 같은 key 재시도를 차단합니다.

먼저 lock 상태를 조회합니다.

```powershell
npm run notification-lock -- daily-summary:YYYY-MM-DD
```

발송이 실패했고 실제 푸시가 나가지 않았음을 확인한 뒤 실패 lock만 삭제합니다.

```powershell
npm run notification-lock -- daily-summary:YYYY-MM-DD --delete-failed
```

`sending` 상태 lock은 아직 작업 중일 수 있으므로 기본적으로 삭제하지 않습니다. GitHub Actions가 종료됐고 30분 이상 지난 stale lock만 아래 명령으로 삭제합니다.

```powershell
npm run notification-lock -- daily-summary:YYYY-MM-DD --delete-stale-sending
```

## 최종 업데이트

2026-10-04
