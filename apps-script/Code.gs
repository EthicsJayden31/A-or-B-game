/**
 * Google Apps Script backend for A-or-B Game.
 *
 * Required sheets in one Spreadsheet:
 * - games:    [id, title, optionA, optionB, createdAt]
 * - sessions: [id, gameId, status, createdAt, closedAt, votesA, votesB]
 * - votes:    [sessionId, participantToken, choice, createdAt]
 */

const SHEET_GAMES = 'games';
const SHEET_SESSIONS = 'sessions';
const SHEET_VOTES = 'votes';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const result = route(body);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || 'Unknown error' }, 400);
  }
}

function route(body) {
  const action = String(body.action || '');
  if (!action) throw new Error('action이 필요합니다.');

  switch (action) {
    case 'listGames':
      return { ok: true, games: listGames() };
    case 'createGame':
      return { ok: true, game: createGame(body) };
    case 'startSession':
      return { ok: true, session: startSession(body) };
    case 'closeSession':
      return { ok: true, ...closeSession(body) };
    case 'getSession':
      return { ok: true, ...getSession(body) };
    case 'vote':
      vote(body);
      return { ok: true };
    default:
      throw new Error('지원하지 않는 action입니다.');
  }
}

function getSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const games = ss.getSheetByName(SHEET_GAMES) || ss.insertSheet(SHEET_GAMES);
  const sessions = ss.getSheetByName(SHEET_SESSIONS) || ss.insertSheet(SHEET_SESSIONS);
  const votes = ss.getSheetByName(SHEET_VOTES) || ss.insertSheet(SHEET_VOTES);

  if (games.getLastRow() === 0) games.appendRow(['id', 'title', 'optionA', 'optionB', 'createdAt']);
  if (sessions.getLastRow() === 0) sessions.appendRow(['id', 'gameId', 'status', 'createdAt', 'closedAt', 'votesA', 'votesB']);
  if (votes.getLastRow() === 0) votes.appendRow(['sessionId', 'participantToken', 'choice', 'createdAt']);

  return { games, sessions, votes };
}

