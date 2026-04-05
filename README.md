# Multi-Option Reason Survey (Google Sheets + Apps Script)

기존 A/B 투표 앱을 **다중 선택(2~5개) + 선택 사유 워드클라우드 비교** 조사 앱으로 확장했습니다.

## 페이지 역할
- `client.html`: 조사 설계/세션 시작/삭제 관리
- `host.html`: 진행 중 참여자 수 확인, 종료 후 결과 + 워드클라우드 비교
- `participant.html`: 진행 중 세션 자동 연결, 선택 + 이유 제출
- `test.html`: 빠른 동작 점검용 페이지

## 핵심 기능
1. 선택지 개수: **최소 2개, 최대 5개**
2. 참가자는 선택 시 **선택 이유를 필수 입력**
3. 세션 종료 후 HOST에서
   - 선택지별 득표 비교
   - 선택지별 사유 **word cloud** 비교

## 초기 설정
1. Google Sheets 생성
2. Apps Script에 `apps-script/Code.gs` 붙여넣기
3. 웹 앱(`.../exec`) 배포
4. `client.html` 접속 후 URL 저장

## 로컬 미리보기
```bash
python -m http.server 8080
```
- `http://localhost:8080/public/client.html`
- `http://localhost:8080/public/host.html`
- `http://localhost:8080/public/participant.html`
- `http://localhost:8080/public/test.html`
