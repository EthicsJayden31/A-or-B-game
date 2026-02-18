# A-or-B Game (Serverless: Google Sheets + Apps Script)

## 페이지 역할
- `client.html`: 유일한 설정/관리 페이지 (Apps Script URL 설정, 게임/세션 생성/삭제)
- `host.html`: 진행 중 세션 자동 연결, 참여자 수 실시간 확인, 종료 시 결과 공개
- `participant.html`: 진행 중 세션 자동 연결 참여 화면
- `test.html`: 시뮬레이션 페이지 (URL 설정 UI 없음, CLIENT 설정값 사용)

## 변경된 운영 규칙
1. **Apps Script 연결은 CLIENT에서만 가능**
2. **한 번에 하나의 active 세션만 운영 가능**
3. HOST는 세션 진행 중 **참여자 수만 확인** 가능 (결과 비공개)
4. 세션 종료 시에만 최종 결과 공개

## 초기 설정
1. Google Sheets 생성
2. Apps Script에 `apps-script/Code.gs` 붙여넣기
3. 웹 앱(`.../exec`) 배포
4. `client.html` 접속 후 URL 저장

## 운영 흐름
1. CLIENT에서 게임 생성
2. CLIENT에서 세션 시작 (다른 active 세션이 있으면 시작 불가)
3. CLIENT가 제공한 HOST/PARTICIPANT 링크 공유
4. HOST에서 진행 중 참여자 수 확인
5. HOST가 세션 종료 -> 결과 공개 + 빵빠레

## 결과 표시
- 결과는 `A/B` 텍스트가 아니라 실제 선택지 문구(예: "밥", "면")로 표시됩니다.
- HOST 결과 화면에서 큰 아이콘/큰 숫자로 시각화됩니다.

## 로컬 미리보기
```bash
python -m http.server 8080
```
- `http://localhost:8080/public/client.html`
- `http://localhost:8080/public/host.html`
- `http://localhost:8080/public/participant.html`
- `http://localhost:8080/public/test.html`
