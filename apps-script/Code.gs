/**
 * Google Apps Script backend for multi-option survey + reason cloud.
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
    return jsonResponse({ ok: false, error: error.message || 'Unknown error' });
  }
}

function route(body) {
  const action = String(body.action || '');
  if (!action) throw new Error('action이 필요합니다.');

  switch (action) {
    case 'listGames': return { ok: true, games: listGames() };
    case 'getCurrentSession': return { ok: true, ...getCurrentSession(body) };
    case 'createGame': return { ok: true, game: createGame(body) };
    case 'deleteGame': deleteGame(body); return { ok: true };
    case 'startSession': return { ok: true, session: startSession(body) };
    case 'deleteSession': deleteSession(body); return { ok: true };
    case 'closeSession': closeSession(body); return { ok: true };
    case 'getSession': return { ok: true, ...getSession(body) };
    case 'vote': vote(body); return { ok: true };
    default: throw new Error('지원하지 않는 action입니다.');
  }
}

function getCurrentSession(body) {
  const requestedSessionId = String(body.sessionId || '').trim();
  if (requestedSessionId) return getSession({ sessionId: requestedSessionId });

  const { sessions } = getSheets_();
  const sessionRows = readRows_(sessions);
  if (!sessionRows.length) return { current: null };

  const normalizeTime = (value) => String(value || '');
  const compareTimeDesc = (a, b) => normalizeTime(b.createdAt).localeCompare(normalizeTime(a.createdAt));
  const sorted = [...sessionRows].sort(compareTimeDesc);

  const active = sorted.find((s) => String(s.status) === 'active');
  if (active) return getSession({ sessionId: String(active.id) });

  const latestClosed = sorted.find((s) => String(s.status) === 'closed');
  if (latestClosed) return getSession({ sessionId: String(latestClosed.id) });

  return { current: null };
}

function getSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const games = ss.getSheetByName(SHEET_GAMES) || ss.insertSheet(SHEET_GAMES);
  const sessions = ss.getSheetByName(SHEET_SESSIONS) || ss.insertSheet(SHEET_SESSIONS);
  const votes = ss.getSheetByName(SHEET_VOTES) || ss.insertSheet(SHEET_VOTES);

  ensureHeaders_(games, ['id', 'title', 'optionsJson', 'createdAt']);
  ensureHeaders_(sessions, ['id', 'gameId', 'status', 'createdAt', 'closedAt']);
  ensureHeaders_(votes, ['sessionId', 'participantToken', 'optionId', 'reason', 'createdAt']);

  return { games, sessions, votes };
}

function ensureHeaders_(sheet, targetHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(targetHeaders);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((h) => String(h || '').trim());
  const same = targetHeaders.length === currentHeaders.length && targetHeaders.every((h, i) => h === currentHeaders[i]);
  if (same) return;

  const rows = sheet.getDataRange().getValues();
  sheet.clearContents();
  sheet.appendRow(targetHeaders);

  if (rows.length <= 1) return;
  const currentIndexByHeader = {};
  currentHeaders.forEach((h, idx) => { currentIndexByHeader[h] = idx; });

  const migrated = rows.slice(1).map((row) => {
    const oldObj = {};
    currentHeaders.forEach((h, idx) => { oldObj[h] = row[idx]; });
    return targetHeaders.map((header) => migrateCell_(sheet.getName(), header, oldObj));
  });

  if (migrated.length) sheet.getRange(2, 1, migrated.length, targetHeaders.length).setValues(migrated);
}

function migrateCell_(sheetName, targetHeader, oldObj) {
  if (sheetName === SHEET_GAMES) {
    if (targetHeader === 'optionsJson') {
      if (oldObj.optionsJson) return oldObj.optionsJson;
      const optionA = String(oldObj.optionA || '').trim();
      const optionB = String(oldObj.optionB || '').trim();
      const opts = [];
      if (optionA) opts.push({ id: 'opt1', text: optionA });
      if (optionB) opts.push({ id: 'opt2', text: optionB });
      return JSON.stringify(opts);
    }
  }

  if (sheetName === SHEET_VOTES) {
    if (targetHeader === 'optionId') {
      const legacyChoice = String(oldObj.choice || '').trim();
      if (legacyChoice === 'A') return 'opt1';
      if (legacyChoice === 'B') return 'opt2';
      return oldObj.optionId || '';
    }
    if (targetHeader === 'reason') return oldObj.reason || '';
  }

  return oldObj[targetHeader] || '';
}

function uid_(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < len; i += 1) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function parseOptions_(optionsRaw) {
  const list = Array.isArray(optionsRaw) ? optionsRaw : [];
  const normalized = list
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0)
    .slice(0, 5)
    .map((text, idx) => ({ id: `opt${idx + 1}`, text: text }));

  if (normalized.length < 2) throw new Error('선택지는 최소 2개, 최대 5개가 필요합니다.');

  const uniqueTexts = {};
  normalized.forEach((opt) => {
    if (uniqueTexts[opt.text]) throw new Error('중복된 선택지는 사용할 수 없습니다.');
    uniqueTexts[opt.text] = true;
  });

  return normalized;
}

function parseOptionsJson_(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((opt) => opt && String(opt.id) && String(opt.text));
  } catch (_error) {
    return [];
  }
}

function readRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  });
}

function listGames() {
  const { games, sessions, votes } = getSheets_();
  const gameRows = readRows_(games);
  const sessionRows = readRows_(sessions);
  const voteRows = readRows_(votes);

  const votesBySession = {};
  voteRows.forEach((vote) => {
    const sid = String(vote.sessionId || '');
    if (!sid) return;
    if (!votesBySession[sid]) votesBySession[sid] = [];
    votesBySession[sid].push(vote);
  });

  const sessionsByGame = {};
  sessionRows.forEach((session) => {
    const gameId = String(session.gameId || '');
    if (!sessionsByGame[gameId]) sessionsByGame[gameId] = [];

    const sessionVotes = votesBySession[String(session.id)] || [];
    sessionsByGame[gameId].push({
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      closedAt: session.closedAt || null,
      participantCount: sessionVotes.length,
      votes: buildVoteSummary_(sessionVotes),
      totalVotes: sessionVotes.length,
    });
  });

  return gameRows.map((game) => {
    const options = parseOptionsJson_(game.optionsJson);
    const sessionsForGame = (sessionsByGame[game.id] || []).map((session) => ({
      ...session,
      votes: fillVoteSummary_(options, session.votes),
    }));

    return {
      id: game.id,
      title: game.title,
      options: options,
      createdAt: game.createdAt,
      sessions: sessionsForGame.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    };
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function buildVoteSummary_(voteRows) {
  const summary = {};
  voteRows.forEach((vote) => {
    const optionId = String(vote.optionId || '');
    if (!optionId) return;
    summary[optionId] = Number(summary[optionId] || 0) + 1;
  });
  return summary;
}

function fillVoteSummary_(options, summary) {
  const out = {};
  (options || []).forEach((opt) => { out[opt.id] = Number(summary?.[opt.id] || 0); });
  return out;
}

function createGame(body) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('title은 필수입니다.');

  const options = parseOptions_(body.options);
  const game = {
    id: uid_(10),
    title: title,
    options: options,
    createdAt: new Date().toISOString(),
  };

  const { games } = getSheets_();
  games.appendRow([game.id, game.title, JSON.stringify(game.options), game.createdAt]);
  return game;
}

function deleteGame(body) {
  const gameId = String(body.gameId || '');
  if (!gameId) throw new Error('gameId가 필요합니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const { games, sessions, votes } = getSheets_();
    const sessionRows = readRows_(sessions);
    const sessionIds = sessionRows.filter((s) => String(s.gameId) === gameId).map((s) => String(s.id));

    deleteRowsByPredicate_(votes, (r) => sessionIds.indexOf(String(r.sessionId)) >= 0);
    deleteRowsByPredicate_(sessions, (r) => String(r.gameId) === gameId);
    deleteRowsByPredicate_(games, (r) => String(r.id) === gameId);
  } finally {
    lock.releaseLock();
  }
}

function startSession(body) {
  const gameId = String(body.gameId || '');
  if (!gameId) throw new Error('gameId가 필요합니다.');

  const { sessions } = getSheets_();
  const rows = readRows_(sessions);
  const active = rows.find((r) => r.status === 'active');
  if (active) throw new Error('이미 진행 중인 세션이 있습니다. 한 번에 하나의 세션만 운영할 수 있습니다.');

  const session = {
    id: uid_(8),
    gameId: gameId,
    status: 'active',
    createdAt: new Date().toISOString(),
    closedAt: '',
  };

  sessions.appendRow([session.id, session.gameId, session.status, session.createdAt, session.closedAt]);
  return { id: session.id, status: session.status, createdAt: session.createdAt };
}

function deleteSession(body) {
  const sessionId = String(body.sessionId || '');
  if (!sessionId) throw new Error('sessionId가 필요합니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const { sessions, votes } = getSheets_();
    deleteRowsByPredicate_(votes, (r) => String(r.sessionId) === sessionId);
    deleteRowsByPredicate_(sessions, (r) => String(r.id) === sessionId);
  } finally {
    lock.releaseLock();
  }
}

function closeSession(body) {
  const sessionId = String(body.sessionId || '');
  if (!sessionId) throw new Error('sessionId가 필요합니다.');

  const { sessions } = getSheets_();
  const sessionRows = readRows_(sessions);
  const idx = sessionRows.findIndex((s) => String(s.id) === sessionId);
  if (idx < 0) throw new Error('세션을 찾지 못했습니다.');
  if (sessionRows[idx].status !== 'active') throw new Error('이미 종료된 세션입니다.');

  const rowNumber = idx + 2;
  sessions.getRange(rowNumber, 3, 1, 2).setValues([['closed', new Date().toISOString()]]);
}

function getSession(body) {
  const sessionId = String(body.sessionId || '');
  if (!sessionId) throw new Error('sessionId가 필요합니다.');

  const { games, sessions, votes } = getSheets_();
  const gameRows = readRows_(games);
  const sessionRows = readRows_(sessions);
  const voteRows = readRows_(votes);

  const session = sessionRows.find((s) => String(s.id) === sessionId);
  if (!session) throw new Error('세션을 찾지 못했습니다.');

  const game = gameRows.find((g) => String(g.id) === String(session.gameId));
  if (!game) throw new Error('게임을 찾지 못했습니다.');

  const options = parseOptionsJson_(game.optionsJson);
  const sessionVotes = voteRows.filter((v) => String(v.sessionId) === sessionId);
  const summary = fillVoteSummary_(options, buildVoteSummary_(sessionVotes));

  return {
    game: {
      id: game.id,
      title: game.title,
      options: options,
    },
    session: {
      id: session.id,
      status: session.status,
      votes: summary,
      totalVotes: sessionVotes.length,
      participantCount: sessionVotes.length,
      reasonsByOption: buildReasonsByOption_(sessionVotes, options),
      reasonEntries: buildReasonEntries_(sessionVotes),
      reasonCloudByOption: buildReasonCloudByOption_(sessionVotes, options),
      createdAt: session.createdAt,
      closedAt: session.closedAt || null,
    },
  };
}

function vote(body) {
  const sessionId = String(body.sessionId || '');
  const optionId = String(body.optionId || '');
  const reason = String(body.reason || '').trim();
  const token = String(body.token || '');

  if (!sessionId || !token) throw new Error('sessionId, token이 필요합니다.');
  if (!optionId) throw new Error('선택지가 필요합니다.');
  if (!reason) throw new Error('선택 이유를 입력해 주세요.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const { games, sessions, votes } = getSheets_();
    const gameRows = readRows_(games);
    const sessionRows = readRows_(sessions);
    const voteRows = readRows_(votes);

    const session = sessionRows.find((s) => String(s.id) === sessionId);
    if (!session) throw new Error('세션을 찾지 못했습니다.');
    if (session.status !== 'active') throw new Error('이미 종료된 세션입니다.');

    const game = gameRows.find((g) => String(g.id) === String(session.gameId));
    const options = parseOptionsJson_(game?.optionsJson || '[]');
    const validOption = options.some((opt) => String(opt.id) === optionId);
    if (!validOption) throw new Error('유효하지 않은 선택지입니다.');

    const duplicate = voteRows.find((v) => String(v.sessionId) === sessionId && String(v.participantToken) === token);
    if (duplicate) throw new Error('이미 응답을 완료했습니다.');

    votes.appendRow([sessionId, token, optionId, reason, new Date().toISOString()]);
  } finally {
    lock.releaseLock();
  }
}

function buildReasonCloudByOption_(voteRows, options) {
  const out = {};
  (options || []).forEach((opt) => { out[opt.id] = []; });

  const countByOption = {};
  voteRows.forEach((vote) => {
    const optionId = String(vote.optionId || '');
    const reason = String(vote.reason || '');
    const words = tokenizeReason_(reason);

    if (!countByOption[optionId]) countByOption[optionId] = {};
    words.forEach((word) => {
      countByOption[optionId][word] = Number(countByOption[optionId][word] || 0) + 1;
    });
  });

  (options || []).forEach((opt) => {
    const map = countByOption[opt.id] || {};
    out[opt.id] = Object.keys(map)
      .map((word) => ({ word: word, count: map[word] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  });

  return out;
}

function buildReasonsByOption_(voteRows, options) {
  const out = {};
  (options || []).forEach((opt) => { out[opt.id] = []; });

  voteRows.forEach((vote) => {
    const optionId = String(vote.optionId || '');
    const reason = String(vote.reason || '').trim();
    if (!reason) return;
    if (!out[optionId]) out[optionId] = [];
    out[optionId].push(reason);
  });

  return out;
}

function buildReasonEntries_(voteRows) {
  return voteRows
    .map((vote) => ({
      optionId: String(vote.optionId || '').trim(),
      reason: String(vote.reason || '').trim(),
      createdAt: String(vote.createdAt || ''),
    }))
    .filter((entry) => entry.optionId && entry.reason);
}

function tokenizeReason_(text) {
  const stopwords = {
    그리고: true, 하지만: true, 그냥: true, 정말: true, 너무: true,
    선택: true, 이유: true, 이거: true, 저거: true, 해당: true,
  };

  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopwords[w]);
}

function deleteRowsByPredicate_(sheet, predicate) {
  const rows = readRows_(sheet);
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (predicate(rows[i])) sheet.deleteRow(i + 2);
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
