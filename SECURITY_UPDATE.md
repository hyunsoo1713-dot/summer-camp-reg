# 보안 개선 안내 (2026-09)

## 무엇이 바뀌었나요? (쉬운 설명)

예전 앱은 **열쇠 없는 창고**와 같았습니다. 누구나 창고(데이터베이스)에 직접 들어가 명단을 보고, 고치고, 지울 수 있었습니다.

이제는 창고 문을 **완전히 잠그고**, 앱 서버 안에 **문지기**를 세웠습니다.

- 모든 요청은 문지기(`src/server/*`, `src/app/api/*`)를 거칩니다.
- 문지기는 "이 사람이 누구인지(로그인)"와 "이 일을 해도 되는지(권한)"를 확인한 뒤에만 데이터를 꺼내 주거나 저장합니다.
- 브라우저는 더 이상 데이터베이스에 직접 접근하지 못합니다(`firestore.rules`, `storage.rules`에서 모두 차단).

| 문제 | 해결 |
|---|---|
| 누구나 DB 전체 읽기·쓰기·삭제 가능 | Firestore/Storage 직접 접근 전면 차단, 서버만 접근 |
| 로그인이 localStorage 값뿐(위조 가능) | 서버가 서명한 로그인 쿠키(httpOnly) 사용. 위조하면 방문자로 취급 |
| 전체 데이터를 모든 사용자에게 내려줌 | 역할별로 필요한 것만: 방문자=공개 정보, 담당자=자기 교회, 관리자=자기 지방회 |
| 비밀번호 평문/복원 가능한 방식 저장 | scrypt 해시로 저장. 예전 비밀번호는 다음 로그인 때 자동으로 해시로 바뀜 |
| 최고관리자 기본 비번(admin123/super123)이 코드와 GitHub에 노출 | 기본값 제거. 서버 비밀값(Secret Manager)으로만 설정 |
| 동시 사용 시 참가비 합계가 꼬임 | 서버가 저장할 때마다 DB 최신값으로 다시 계산 |
| 예측 가능한 ID(Math.random 9자리) | 암호학적 난수 ID |
| 비밀번호 무한 시도 가능 | 15분에 10회 실패하면 잠금 |
| 옛날 주소(/admin, /manager 등) | 첫 화면으로 이동 |

화면 모양과 사용 방법은 그대로입니다.

---

## 배포 전에 꼭 해야 할 일 (한 번만)

아래 명령은 **Google Cloud Shell**(console.cloud.google.com 오른쪽 위 `>_` 버튼)에서 실행하면 가장 쉽습니다.

### 1) 비밀값 2개 만들기 (Secret Manager)

```bash
gcloud config set project summer-event-reg
gcloud services enable secretmanager.googleapis.com

# (1) 로그인 쿠키 서명용 비밀키 — 자동으로 긴 무작위 문자열 생성
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create evt-session-secret --data-file=-

# (2) 최고 관리자 첫 비밀번호 — '여기에_새_비밀번호' 부분을 바꿔서 실행 (12자 이상 권장)
printf '%s' '여기에_새_비밀번호' | gcloud secrets create evt-super-admin-password --data-file=-
```

### 2) Cloud Run이 비밀값을 읽을 수 있게 허용

```bash
PROJECT_NUMBER=$(gcloud projects describe summer-event-reg --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for S in evt-session-secret evt-super-admin-password; do
  gcloud secrets add-iam-policy-binding $S --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"
done
```

> Cloud Run 서비스가 기본 서비스 계정이 아닌 다른 계정을 쓰고 있다면, 그 계정에 권한을 주어야 합니다.
> 그 계정에는 Firestore와 Storage 권한(예: `Cloud Datastore User`, `Storage Object Admin`)도 있어야 합니다.

### 3) 데이터베이스 잠금 규칙 배포

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage --project summer-event-reg
```

### 4) 앱 배포 (예전과 같음)

```bash
gcloud builds submit --config cloudbuild.yaml
```

`cloudbuild.yaml`이 1)에서 만든 비밀값을 자동으로 연결합니다. Node.js 버전은 22로 올렸습니다(Dockerfile).

### 5) 배포 후 확인

1. `https://(앱주소)/super-admin`에서 1)에서 정한 비밀번호로 로그인합니다.
2. 곧바로 화면의 **비밀번호 변경**에서 새 비밀번호로 바꿉니다. 바꾼 비밀번호는 DB에 해시로 저장되고, 이후에는 그 비밀번호가 우선합니다.
3. 예전 행사 참가자 데이터가 DB에 남아 있다면, 필요 없는 지방회는 최고 관리자 화면에서 **데이터 정리/삭제**해 주세요. (어린이 개인정보)

