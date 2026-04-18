# 다중 선택 + 사유 설문 웹앱 (A-or-B-game)

참여자는 **2~5개의 선택지 중 1개를 선택**하고, **선택 이유(텍스트)를 필수 입력**합니다.  
HOST는 세션을 종료한 뒤 선택지별 집계 결과와 사유 목록을 확인할 수 있습니다.

> 이 저장소는 프런트엔드(`public/*`) + Google Apps Script 백엔드(`apps-script/Code.gs`) 조합을 기준으로 동작합니다.

---

## 1) 현재 구성 (2026-04 기준)

### 프런트엔드 페이지
- `public/index.html`: 시작 허브 페이지
- `public/client.html`: 설문 생성/세션 관리
- `public/host.html`: 진행 상태 확인/세션 종료/결과 확인
- `public/participant.html`: 참여자 응답 제출
- `public/test.html`: 빠른 수동 점검용

### 백엔드
- **권장 백엔드:** Google Apps Script Web App (`apps-script/Code.gs`)
- **대안(로컬 실험용):** Node 서버 (`server.js`, A/B 형태의 별도 로직)

> 참고: 현재 `public/api.js`는 Google Apps Script 엔드포인트로 `action` 기반 POST 요청을 보내도록 구현되어 있습니다.

---

## 2) 빠른 시작 링크 (GitHub Pages)

- 홈: https://ethicsjayden31.github.io/A-or-B-game/
- CLIENT: https://ethicsjayden31.github.io/A-or-B-game/public/client.html
- HOST: https://ethicsjayden31.github.io/A-or-B-game/public/host.html
- PARTICIPANT: https://ethicsjayden31.github.io/A-or-B-game/public/participant.html
- TEST: https://ethicsjayden31.github.io/A-or-B-game/public/test.html

---

## 3) 첫 설정: Google Sheets + Apps Script

1. Google 스프레드시트를 새로 생성합니다.
2. **확장 프로그램 → Apps Script**를 엽니다.
3. `apps-script/Code.gs` 내용을 붙여넣고 저장합니다.
4. **배포 → 새 배포 → 웹 앱**으로 배포합니다.
   - 실행 사용자: 본인
   - 액세스: 링크가 있는 사용자(조직 정책에 맞게 조정)
5. 배포 완료 후 생성된 `.../exec` URL을 복사합니다.

### CLIENT 페이지에 연결
1. `client.html` 접속
2. Google Apps Script URL 입력
3. **URL 저장** 클릭

저장한 URL은 브라우저 `localStorage`에 저장되며, HOST/PARTICIPANT 링크에도 `?api=` 파라미터로 전달할 수 있습니다.

---

## 4) 운영 플로우 (권장)

1. CLIENT에서 설문 제목 + 선택지(2~5개) 생성
2. CLIENT에서 세션 시작
3. PARTICIPANT 링크를 공유해 응답 수집
4. HOST에서 참여자 수/진행 상태 확인
5. HOST에서 세션 종료 후 결과 공개

---

## 5) 기능 요약

### CLIENT
- 설문 생성 (선택지 2~5개)
- 세션 시작
- 세션 삭제 / 설문 전체 삭제
- API URL 저장 + HOST/PARTICIPANT 진입 링크 제공

### HOST
- 현재 활성 세션 자동 탐색
- 진행 중엔 총 참여자 수만 표시 (결과 비공개)
- 세션 종료 시 선택지별 득표수/비율 표시
- 선택지별 사유 텍스트 목록 표시

### PARTICIPANT
- 활성 세션 자동 탐색
- 선택지 1개 선택 + 사유 필수 입력
- 임시작성(draft) 자동 저장/복원
- 제출 완료 후 대기 상태

---

## 6) Apps Script 데이터 구조

### 시트
- `games`: `id`, `title`, `optionsJson`, `createdAt`
- `sessions`: `id`, `gameId`, `status`, `createdAt`, `closedAt`
- `votes`: `sessionId`, `participantToken`, `optionId`, `reason`, `createdAt`

### 호환성
- 기존 A/B 컬럼(`optionA`, `optionB`, `choice`)이 있어도 `ensureHeaders_`/`migrateCell_` 로직으로 새 구조에 맞춰 마이그레이션됩니다.

---

## 7) 로컬 실행 방법

### A. 정적 파일만 빠르게 확인
```bash
python -m http.server 8080
```
접속: `http://localhost:8080/public/`

### B. Node 서버 실행 (로컬 API 실험)
```bash
npm install
npm start
```
기본 포트: `3000`

> 주의: Node 서버(`server.js`)는 현재 Google Apps Script 기반과 데이터 모델이 다릅니다. 실제 운영 기준 문서는 Apps Script 흐름을 우선으로 합니다.

---

## 8) 트러블슈팅

### `Failed to fetch`
- 저장한 URL이 `.../exec`인지 확인
- Apps Script 웹 앱 배포 권한 확인
- URL 저장 후 새로고침

### 세션이 보이지 않음
- CLIENT에서 세션 시작 여부 확인
- HOST/PARTICIPANT가 동일한 API URL을 사용 중인지 확인

### 응답 제출은 됐는데 HOST에 의견이 안 보임
- 세션 종료 전에는 결과를 숨기는 것이 정상입니다.
- 종료 후에도 비어 있다면 해당 응답에 `reason` 텍스트가 없는지 확인하세요.

---

## 9) 저장소 주요 파일

- `apps-script/Code.gs`: Google Apps Script API 본체
- `public/api.js`: 프런트 API 호출 래퍼
- `public/config.js`: API URL 저장/조회 유틸
- `public/client.js`: 설문/세션 관리 UI 로직
- `public/host.js`: 진행/종료/결과 UI 로직
- `public/participant.js`: 참여자 제출 UI 로직
- `public/styles.css`: 공통 스타일
- `server.js`: Node 기반 대체 서버(실험용)
