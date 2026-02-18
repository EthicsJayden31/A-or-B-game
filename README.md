# A-or-B Game (서버 없이 운영: Google Sheets + Apps Script)

이 프로젝트는 **수업 시간에 학생들이 실시간으로 A/B 중 하나를 고르는 게임**을 운영하기 위한 도구입니다.

핵심은 다음 2가지입니다.

1. **게임 화면(웹페이지)**는 정적으로 배포합니다. (서버 개발/운영 불필요)
2. **데이터 저장/조회**는 Google Sheets + Google Apps Script가 담당합니다.

즉, 코드를 잘 몰라도 설정만 따라 하면 운영할 수 있습니다.

---

## 1) 이 프로젝트로 할 수 있는 것

- HOST가 게임(제목, 선택지 A/B)을 생성
- 같은 게임에서 여러 세션(회차) 독립 운영
- 참여 링크(QR)로 학생들이 접속해 A/B 중 하나 선택
- HOST가 세션 종료 시 전체 결과 공개
- 테스트 페이지에서 실제 운영 전 리허설 가능

---

## 2) 준비물 (처음 1회)

아래 계정/도구만 있으면 됩니다.

- Google 계정 (Sheets, Apps Script 사용)
- GitHub 계정 (GitHub Pages로 배포할 경우)
- 또는 Netlify/Vercel 계정 (원클릭 배포를 원할 경우)

---

## 3) 아주 쉬운 전체 흐름 요약

1. Google Spreadsheet 1개 생성
2. Apps Script에 `apps-script/Code.gs` 코드 붙여넣고 Web App으로 배포
3. 배포된 Web App URL(`.../exec`) 복사
4. 이 프로젝트의 `public` 폴더를 정적 호스팅에 배포
5. `host.html` 접속 → Web App URL 입력/저장
6. 게임 만들고 세션 시작 → 학생에게 링크/QR 공유

---

## 4) Google Sheets + Apps Script 연동 (상세)

> 아래 단계는 **코딩을 거의 몰라도** 따라할 수 있게 최대한 자세히 썼습니다.

### 4-1. Google Spreadsheet 만들기

1. [Google Sheets](https://sheets.google.com) 접속
2. `빈 스프레드시트` 클릭
3. 파일 이름을 예: `A-or-B Game Data` 로 변경

### 4-2. Apps Script 열기

1. 상단 메뉴에서 `확장 프로그램` 클릭
2. `Apps Script` 클릭
3. 새 탭이 열리면 기본 코드(예: `function myFunction(){}`)를 전부 지움

### 4-3. Code.gs 붙여넣기

1. 이 저장소의 `apps-script/Code.gs` 파일 전체 내용을 복사
2. Apps Script 편집창에 붙여넣기
3. 저장 아이콘 클릭 (또는 `Ctrl+S`)

### 4-4. 웹 앱(Web App)으로 배포

1. 우측 상단 `배포` 클릭
2. `새 배포` 클릭
3. 톱니 또는 유형 선택에서 `웹 앱` 선택
4. 항목을 아래처럼 설정
   - **실행 사용자**: 나(본인)
   - **액세스 권한**: 링크가 있는 모든 사용자
5. `배포` 클릭
6. 권한 요청이 나오면 Google 권한 승인
7. 완료되면 `웹 앱 URL`이 보입니다. (예: `https://script.google.com/macros/s/....../exec`)
8. 이 URL을 복사해 안전한 곳에 보관

### 4-5. 시트 탭은 자동 생성됨

처음 API를 호출하면 아래 탭이 자동 생성됩니다.

- `games`
- `sessions`
- `votes`

직접 탭을 만들 필요 없습니다.

---

## 5) 게임 페이지 배포 방법 (정적 배포)

아래 중 편한 방법 하나를 선택하세요.

## 방법 A) GitHub Pages (무료, 가장 보편적)

1. GitHub에 새 저장소 생성
2. 이 프로젝트 파일 업로드
3. 저장소 설정(`Settings`) → `Pages`
4. Source를 `Deploy from a branch` 선택
5. Branch를 `main` / 폴더를 `/ (root)` 또는 프로젝트 구조에 맞게 선택
6. 저장 후 1~3분 기다리면 사이트 URL 생성

예) `https://yourname.github.io/a-or-b-game/public/host.html`

> 이 프로젝트는 상대경로(`./`)를 사용하므로 GitHub Pages 하위 경로에서도 잘 동작하도록 구성되어 있습니다.

## 방법 B) Netlify Drop (초간단)

