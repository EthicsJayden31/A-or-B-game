const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_PATH = path.join(ROOT, 'data', 'games.json');

function uid(length = 8) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function loadState() {
  if (!fs.existsSync(DATA_PATH)) {
    return { games: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!Array.isArray(parsed.games)) {
      return { games: [] };
    }
    return parsed;
  } catch (_error) {
    return { games: [] };
  }
}

let state = loadState();

function saveState() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function publicGames() {
  return state.games.map((game) => ({
    id: game.id,
    title: game.title,
    optionA: game.optionA,
    optionB: game.optionB,
    createdAt: game.createdAt,
    sessions: game.sessions.map((session) => ({
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      closedAt: session.closedAt || null,
      votes: session.votes,
      totalVotes: session.votes.A + session.votes.B,
      participants: Object.keys(session.participantTokens || {}).length,
    })),
  }));
}

function findSession(sessionId) {
  for (const game of state.games) {
    const session = game.sessions.find((entry) => entry.id === sessionId);
    if (session) {
      return { game, session };
    }
  }
  return null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error('invalid json'));
      }
    });
  });
}

const clients = {
  host: new Set(),
  session: new Map(),
};

function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function notifyHost() {
  const data = { games: publicGames() };
  for (const res of clients.host) {
    sseSend(res, 'gamesUpdated', data);
  }
}

function notifySession(sessionId, event, payload) {
  const listeners = clients.session.get(sessionId);
  if (!listeners) return;
  for (const res of listeners) {
    sseSend(res, event, payload);
  }
}

function ensureSessionParticipants(session) {
  if (!session.participantTokens) {
    session.participantTokens = {};
  }
}

function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/games') {
    return json(res, 200, { games: publicGames() });
  }

  if (req.method === 'POST' && url.pathname === '/api/games') {
    return parseBody(req)
      .then((body) => {
        const title = String(body.title || '').trim();
        const optionA = String(body.optionA || '').trim();
        const optionB = String(body.optionB || '').trim();

        if (!title || !optionA || !optionB) {
          return json(res, 400, { error: 'title, optionA, optionB는 필수입니다.' });
        }

        const game = {
          id: uid(10),
          title,
          optionA,
          optionB,
          createdAt: new Date().toISOString(),
          sessions: [],
        };
        state.games.unshift(game);
        saveState();
        notifyHost();
        return json(res, 201, { game });
      })
      .catch(() => json(res, 400, { error: '요청 본문이 올바르지 않습니다.' }));
  }

  const createSessionMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/sessions$/);
  if (req.method === 'POST' && createSessionMatch) {
    const game = state.games.find((entry) => entry.id === createSessionMatch[1]);
    if (!game) return json(res, 404, { error: '게임을 찾지 못했습니다.' });

    const activeExists = game.sessions.some((session) => session.status === 'active');
    if (activeExists) return json(res, 409, { error: '이미 진행 중인 세션이 있습니다.' });

    const session = {
      id: uid(8),
      status: 'active',
      createdAt: new Date().toISOString(),
      votes: { A: 0, B: 0 },
      participantTokens: {},
    };
    game.sessions.unshift(session);
    saveState();
    notifyHost();
    return json(res, 201, { session });
  }

  const closeSessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/close$/);
  if (req.method === 'POST' && closeSessionMatch) {
    const located = findSession(closeSessionMatch[1]);
    if (!located) return json(res, 404, { error: '세션을 찾지 못했습니다.' });

    const { game, session } = located;
    if (session.status !== 'active') {
      return json(res, 409, { error: '이미 종료된 세션입니다.' });
    }

    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    saveState();

    const payload = {
      sessionId: session.id,
      gameTitle: game.title,
      optionA: game.optionA,
      optionB: game.optionB,
      votes: session.votes,
      totalVotes: session.votes.A + session.votes.B,
    };

    notifySession(session.id, 'sessionClosed', payload);
    notifyHost();
    return json(res, 200, payload);
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (req.method === 'GET' && sessionMatch) {
    const located = findSession(sessionMatch[1]);
    if (!located) return json(res, 404, { error: '세션을 찾지 못했습니다.' });

    const { game, session } = located;
    return json(res, 200, {
      game: {
        id: game.id,
        title: game.title,
        optionA: game.optionA,
        optionB: game.optionB,
      },
      session: {
        id: session.id,
        status: session.status,
        votes: session.votes,
        totalVotes: session.votes.A + session.votes.B,
        createdAt: session.createdAt,
        closedAt: session.closedAt || null,
      },
    });
  }

  const voteMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/vote$/);
  if (req.method === 'POST' && voteMatch) {
    return parseBody(req)
      .then((body) => {
        const located = findSession(voteMatch[1]);
        if (!located) return json(res, 404, { error: '세션을 찾지 못했습니다.' });

        const { session } = located;
        if (session.status !== 'active') {
          return json(res, 409, { error: '이미 종료된 세션입니다.' });
        }

        const choice = body.choice;
        if (!['A', 'B'].includes(choice)) {
          return json(res, 400, { error: '선택지는 A 또는 B여야 합니다.' });
        }

        ensureSessionParticipants(session);
        const token = String(body.token || '');
        if (!token) {
          return json(res, 400, { error: '참여자 토큰이 필요합니다.' });
        }

        if (session.participantTokens[token]) {
          return json(res, 409, { error: '이미 선택을 완료했습니다.' });
        }

        session.participantTokens[token] = choice;
        session.votes[choice] += 1;
        saveState();

        const tally = {
          sessionId: session.id,
          votes: session.votes,
          totalVotes: session.votes.A + session.votes.B,
        };
        notifySession(session.id, 'voteUpdated', tally);
        notifyHost();

        return json(res, 200, { ok: true });
      })
      .catch(() => json(res, 400, { error: '요청 본문이 올바르지 않습니다.' }));
  }

  if (req.method === 'GET' && url.pathname === '/events/host') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    clients.host.add(res);
    sseSend(res, 'gamesUpdated', { games: publicGames() });
    req.on('close', () => clients.host.delete(res));
    return;
  }

  const sessionEventsMatch = url.pathname.match(/^\/events\/session\/([^/]+)$/);
  if (req.method === 'GET' && sessionEventsMatch) {
    const sessionId = sessionEventsMatch[1];
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');

    const listeners = clients.session.get(sessionId) || new Set();
    listeners.add(res);
    clients.session.set(sessionId, listeners);

    req.on('close', () => {
      listeners.delete(res);
      if (!listeners.size) {
        clients.session.delete(sessionId);
      }
    });
    return;
  }

  json(res, 404, { error: 'Not found' });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function serveStatic(res, filePath) {
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/events/')) {
    handleApi(req, res, url);
    return;
  }

  if (url.pathname.startsWith('/join/')) {
    serveStatic(res, path.join(PUBLIC_DIR, 'participant.html'));
    return;
  }

  const filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`A-or-B game server listening on http://localhost:${PORT}`);
});
