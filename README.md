# A-or-B Game

실시간 수업용 **A or B 선택 게임**입니다.

## 주요 기능
- HOST가 게임(제목, 선택지 A/B)을 설계하고 저장
- 저장된 게임마다 독립 세션 시작/종료
- 세션 참여 링크(`/join/:sessionId`) 제공 + QR 코드 표시
- PARTICIPANT는 모바일에서 단순 UI로 1회 선택
- HOST가 세션을 종료하면 전체 결과를 실시간으로 공개

## 실행
```bash
node server.js
```

접속 주소
- HOST: `http://localhost:3000/host.html`
- PARTICIPANT: HOST 화면에서 세션 링크/QR 코드 사용

## 데이터 저장
- `data/games.json`에 게임/세션 이력이 저장됩니다.
- 각 세션은 `participantTokens`와 `votes`를 독립 관리해 회차 간 영향이 없습니다.
