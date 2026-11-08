const { isEmail } = require('class-validator');

const LOGIN_PATH = '/api/auth/workspace-login';
const WINDOW_MS = 60_000;

function createWorkspaceLogin({ primary, entries, workerFor, hasAccount, headersFor }) {
  const attempts = new Map();
  let windowEnds = 0;
  let total = 0;

  return async function workspaceLogin(request, response) {
    const send = (status, body, cookies = []) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
      });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST' || !/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
      return send(400, { message: 'Invalid sign-in request.' });
    }
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > 4096) return send(413, { message: 'Sign-in request is too large.' });
        chunks.push(chunk);
      }
      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(400, { message: 'Invalid sign-in request.' });
      }
      const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
      const password = data?.password;
      if (email.length > 254 || !isEmail(email) || typeof password !== 'string' || password.length < 8 || password.length > 1024) {
        return send(400, { message: 'Invalid sign-in request.' });
      }

      const now = Date.now();
      if (now >= windowEnds) {
        attempts.clear();
        total = 0;
        windowEnds = now + WINDOW_MS;
      }
      const count = attempts.get(email) || 0;
      if (count >= 8 || total >= 120) return send(429, { message: 'Try again shortly.' });
      attempts.set(email, count + 1);
      total += 1;

      const tenants = [...entries().values()].filter(({ status }) => status === 'active');
      const candidates = [primary];
      for (let index = 0; index < tenants.length; index += 8) {
        const batch = tenants.slice(index, index + 8);
        const found = await Promise.all(batch.map((tenant) => hasAccount(tenant, email)));
        candidates.push(...batch.filter((_, offset) => found[offset]).map(({ id }) => id));
      }
      const logins = await Promise.all(candidates.map(async (id) => {
        const port = await workerFor(id);
        const upstream = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
          method: 'POST',
          headers: { ...headersFor(request), 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(8000),
        });
        if (upstream.status === 401) return null;
        if (!upstream.ok) throw new Error('Workspace login failed.');
        const { user } = await upstream.json();
        const cookies = upstream.headers.getSetCookie();
        if (user?.workspace?.id !== id || cookies.length !== 1) throw new Error('Invalid workspace session.');
        return { id, user, cookie: cookies[0] };
      }));
      const verified = logins.filter(Boolean);
      if (!verified.length) return send(401, { message: 'Invalid credentials.' });
      return send(200, {
        user: verified[0].user,
        activeWorkspace: verified[0].id === primary ? null : verified[0].id,
        workspaces: verified.map(({ id }) => id === primary ? 'directory' : id),
      }, verified.map(({ cookie }) => cookie));
    } catch {
      if (!response.destroyed) send(503, { message: 'Sign-in is temporarily unavailable.' });
    }
  };
}

module.exports = { LOGIN_PATH, createWorkspaceLogin };
