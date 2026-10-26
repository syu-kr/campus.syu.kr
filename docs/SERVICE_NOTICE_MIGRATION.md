# 서비스 공지 Firebase 이전

기존 서비스 공지 19개와 검수 영문 18개를 `site_managed_content`로 옮기는 절차다. 코드와 i18n 사전·운영 문서는 이전 대상이 아니다. 원본 Markdown은 DB 단독 검증과 복구 확인 전까지 보존한다.

## 저장과 표시 계약

공지 원본의 표시 번호·날짜·작성자·원문 언어·전체 원문 SHA256은 레코드의 `noticeMetadata`에 보존한다. 관리자 편집 API로 이 메타데이터를 변경할 수 없으며 초안 저장·게시·보관에서도 유지한다. 영어 원문인 012는 `lang=en`을 유지한다. 검수 영문의 원문 해시와 CMS의 영문 검수 해시는 다른 계약으로 보존한다.

원문의 표시용 요약은 최대 300자 뒤에 `...`가 붙어 303자일 수 있다. CMS 입력의 기존 300자 제한을 늘리지 않고 원래 excerpt·description을 메타데이터에 보존한다. 요약이 그대로인 게시본은 이 값을 사용하며, 수정한 요약은 현재 편집 내용을 표시한다. Markdown 본문의 선행·마지막 줄바꿈도 보존한다.

기존 DB 레코드가 있으면 초안·게시본·revision·보관·중단 상태를 변경하지 않고 메타데이터만 보충한다. 기존 메타데이터가 다르거나 문서 식별자가 맞지 않으면 충돌로 중단한다. 게시 중단한 원본을 Markdown fallback으로 다시 노출하지 않는다.

## 조회 모드

| `SERVICE_NOTICES_SOURCE` | 동작 |
| --- | --- |
| 미설정 또는 `hybrid` | 기존 Markdown 기본본과 DB 저장본 병합. Firebase 인증 없는 CI도 기존 원본을 사용 |
| `database` | 공개 목록·상세와 관리자 seed가 Markdown을 읽지 않음. 인증 설정 누락은 오류로 닫힘 |

유효하지 않은 모드도 오류로 닫힌다. `database` 모드의 DB 누락 항목은 원문으로 복구하지 않는다. 실제 앱의 원본 전환은 importer 성공만으로 수행하지 않고 공개 목록·상세·SEO 동등성을 확인한 뒤 모드를 적용한다.

## 실행 명령

아래 명령은 절차이며 실제 DB 변경 완료 기록이 아니다. 저장소 지정 Node/npm을 사용하고, 기존 승인된 서버 인증을 프로세스 환경으로 제공한다. 인증 값은 명령·문서·출력에 넣지 않는다. 스크립트는 기존 `scripts/firebase-admin.ts`의 환경 로더를 사용한다.

```text
# 로컬 원문만 검사. 환경 파일·Firebase 접근 없음
npx ts-node --files --project tsconfig.json scripts/migrate-service-notices.ts --repository-only

# 실제 DB를 읽어 계획만 확인. 기본 동작도 dry-run
npx ts-node --files --project tsconfig.json scripts/migrate-service-notices.ts --dry-run

# 새 백업 파일을 먼저 만든 뒤 조건부 쓰기
npx ts-node --files --project tsconfig.json scripts/migrate-service-notices.ts --apply --backup output/service-notice-backup.json

# 모든 원본 메타데이터가 준비됐는지 확인
npx ts-node --files --project tsconfig.json scripts/migrate-service-notices.ts --verify

# 되돌릴 대상 확인, 이후 명시적 실행
npx ts-node --files --project tsconfig.json scripts/migrate-service-notices.ts --rollback output/service-notice-backup.json
npx ts-node --files --project tsconfig.json scripts/migrate-service-notices.ts --rollback output/service-notice-backup.json --apply
```

백업은 Git에서 제외되는 `output/` 또는 `.cache/` 아래의 새 파일만 허용한다. 기존 파일을 덮어쓰지 않으며 부모 폴더는 미리 준비한다. 백업에는 기존 비공개 초안이 들어갈 수 있으므로 공개하거나 커밋하지 않는다. 파일 생성 모드는 제한적으로 지정하지만 Windows ACL까지 보장하는 수단은 아니다.

실행 계획에는 `create/enrich/unchanged/conflicts` 건수와 원문 manifest hash만 출력한다. `--verify`는 원본 게시본과 같은 항목 수 및 기존 편집/노출 중단 항목 수도 구분한다. 기존 편집을 원문으로 되돌리면서 동등성을 맞추지 않는다. 백업은 문서 JSON 값과 hash를 검증하며 JSON으로 손실 없이 표현할 수 없는 값이 있으면 쓰기 전에 실패한다.

## 재실행과 복구

각 쓰기는 트랜잭션에서 현재 문서 hash를 다시 대조한다. 동일 문서면 건너뛰고, 다른 편집이 있으면 충돌로 중단한다. 부분 실패 후 새 백업 경로로 다시 계획·실행할 수 있으며 이미 완료된 문서는 추가 쓰기하지 않는다. 최초 백업도 복구용으로 보존한다.

롤백은 이 계획이 생성/보충한 내용이 현재 문서와 정확히 같을 때만 수행한다. 생성 문서는 삭제하고 보충 문서는 이전 내용으로 되돌린다. 이후 관리자가 수정한 문서는 덮어쓰지 않는다. 일부 복구 후 재실행하면 이미 복구한 문서를 건너뛴다. 앱 롤백이 DB 롤백을 대신하지 않는다.

실제 전환 전에는 19개 공지의 KO/EN 목록 순서·번호·작성자·날짜·제목·요약·본문·링크·원문 언어를 DB 단독 모드에서 비교한다. 홈·사이트맵·OG·404·페이지 복귀·기존 중단 항목도 확인한다. 이 절차가 통과한 뒤 원본 파일 제거를 별도 정리 작업으로 검토한다.
