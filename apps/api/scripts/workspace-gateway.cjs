const { fork } = require('node:child_process');
const http = require('node:http');
const { isIP } = require('node:net');
const path = require('node:path');
const secrets = require('./workspace-secrets.cjs');

const PRIMARY = 'winners-chapel-international';
const PREFIX = '/api/w/';
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLIENT_IP_HEADER = 'x-chuflow-client-ip';

function upstreamHeaders(request, isRender) {
  const headers = { ...request.headers };
  const edgeIp = headers['cf-connecting-ip'];
  const ip = isRender && typeof edgeIp === 'string' && isIP(edgeIp)
    ? edgeIp
    : request.socket.remoteAddress;
  delete headers[CLIENT_IP_HEADER];
  if (ip && isIP(ip)) headers[CLIENT_IP_HEADER] = ip;
  return headers;
}
const sharedEnvironment = [
  'PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'NODE_ENV', 'NODE_PATH',
  'WEB_URL', 'CORS_ALLOWED_ORIGINS', 'COOKIE_SECURE', 'COOKIE_SAME_SITE',
  'RENDER_GIT_COMMIT', 'WORKSPACE_DIRECTORY_VERIFICATION_KEY', 'CONTROL_DATABASE_NAME',
  // Password recovery mail for every workspace goes out through the platform's own sender until
  // per-tenant mail settings exist. The provider key never reaches the web app.
  'APP_NAME', 'MAIL_PROVIDER', 'RELYKIT_API_KEY', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_SECURE',
  'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM',
];
const REGISTRY_REFRESH_MS = 30000;

function databaseLocation(uri) {
  try {
    const url = new URL(uri);
    const name = decodeURIComponent(url.pathname.slice(1));
    if (['mongodb:', 'mongodb+srv:'].includes(url.protocol) && url.hostname && /^[\w-]+$/.test(name)) {
      return { host: url.host, name };
    }
  } catch {
    // URL parser errors may contain the MongoDB password.
  }
  throw new Error('Every workspace requires an explicit MongoDB database.');
}

function parseRegistryEnvironment(env) {
  let entries;
  try {
    entries = JSON.parse(env.CHUFLOW_WORKSPACE_REGISTRY || '[]');
  } catch {
    throw new Error('The workspace registry must be a JSON array.');
  }
  if (!Array.isArray(entries)) throw new Error('The workspace registry must be a JSON array.');
  return entries;
}

/**
 * Workspaces from the control database, where the site admin provisions them. Secrets are
 * sealed at rest; only the gateway opens them, to hand each worker its own key and first admin.
 */
function registryFromRecords(records, env) {
  const key = env.CONTROL_ENCRYPTION_KEY;
  return records
    .filter((record) => record && typeof record._id === 'string' && ['active', 'suspended'].includes(record.status))
    .map((record) => ({
      id: record._id,
      name: record.name,
      databaseName: record.databaseName,
      jwtSecret: secrets.open(record.jwtSecret, key),
      adminEmail: record.adminEmail,
      adminPassword: secrets.open(record.adminPassword, key),
      status: record.status,
    }));
}

