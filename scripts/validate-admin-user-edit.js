const http = require('http');
const sqlite3 = require('sqlite3').verbose();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = (process.env.TEST_EMAIL || 'feliperibeiro_@outlook.com').trim().toLowerCase();
const TEST_PASSWORD = process.env.TEST_PASSWORD || '@Ecommerce';

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function requestJson(path, method = 'GET', body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(`${BASE_URL}${path}`, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = raw;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy(new Error('Timeout na chamada HTTP')));

    if (payload) req.write(payload);
    req.end();
  });
}

function sanitizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

(async () => {
  const db = new sqlite3.Database('./data/dashboard.db');
  let original = null;
  let token = '';

  try {
    original = await dbGet(
      db,
      'SELECT id, username, email, role, status FROM users WHERE email = ?',
      [TEST_EMAIL]
    );

    if (!original) {
      throw new Error(`Usuario de teste nao encontrado: ${TEST_EMAIL}`);
    }

    await dbRun(db, 'UPDATE users SET role = ?, status = ? WHERE id = ?', ['admin', 'active', original.id]);

    const login = await requestJson('/api/auth/login', 'POST', {
      identifier: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (login.status !== 200 || !login.body || !login.body.token) {
      throw new Error(`Falha no login de teste (${login.status}): ${JSON.stringify(login.body)}`);
    }

    token = login.body.token;
    console.log('LOGIN_OK:', login.status, login.body.user && login.body.user.role);

    const list = await requestJson('/api/admin/users', 'GET', null, token);
    if (list.status !== 200 || !Array.isArray(list.body.users)) {
      throw new Error(`Falha ao listar usuarios (${list.status}): ${JSON.stringify(list.body)}`);
    }

    const found = list.body.users.find((u) => Number(u.id) === Number(original.id));
    if (!found) {
      throw new Error('Usuario nao apareceu na listagem /api/admin/users');
    }

    console.log('LIST_OK: total=', list.body.users.length, ' targetId=', original.id);

    const detailBefore = await requestJson(`/api/admin/users/${original.id}`, 'GET', null, token);
    if (detailBefore.status !== 200 || !detailBefore.body || !detailBefore.body.user) {
      throw new Error(`Falha ao buscar usuario por ID (${detailBefore.status}): ${JSON.stringify(detailBefore.body)}`);
    }

    const uniqueSuffix = Date.now().toString().slice(-4);
    const editedUsername = sanitizeUsername(`${original.username}_ed${uniqueSuffix}`).slice(0, 32);

    const edit = await requestJson(`/api/admin/users/${original.id}`, 'PATCH', {
      username: editedUsername,
      email: original.email,
      role: 'admin',
      status: 'active'
    }, token);

    if (edit.status !== 200) {
      throw new Error(`Falha ao editar usuario (${edit.status}): ${JSON.stringify(edit.body)}`);
    }

    const detailAfter = await requestJson(`/api/admin/users/${original.id}`, 'GET', null, token);
    if (detailAfter.status !== 200 || !detailAfter.body || !detailAfter.body.user) {
      throw new Error(`Falha ao confirmar edicao (${detailAfter.status}): ${JSON.stringify(detailAfter.body)}`);
    }

    const persistedUsername = detailAfter.body.user.username;
    if (persistedUsername !== editedUsername) {
      throw new Error(`Edicao nao persistiu no banco. Esperado=${editedUsername} Recebido=${persistedUsername}`);
    }

    console.log('EDIT_OK: username persistido =', persistedUsername);

    const rollback = await requestJson(`/api/admin/users/${original.id}`, 'PATCH', {
      username: original.username,
      email: original.email,
      role: original.role,
      status: original.status
    }, token);

    if (rollback.status !== 200) {
      throw new Error(`Falha ao restaurar usuario via API (${rollback.status}): ${JSON.stringify(rollback.body)}`);
    }

    console.log('ROLLBACK_OK: dados originais restaurados');
    console.log('VALIDATION_RESULT: PASS');
  } catch (error) {
    console.log('VALIDATION_RESULT: FAIL');
    console.log('DETAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (original) {
      await dbRun(
        db,
        'UPDATE users SET role = ?, status = ? WHERE id = ?',
        [original.role, original.status, original.id]
      ).catch(() => {});
    }
    db.close();
  }
})();
