const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const root = path.join(__dirname, '..');
const site = new URL(process.env.RENDER_EXTERNAL_URL);
let database;
try {
  database = new URL(process.env.MONGODB_URI);
} catch {
  throw new Error('Test Church requires a valid MongoDB connection setting.');
}
if (
  site.protocol !== 'https:' ||
  database.protocol !== 'mongodb+srv:' ||
  database.hostname !== 'cluster0.iym7fbr.mongodb.net' ||
  database.pathname !== '/test_church' ||
  process.env.WORKSPACE_ID !== 'test-church'
) {
  throw new Error('Test Church requires its dedicated test_church database on the approved Atlas cluster.');
}

const apiPort = 4100;
const webPort = 3100;
const apiDirectory = path.join(root, 'apps', 'api');
const webDirectory = path.join(root, 'apps', 'web');
const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiDirectory,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(apiPort),
    WEB_URL: site.origin,
    COOKIE_DOMAIN: '',
    NODE_PATH: path.join(apiDirectory, 'node_modules'),
  },
});
const web = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(webPort)], {
  cwd: webDirectory,
  stdio: 'inherit',
  // Keep database and signing credentials out of the web process.
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: site.origin + '/api',
    NEXT_PUBLIC_CHUFLOW_WORKSPACE_NAME: 'Test Church',
    NEXT_PUBLIC_CHUFLOW_DIRECTORY_ORIGIN: process.env.NEXT_PUBLIC_CHUFLOW_DIRECTORY_ORIGIN,
  },
});

const frontendApi = /^\/api\/(?:exports|imports|workspace-session)(?:\/|$)/;
const gateway = http.createServer((request, response) => {
  const pathname = request.url.split('?', 1)[0];
  const port = pathname.startsWith('/api/') && !frontendApi.test(pathname) ? apiPort : webPort;
  const upstream = http.request({
    hostname: '127.0.0.1',
    port,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: site.host, 'x-forwarded-proto': 'https', 'x-forwarded-host': site.host },
  }, (result) => {
    response.writeHead(result.statusCode, result.headers);
    result.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502);
    response.end('Test Church is starting. Please try again shortly.');
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
});
gateway.listen(Number(process.env.PORT || 10000), '0.0.0.0');

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  gateway.close();
  api.kill();
  web.kill();
  process.exitCode = code;
}
for (const service of [api, web]) {
  service.on('exit', () => stop(1));
  service.on('error', () => stop(1));
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