/** Validates the environment registry plus any entries from the control database. */
function readRegistry(env, extraEntries = []) {
  const primary = databaseLocation(env.MONGODB_URI);
  const entries = [...parseRegistryEnvironment(env), ...extraEntries];

  const workspaces = new Map();
  const databases = new Set([primary.name.toLowerCase(), 'admin', 'config', 'local']);
  if (env.CONTROL_DATABASE_NAME) {
    const controlDatabase = env.CONTROL_DATABASE_NAME.toLowerCase();
    if (databases.has(controlDatabase)) {
      throw new Error('The control database must be separate from workspace and system databases.');
    }
    databases.add(controlDatabase);
  }
  const keys = new Set([env.JWT_SECRET]);
  for (const entry of entries) {
    if (
      typeof entry?.id !== 'string' || entry.id.length > 64 || !slug.test(entry.id) ||
      entry.id === PRIMARY || workspaces.has(entry.id) ||
      typeof entry.name !== 'string' || !entry.name.trim() ||
      typeof entry.jwtSecret !== 'string' || entry.jwtSecret.length < 32 || keys.has(entry.jwtSecret) ||
      typeof entry.adminEmail !== 'string' ||
      typeof entry.adminPassword !== 'string' || entry.adminPassword.length < 12
    ) throw new Error('A workspace registry entry is invalid or duplicated.');

    const shared = entry.databaseName !== undefined;
    if (shared && (entry.mongodbUri !== undefined ||
        typeof entry.databaseName !== 'string' || !/^[\w-]{1,63}$/.test(entry.databaseName))) {
      throw new Error('A workspace needs either a separate URI or a valid database name.');
    }
    const location = shared
      ? { host: primary.host, name: entry.databaseName }
      : databaseLocation(entry.mongodbUri);
    const databaseKey = location.name.toLowerCase();
    if (location.host !== primary.host || databases.has(databaseKey)) {
      throw new Error('Each workspace needs a distinct database on the approved MongoDB cluster.');
    }
    databases.add(databaseKey);
    keys.add(entry.jwtSecret);
    const status = entry.status === 'suspended' ? 'suspended' : 'active';
    workspaces.set(entry.id, { ...entry, status, mongodbUri: shared ? env.MONGODB_URI : entry.mongodbUri });
  }
  return workspaces;
}

/** Reads provisioned workspaces from the control database when one is configured. */
async function loadRegistry(env, client) {
  if (!env.CONTROL_DATABASE_NAME) return readRegistry(env);
  const { MongoClient } = require('mongoose').mongo;
  const owned = !client;
  const connection = client || new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  try {
    const records = await connection.db(env.CONTROL_DATABASE_NAME).collection('workspaces')
      .find({ status: { $in: ['active', 'suspended'] } }).toArray();
    return readRegistry(env, registryFromRecords(records, env));
  } finally {
    if (owned) await connection.close();
  }
}

function routeWorkspace(rawUrl) {
  const [pathname] = rawUrl.split('?', 1);
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /%(?:2e|2f|5c|25)|\\/i.test(pathname) ||
      pathname.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  if (pathname !== '/api/w' && !pathname.startsWith(PREFIX)) {
    return { id: PRIMARY, path: rawUrl };
  }

  const scoped = pathname.slice(PREFIX.length);
  const delimiter = scoped.indexOf('/');
  if (delimiter < 1) return null;
  const id = scoped.slice(0, delimiter);
  const tail = scoped.slice(delimiter);
  if (id.length > 64 || !slug.test(id) || tail === '/' || tail.includes('//')) return null;
  return { id, path: '/api' + tail + rawUrl.slice(pathname.length) };
}

function cookieName(env, id) {
  return id === PRIMARY ? env.AUTH_COOKIE_NAME || 'cms_access_token' : 'cms_workspace_' + id;
}

function workerEnvironment(env, entry) {
  const binding = { PORT: '0', API_BIND_HOST: '127.0.0.1' };
  if (!entry) {
    const { CHUFLOW_WORKSPACE_REGISTRY, ...primary } = env;
    return { ...primary, ...binding, WORKSPACE_ID: PRIMARY };
  }

  return {
    ...Object.fromEntries(sharedEnvironment.filter((key) => env[key] !== undefined).map((key) => [key, env[key]])),
    ...binding,
    WORKSPACE_ID: entry.id,
    WORKSPACE_NAME: entry.name,
    MONGODB_URI: entry.mongodbUri,
    ...(entry.databaseName ? { WORKSPACE_DATABASE_NAME: entry.databaseName } : {}),
    JWT_SECRET: entry.jwtSecret,
    ADMIN_EMAIL: entry.adminEmail,
    ADMIN_PASSWORD: entry.adminPassword,
    AUTH_COOKIE_NAME: cookieName(env, entry.id),
  };
}

