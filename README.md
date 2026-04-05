# 다중 선택 + 사유 워드클라우드 설문 웹앱

> 기존 A-or-B 앱을 확장한 버전입니다.  
> 참가자는 **2~5개 선택지 중 1개를 고르고, 선택 이유를 반드시 작성**합니다.  
> HOST는 세션 종료 후 **선택지별 득표 + 이유 워드클라우드**를 한눈에 비교할 수 있습니다.

---

## 1) 빠른 시작 링크

- 서비스 홈(최초 페이지): https://ethicsjayden31.github.io/A-or-B-game/
- CLIENT: https://ethicsjayden31.github.io/A-or-B-game/client.html
- HOST: https://ethicsjayden31.github.io/A-or-B-game/host.html
- PARTICIPANT: https://ethicsjayden31.github.io/A-or-B-game/participant.html
- TEST: https://ethicsjayden31.github.io/A-or-B-game/test.html

> 홈 페이지에서도 위 4개 페이지로 이동할 수 있는 링크를 제공합니다.

---

## 2) 페이지별 역할

### CLIENT (`client.html`)
- 설문 주제/선택지 생성
- 세션 시작/삭제
- Apps Script URL 저장
- HOST/PARTICIPANT 링크 생성

### HOST (`host.html`)
- 현재 진행 중 세션 자동 연결
- 진행 중에는 참여자 수만 확인
- 세션 종료 후 결과 공개
  - 선택지별 득표 수/비율
  - 선택지별 사유 워드클라우드

### PARTICIPANT (`participant.html`)
- 진행 중 세션 자동 연결
- 선택지 1개 선택 + 이유 입력(필수)
- 제출 완료 후 대기

### TEST (`test.html`)
- 빠른 기능 점검용
- 테스트 설문 생성, 세션 시작/종료를 빠르게 확인

---

## 3) 처음 사용하는 분을 위한 전체 설정 가이드

## A. Google Sheets / Apps Script 준비

1. 구글 스프레드시트를 새로 만듭니다.
2. 상단 메뉴에서 **확장 프로그램 → Apps Script**를 엽니다.
3. `apps-script/Code.gs` 내용을 Apps Script 편집기에 붙여넣고 저장합니다.
4. **배포 → 새 배포**에서 웹 앱으로 배포합니다.
   - 실행 사용자: 본인
   - 액세스 권한: 링크가 있는 모든 사용자(또는 조직 정책에 맞는 공개 범위)
5. 배포 후 생성된 `.../exec` URL을 복사합니다.

## B. 웹앱에 URL 연결

1. `client.html`을 엽니다.
2. **Google Apps Script 연결** 섹션의 입력창에 `.../exec` URL을 붙여넣습니다.
3. **URL 저장** 버튼을 누릅니다.
4. 저장 성공 후 같은 브라우저에서는 localStorage에 URL이 유지됩니다.

---

## 4) 실제 운영 순서 (권장)

1. CLIENT에서 새 설문을 생성합니다.
   - 선택지는 최소 2개, 최대 5개
2. CLIENT에서 **새 세션 시작**
3. PARTICIPANT 링크를 참여자에게 공유
4. HOST에서 참여자 수를 확인하며 진행
5. HOST에서 **투표 종료 및 결과 공개**

---

## 5) 데이터 구조(요약)

- 게임: `title`, `optionsJson`
- 투표: `sessionId`, `participantToken`, `optionId`, `reason`
- 결과: 선택지별 득표 집계 + 사유 단어 빈도(워드클라우드용)

기존 A/B 데이터(`optionA/optionB`, `choice`)는 Apps Script 내부 마이그레이션 로직으로 호환되도록 설계되어 있습니다.

---

## 6) 로컬에서 실행하기

루트 폴더에서 아래 명령 실행:

```bash
python -m http.server 8080
```

브라우저 접속:
- 홈: `http://localhost:8080/public/`
- CLIENT: `http://localhost:8080/public/client.html`
- HOST: `http://localhost:8080/public/host.html`
- PARTICIPANT: `http://localhost:8080/public/participant.html`
- TEST: `http://localhost:8080/public/test.html`

---

## 7) 자주 발생하는 문제 해결

### Q1. `Failed to fetch`가 뜹니다.
- Apps Script URL이 `.../exec`인지 확인
- 웹 앱 배포 권한이 외부 접근 가능한지 확인
- URL 저장 후 페이지 새로고침

### Q2. 세션이 안 보입니다.
- CLIENT에서 세션 시작이 되었는지 확인
- HOST/PARTICIPANT가 동일한 API URL을 사용 중인지 확인

### Q3. 참여자가 제출했는데 결과가 안 보입니다.
- 정상 동작입니다. 결과는 HOST에서 세션 종료 후 공개됩니다.

---

## 8) 파일 구조

- `public/index.html`: 홈(페이지 링크)
- `public/client.html`, `public/client.js`: 설문 관리
- `public/host.html`, `public/host.js`: 진행/결과 공개
- `public/participant.html`, `public/participant.js`: 응답 제출
- `public/test.html`, `public/test.js`: 빠른 테스트
- `public/api.js`: Apps Script 호출 래퍼
- `public/styles.css`: 공통 스타일
- `apps-script/Code.gs`: 백엔드 스크립트