function uid_(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < len; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function listGames() {
  const { games, sessions } = getSheets_();
  const gameRows = readRows_(games);
  const sessionRows = readRows_(sessions);

  const byGame = {};
  sessionRows.forEach((s) => {
    if (!byGame[s.gameId]) byGame[s.gameId] = [];
    byGame[s.gameId].push({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      closedAt: s.closedAt || null,
      votes: { A: Number(s.votesA || 0), B: Number(s.votesB || 0) },
      totalVotes: Number(s.votesA || 0) + Number(s.votesB || 0),
    });
  });

  return gameRows.map((g) => ({
    id: g.id,
    title: g.title,
    optionA: g.optionA,
    optionB: g.optionB,
    createdAt: g.createdAt,
    sessions: (byGame[g.id] || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function createGame(body) {
  const title = String(body.title || '').trim();
  const optionA = String(body.optionA || '').trim();
  const optionB = String(body.optionB || '').trim();
  if (!title || !optionA || !optionB) throw new Error('title, optionA, optionB는 필수입니다.');

  const { games } = getSheets_();
  const game = {
    id: uid_(10),
    title,
    optionA,
    optionB,
    createdAt: new Date().toISOString(),
  };
  games.appendRow([game.id, game.title, game.optionA, game.optionB, game.createdAt]);
  return game;
}

function startSession(body) {
  const gameId = String(body.gameId || '');
  if (!gameId) throw new Error('gameId가 필요합니다.');

  const { sessions } = getSheets_();
  const rows = readRows_(sessions);
  const active = rows.find((r) => r.gameId === gameId && r.status === 'active');
  if (active) throw new Error('이미 진행 중인 세션이 있습니다.');

  const session = {
    id: uid_(8),
    gameId,
    status: 'active',
    createdAt: new Date().toISOString(),
    closedAt: '',
    votesA: 0,
    votesB: 0,
  };

  sessions.appendRow([session.id, session.gameId, session.status, session.createdAt, session.closedAt, session.votesA, session.votesB]);
  return {
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    closedAt: null,
    votes: { A: 0, B: 0 },
    totalVotes: 0,
  };
}

function closeSession(body) {
  const sessionId = String(body.sessionId || '');
  if (!sessionId) throw new Error('sessionId가 필요합니다.');

  const { games, sessions } = getSheets_();
  const gameRows = readRows_(games);
  const sessionRows = readRows_(sessions);

  const idx = sessionRows.findIndex((s) => s.id === sessionId);
  if (idx < 0) throw new Error('세션을 찾지 못했습니다.');
  if (sessionRows[idx].status !== 'active') throw new Error('이미 종료된 세션입니다.');

  const rowNumber = idx + 2;
  const closedAt = new Date().toISOString();
  sessions.getRange(rowNumber, 3, 1, 2).setValues([['closed', closedAt]]);

  const updated = readRows_(sessions).find((s) => s.id === sessionId);
  const game = gameRows.find((g) => g.id === updated.gameId);

  return {
    sessionId,
    gameTitle: game.title,
    optionA: game.optionA,
    optionB: game.optionB,
    votes: { A: Number(updated.votesA || 0), B: Number(updated.votesB || 0) },
    totalVotes: Number(updated.votesA || 0) + Number(updated.votesB || 0),
  };
}

function getSession(body) {
  const sessionId = String(body.sessionId || '');
  if (!sessionId) throw new Error('sessionId가 필요합니다.');

  const { games, sessions } = getSheets_();
  const gameRows = readRows_(games);
  const sessionRows = readRows_(sessions);

  const session = sessionRows.find((s) => s.id === sessionId);
  if (!session) throw new Error('세션을 찾지 못했습니다.');

  const game = gameRows.find((g) => g.id === session.gameId);
  if (!game) throw new Error('게임을 찾지 못했습니다.');

  return {
    game: {
      id: game.id,
      title: game.title,
      optionA: game.optionA,
      optionB: game.optionB,
    },
    session: {
      id: session.id,
      status: session.status,
      votes: { A: Number(session.votesA || 0), B: Number(session.votesB || 0) },
      totalVotes: Number(session.votesA || 0) + Number(session.votesB || 0),
      createdAt: session.createdAt,
      closedAt: session.closedAt || null,
    },
  };
}

function vote(body) {
  const sessionId = String(body.sessionId || '');
  const choice = String(body.choice || '');
  const token = String(body.token || '');

  if (!sessionId || !token) throw new Error('sessionId, token이 필요합니다.');
  if (choice !== 'A' && choice !== 'B') throw new Error('선택지는 A 또는 B여야 합니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const { sessions, votes } = getSheets_();
    const sessionRows = readRows_(sessions);
    const voteRows = readRows_(votes);

    const idx = sessionRows.findIndex((s) => s.id === sessionId);
    if (idx < 0) throw new Error('세션을 찾지 못했습니다.');

    const session = sessionRows[idx];
    if (session.status !== 'active') throw new Error('이미 종료된 세션입니다.');

    const duplicate = voteRows.find((v) => v.sessionId === sessionId && v.participantToken === token);
    if (duplicate) throw new Error('이미 선택을 완료했습니다.');

    votes.appendRow([sessionId, token, choice, new Date().toISOString()]);

    const rowNumber = idx + 2;
    const nextA = Number(session.votesA || 0) + (choice === 'A' ? 1 : 0);
    const nextB = Number(session.votesB || 0) + (choice === 'B' ? 1 : 0);
    sessions.getRange(rowNumber, 6, 1, 2).setValues([[nextA, nextB]]);
  } finally {
    lock.releaseLock();
  }
}

function readRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    return obj;
  });
}

function jsonResponse(payload, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);

  // Apps Script ContentService는 status code 지정이 제한적이므로 payload.ok로 실패를 표시합니다.
  return output;
}