function start(env = process.env) {
  const registry = { entries: readRegistry(env) };
  const workers = new Map();
  let closing = false;
  let control = null;

  // The control database is the source of truth once configured: new workspaces appear and
  // suspended or archived ones stop being served within one refresh, no restart needed.
  if (env.CONTROL_DATABASE_NAME) {
    const { MongoClient } = require('mongoose').mongo;
    control = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const refresh = async () => {
      try {
        registry.entries = await loadRegistry(env, control);
        for (const [id, state] of workers) {
          if (id !== PRIMARY && !registry.entries.has(id)) {
            workers.delete(id);
            state.child.kill();
          }
        }
      } catch (error) {
        console.error('Workspace registry refresh failed:', error instanceof Error ? error.message : error);
      }
    };
    registry.ready = refresh();
    registry.timer = setInterval(() => { if (!closing) void refresh(); }, REGISTRY_REFRESH_MS);
    registry.timer.unref();
  }

  function workerFor(id) {
    const current = workers.get(id);
    if (current) return current.ready;
    const child = fork(path.join(__dirname, '..', 'dist', 'main.js'), [], {
      env: workerEnvironment({
        ...env,
        CHUFLOW_RESERVED_WORKSPACE_HANDLES: [...registry.entries.keys()].join(','),
      }, registry.entries.get(id)),
      execArgv: [],
      windowsHide: true,
    });
    const state = { child };
    state.ready = new Promise((resolve, reject) => {
      function failed() {
        clearTimeout(timeout);
        if (workers.get(id) === state) workers.delete(id);
        reject(new Error('Workspace API unavailable.'));
      }
      const timeout = setTimeout(() => {
        child.kill();
        failed();
      }, 30000);
      child.on('error', failed);
      child.on('exit', failed);
      child.on('message', (message) => {
        if (message?.type === 'workspace-ready' && Number.isInteger(message.port) && message.port > 0 && message.port <= 65535) {
          clearTimeout(timeout);
          resolve(message.port);
        }
      });
    });
    workers.set(id, state);
    return state.ready;
  }

  const server = http.createServer(async (request, response) => {
    const route = routeWorkspace(request.url);
    if (registry.ready) await registry.ready;
    const entry = route && route.id !== PRIMARY ? registry.entries.get(route.id) : null;
    if (!route || (route.id !== PRIMARY && !entry)) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end('{"message":"Workspace not found."}');
      return;
    }
    if (entry && entry.status === 'suspended') {
      response.writeHead(402, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"code":"workspace_suspended","message":"This workspace is suspended. Contact ChuFlow support."}');
      return;
    }

    try {
      const port = await workerFor(route.id);
      if (request.aborted || response.destroyed || closing) return;
      const headers = upstreamHeaders(request, Boolean(env.RENDER_GIT_COMMIT));
      if (headers.cookie) {
        const name = cookieName(env, route.id);
        headers.cookie = headers.cookie.split(';')
          .filter((cookie) => cookie.trimStart().startsWith(name + '='))
          .join(';');
      }
      const upstream = http.request({ host: '127.0.0.1', port, path: route.path, method: request.method, headers }, (result) => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      });
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(503);
        response.end();
      });
      request.on('aborted', () => upstream.destroy());
      response.on('close', () => upstream.destroy());
      request.pipe(upstream);
    } catch {
      if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end('{"message":"Workspace API unavailable."}');
    }
  });

  const close = () => {
    closing = true;
    server.close();
    if (registry.timer) clearInterval(registry.timer);
    if (control) void control.close().catch(() => undefined);
    for (const { child } of workers.values()) child.kill();
  };
  server.listen(Number(env.PORT || 10000), env.API_BIND_HOST || '0.0.0.0');
  return { server, close };
}

if (require.main === module) {
  const { close } = start();
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}

module.exports = { routeWorkspace, readRegistry, registryFromRecords, loadRegistry, start, upstreamHeaders, workerEnvironment };