1. [Netlify Drop](https://app.netlify.com/drop) 접속
2. 프로젝트 폴더를 통째로 드래그 앤 드롭
3. 바로 임시 URL 생성
4. URL 뒤에 `/public/host.html` 접속

## 방법 C) Vercel

1. Vercel에 GitHub 저장소 연결
2. Framework preset 없이 정적 사이트로 배포
3. 배포 URL + `/public/host.html`로 접속

---

## 6) 실제 운영 방법 (HOST 기준)

### 6-1. HOST 페이지 접속

- 배포 주소 + `/public/host.html`

예)
- `https://your-site.com/public/host.html`

### 6-2. Apps Script URL 등록 (처음 1회)

1. `Google Apps Script 연결` 섹션의 입력칸에 `.../exec` URL 붙여넣기
2. `URL 저장` 클릭
3. 저장되면 같은 브라우저에서는 다시 입력할 필요가 거의 없음(localStorage 저장)

### 6-3. 게임 생성

1. 제목 입력
2. 선택지 A / 선택지 B 입력
3. `게임 저장`

### 6-4. 세션 시작

1. 생성된 게임 카드에서 `새 세션 시작`
2. 세션 카드가 생성되고 참여 링크/QR이 표시됨

### 6-5. 학생 참여

- 학생들은 링크 또는 QR로 접속
- 참여 URL 형태: `participant.html?session=<세션ID>`

### 6-6. 결과 공개

1. 원하는 시점에 HOST가 `세션 종료 및 결과 공개` 클릭
2. 참여자 화면에서도 종료 결과가 반영됨

---

## 7) PARTICIPANT(학생) 사용 방법

1. 전달받은 링크 열기 (모바일 권장)
2. 화면에 게임 제목/선택지 확인
3. A 또는 B 선택
4. HOST가 종료할 때까지 대기
5. 종료 후 전체 결과 확인

> 같은 기기/브라우저에서 중복 선택은 방지됩니다.

---

## 8) TEST 페이지 (운영 전 리허설)

- 주소: `/public/test.html`
- 기능:
  - Apps Script URL 입력/저장
  - 테스트 게임 생성 + 세션 시작
  - A/B 가상 투표 수 입력 후 시뮬레이션
  - 세션 종료 및 결과 확인

수업 전날 이 페이지로 한 번 리허설하면 운영이 훨씬 안정적입니다.

---

## 9) 문제 해결(자주 발생)

## Q1. `요청 실패`, `응답이 JSON 형식이 아닙니다`가 떠요.

체크 순서:

1. Apps Script URL이 정확히 `.../exec`인지 확인
2. Apps Script가 `웹 앱`으로 배포되었는지 확인
3. 배포 권한이 `링크가 있는 모든 사용자`인지 확인
4. 코드 수정 후에는 `새 버전으로 재배포`했는지 확인

## Q2. 참여자가 접속했는데 세션을 못 찾는다고 해요.

- 링크의 `session` 파라미터가 잘렸는지 확인
- HOST가 세션 시작을 실제로 눌렀는지 확인
- 다른 배포 주소(도메인)에서 만든 링크를 섞어 쓰지 않았는지 확인

## Q3. 투표 수 반영이 즉시 안 보여요.

- 이 버전은 SSE 대신 polling(약 5초 주기) 방식입니다.
- 1~2번 새로고침하거나 몇 초 기다리면 반영됩니다.

## Q4. Apps Script 수정했는데 반영이 안 돼요.

- Apps Script는 수정 후 **반드시 재배포**(새 버전)해야 URL에서 동작이 갱신됩니다.

---

## 10) 파일 구조 설명

- `public/host.html`: HOST 운영 페이지
- `public/participant.html`: 학생 참여 페이지
- `public/test.html`: 리허설/검증 페이지
- `public/config.js`: Apps Script URL 저장/관리
- `public/api.js`: 프론트에서 Apps Script action 호출
- `apps-script/Code.gs`: Sheets 백엔드 로직

---

## 11) 로컬에서 화면만 빠르게 확인하고 싶을 때

```bash
python -m http.server 8080
```

브라우저에서:

- `http://localhost:8080/public/host.html`
- `http://localhost:8080/public/test.html`

---

## 12) 운영 체크리스트 (수업 시작 5분 전)

- [ ] HOST 페이지 열림 확인
- [ ] Apps Script URL 저장 확인
- [ ] TEST 페이지에서 1회 테스트(생성/투표/종료)
- [ ] 학생에게 공유할 링크/QR 준비
- [ ] 네트워크(와이파이) 상태 확인

이 체크리스트만 지켜도 실제 수업 운영 중 오류를 크게 줄일 수 있습니다.
