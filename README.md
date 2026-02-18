# A-or-B Game (Serverless: Google Sheets + Apps Script)

수업에서 학생들이 **A/B 선택**에 실시간 참여하는 게임입니다.
서버를 별도로 운영하지 않고, 아래 구조로 동작합니다.

- 화면(웹): 정적 배포 (`public/*`)
- 데이터: Google Sheets
- API: Google Apps Script Web App

---

## 페이지 역할 (중요)

이제 페이지가 3가지 역할로 분리됩니다.

1. **CLIENT (`client.html`)**
   - 게임/세션 설계 및 전체 관리
   - 게임 삭제, 세션 삭제 가능
2. **HOST (`host.html`)**
   - 특정 세션 진행 전용
   - 세션 종료 전에는 결과 비공개
   - 종료 시 결과 공개 + 빵빠레 효과음
3. **PARTICIPANT (`participant.html`)**
   - 학생 참여 화면
   - Google Apps Script 설정 UI 없음(링크의 파라미터로 자동 연결)

---

## 1) 처음 1회 설정: Google Sheets + Apps Script

### 1-1. 스프레드시트 만들기
1. Google Sheets에서 빈 문서 생성
2. 이름 예: `A-or-B Game Data`

### 1-2. Apps Script 열기
1. 상단 메뉴 `확장 프로그램` > `Apps Script`
2. 기본 코드 삭제
3. 이 저장소의 `apps-script/Code.gs` 전체 붙여넣기
4. 저장

### 1-3. 웹 앱 배포
1. 우측 상단 `배포` > `새 배포`
2. 유형: `웹 앱`
3. 실행 사용자: 본인
4. 액세스 권한: 링크가 있는 모든 사용자
5. 배포 후 `.../exec` URL 복사

---

## 2) 정적 배포

아래 중 편한 방식 사용:

- GitHub Pages
- Netlify
- Vercel

배포 후 접속 예시:

- `https://your-site/public/client.html` (관리)
- `https://your-site/public/host.html` (세션 진행)
- `https://your-site/public/test.html` (리허설)

---

## 3) 운영 방법 (권장 순서)

### 단계 A. CLIENT에서 준비
1. `client.html` 접속
2. Apps Script URL(`.../exec`) 저장
3. 게임 생성
4. 세션 시작
5. 생성된 링크 사용:
   - 참여자 링크(`participant.html?session=...&api=...`)
   - HOST 진행 링크(`host.html?session=...&api=...`)

### 단계 B. HOST에서 진행
1. `host.html` 또는 CLIENT에서 생성된 HOST 링크 접속
2. 세션 로드
3. 진행 중에는 결과가 비공개
4. 마지막에 `세션 종료 및 결과 공개`
5. 결과 공개 시 빵빠레 효과음 재생

### 단계 C. PARTICIPANT 참여
1. 전달받은 참여 링크 접속
2. A/B 선택
3. HOST 종료까지 대기
4. 종료 후 결과 확인

---

## 4) 삭제 기능

`client.html`에서 가능합니다.

- **세션 삭제**: 해당 세션 + 해당 세션 투표 삭제
- **게임 삭제**: 게임 + 하위 모든 세션 + 관련 투표 전체 삭제

삭제는 되돌릴 수 없으니 확인 후 사용하세요.

---

## 5) 결과 비공개 정책

요구사항 반영:

- HOST는 세션 종료 전 결과(A/B 집계)를 볼 수 없음
- PARTICIPANT도 종료 전 결과를 볼 수 없음
- API 레벨에서도 active 세션 결과는 비공개 값으로 반환

---

## 6) TEST 페이지

`test.html`에서 아래를 한 화면에서 검증할 수 있습니다.

- Apps Script URL 저장
- 게임 생성 + 세션 시작
- 가상 투표
- 세션 종료 및 결과 확인
- 참여 링크/HOST 진행 링크 생성 확인

---

## 7) 자주 발생하는 문제

### `Failed to fetch` / 요청 실패
확인 순서:
1. URL이 `.../exec`인지
2. Apps Script가 웹 앱으로 배포됐는지
3. 액세스 권한이 `링크가 있는 모든 사용자`인지
4. Apps Script 수정 후 재배포했는지

### 세션이 안 열림
- `session` 파라미터가 포함된 링크인지 확인
- 다른 배포 주소의 오래된 링크를 쓰지 않았는지 확인

---

## 8) 로컬 미리보기(선택)

```bash
python -m http.server 8080
```

- `http://localhost:8080/public/client.html`
- `http://localhost:8080/public/host.html`
- `http://localhost:8080/public/test.html`