---

## 로컬에서 개발할 때 (`npm run dev`)

1. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**으로 JSON 파일을 받습니다. 이 파일은 **절대 GitHub에 올리지 마세요.**
2. 프로젝트 폴더에 `.env.local` 파일을 만듭니다(자동으로 git에서 제외됨).

```
SESSION_SECRET=아무_긴_문자열_32자_이상_아무_긴_문자열_32자_이상
SUPER_ADMIN_PASSWORD=개발용_비밀번호
GOOGLE_APPLICATION_CREDENTIALS=C:\경로\서비스계정키.json
```

---

## 지워도 되는 파일

아래 파일은 더 이상 쓰지 않도록 내용을 비워 두었습니다. 탐색기에서 삭제해도 됩니다.

- `src/services/firebaseDb.ts`, `src/services/mockDb.ts`, `src/utils/firebaseClient.ts`
- `_recalculate.js`, `_check_all_data.js`, `_test_reset.js`, `_test_check.js`
- `src/app/admin`, `src/app/manager`, `src/app/register`, `src/app/edit`, `src/app/login`, `src/app/signup-request` 폴더 (옛날 주소, 지금은 첫 화면으로 보냄)

## 참고: 예전 비밀번호 관련

- `db_config.env`에 있던 `admin123`, `super123` 등은 GitHub 기록에 남아 있습니다. 새 코드는 이 값을 전혀 쓰지 않지만, **같은 비밀번호를 다른 곳에서 쓰고 있다면 바꾸세요.**
- 교회 담당자가 직접 추가한 참가자는 예전과 마찬가지로 학부모용 수정 비밀번호가 없습니다(담당자/관리자가 수정).

---

## 2차 보안 점검 (2026-10-07)

| 문제 | 해결 |
|---|---|
| Next.js 16.2.9에 알려진 심각한 취약점 다수 (원격 코드 실행 등) | 16.4.0으로 업데이트, 그 밖의 라이브러리 취약점도 업데이트 |
| 비밀번호 틀린 횟수 제한을 IP 위조로 피할 수 있었음 (서버 메모리 기준이라 서버가 늘면 무력) | 계정별 + IP별로 DB에 기록, 비밀번호 확인 **전에** 먼저 셈(동시 공격 차단). 계정 하나당 15분 10번·하루 30번 |
| 직원 비밀번호 4자 | 새로 정하는 관리자·담당자·최고 관리자 비밀번호는 8자 이상 |
| 비밀번호를 바꿔도 예전 로그인(다른 기기)이 12시간 유지 | 비밀번호를 바꾸면 다른 기기 로그인은 즉시 끊김 |
| 「참가자 사진 찾기」(얼굴 인식)로 모르는 사람이 남의 아이 사진을 받아 갈 위험을 완전히 막을 수 없음 | **기능 전체 삭제** (얼굴 정보를 아예 다루지 않음, 아마존 연결 부품도 제거) |
| 관리자·담당자가 다른 지방회 행사에 참가자를 끼워 넣을 수 있음 | 행사·교회가 같은 지방회 것인지 확인 |
| 아주 큰 파일로 서버 메모리를 채울 수 있음 | 정해진 크기까지만 읽음 |
| 응답 속도로 "이 아이디/이 아이가 있다"를 알아낼 수 있음 | 없을 때도 같은 시간이 걸리게 함 |
| 방문자에게 교회·입금 설정의 내부 메모가 보임 | 그 지방회 관리자에게만 |
| 보안 헤더 부족 | CSP(다른 사이트 스크립트 차단), HSTS(https 강제), Permissions-Policy 등 추가 |
| `.gcloudignore`가 `.env`를 업로드하도록 되어 있었음 | `.env`는 올리지 않음 (`db_config.env`만 사용) |

### 남은 위험 (알고 있는 것)
- `xlsx` 라이브러리 경고: 엑셀 **읽기** 기능의 취약점이며, 이 앱은 브라우저에서 엑셀 **만들기**만 하므로 해당 없음.
- `uuid` 경고: 문제 되는 사용 방식(v3/v5/v6 + buf)을 쓰지 않음.
- 누군가 일부러 틀린 비밀번호를 계속 넣으면 그 계정이 15분~하루 잠길 수 있음 (비밀번호를 지키기 위한 대가).

### 운영자가 직접 해야 할 일
1. Google 계정·GitHub 계정에 **2단계 인증(패스키 권장)** 켜기
2. GitHub 저장소가 **비공개(Private)** 인지 확인
3. 최고 관리자 비밀번호를 **12자 이상**의 새 비밀번호로 변경
4. Google Cloud **예산 알림** 설정
