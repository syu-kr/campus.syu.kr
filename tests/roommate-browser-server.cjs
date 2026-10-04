/* Test-only HTTP/React UI proof with an injected emulator session; no mailbox proof. */
const path = require("node:path");
const http = require("node:http");
const { randomBytes } = require("node:crypto");
const { createRequire } = require("node:module");

const PROJECT = "demo-syu-roommates";
const AUTH_HOST = "127.0.0.1:9098";
const FIRESTORE_HOST = "127.0.0.1:8188";
const PORT = 3031;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const localEnvironment = {
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
  FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
};
for (const [key, expected] of Object.entries(localEnvironment)) {
  if (process.env[key] && process.env[key] !== expected) throw new Error(`Browser tests require ${key}=${expected}`);
}
Object.assign(process.env, localEnvironment, {
  NODE_ENV: "development",
  GOOGLE_CLOUD_PROJECT: PROJECT,
  GCLOUD_PROJECT: PROJECT,
  FIREBASE_SERVICE_ACCOUNT: "",
  GOOGLE_APPLICATION_CREDENTIALS: "",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000:web:local-roommate-browser",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`,
  NEXT_PUBLIC_SENTRY_DSN: "",
  SENTRY_AUTH_TOKEN: "",
  ROOMMATES_ENABLED: "true",
  ROOMMATES_WRITES_ENABLED: "true",
  ROOMMATES_EMAIL_ENABLED: "true",
  ROOMMATES_OWNER_KEY_SECRET: randomBytes(32).toString("hex"),
  RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  ADMIN_EMAILS: "local-admin@syuin.ac.kr",
  ADMIN_EMAIL: "",
  admin_email: "",
});

// Next's actual @next/env API returns no files before its dotenv loader can read them.
// A custom dev server also compiles public Firebase config from the demo values above.
// Intercept Next's own loader rather than introducing a standalone env dependency.
const nextRequire = createRequire(require.resolve("next/package.json"));
const envModulePath = nextRequire.resolve("@next/env");
const nextEnv = require(envModulePath);
let skippedEnvLoads = 0;
require.cache[envModulePath].exports = {
  ...nextEnv,
  loadEnvConfig() { skippedEnvLoads++; return { combinedEnv: process.env, parsedEnv: {}, loadedEnvFiles: [] }; },
  processEnv() { return [process.env, {}]; },
  resetEnv() {},
  updateInitialEnv() {},
};

const nativeFetch = globalThis.fetch;
let blockedExternalFetches = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://identitytoolkit.googleapis.com" && url.pathname === "/v1/accounts:sendOobCode" && url.searchParams.get("key") === "demo-api-key") {
    url.protocol = "http:";
    url.host = AUTH_HOST;
    url.pathname = `/identitytoolkit.googleapis.com${url.pathname}`;
    return nativeFetch(url, init);
  }
  if (url.protocol === "http:" && [AUTH_HOST, FIRESTORE_HOST, `127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(url.host)) return nativeFetch(input, init);
  blockedExternalFetches++;
  throw new Error("External fetch is forbidden in the roommate browser test server.");
};

const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
if (getApps().length) throw new Error("Browser tests require a fresh Admin process.");
initializeApp({ projectId: PROJECT });

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 2048) throw new Error("Test login request is too large.");
  }
  return new URLSearchParams(body);
}

async function injectTestSession(request, response) {
  if (request.headers.origin !== ORIGIN) throw new Error(`Test login requires the local origin (received ${request.headers.origin ?? "missing"}).`);
  const body = await readBody(request);
  const email = body.get("email");
  if (!["student-a@syuin.ac.kr", "student-b@syuin.ac.kr"].includes(email)) throw new Error("Only synthetic student emails are allowed.");
  const link = await getAuth().generateSignInWithEmailLink(email, { url: `${ORIGIN}/campus/roommates/verify/finish`, handleCodeInApp: true });
  const oobCode = new URL(link).searchParams.get("oobCode");
  const signedIn = await globalThis.fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=demo-api-key`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, oobCode }),
  });
  if (!signedIn.ok) throw new Error("Local Auth email-link consumption failed.");
  const { idToken } = await signedIn.json();
  const issued = await globalThis.fetch(`${ORIGIN}/api/roommates/auth/session`, {
    method: "POST", headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ idToken, remember: body.get("remember") === "true" }),
  });
  if (!issued.ok || !issued.headers.get("set-cookie")) throw new Error("The actual Next session API rejected the emulator token.");
  response.writeHead(303, { "set-cookie": issued.headers.get("set-cookie"), location: "/campus/roommates" });
  response.end();
}

const next = require("next");
const nextConfig = require("../next.config.js");
// The custom dev router reloads next.config.js instead of forwarding the conf option.
// Update this process's cached export so both loaders use the same isolated settings.
Object.assign(nextConfig, { allowedDevOrigins: ["127.0.0.1"], distDir: ".next/roommate-browser" });
// NextRequest normalizes loopback IPs to localhost, including locale rewrites.
const app = next({ dev: true, dir: path.resolve(__dirname, ".."), hostname: "localhost", port: PORT, conf: nextConfig });
const handle = app.getRequestHandler();

async function start() {
  await app.prepare();
  const server = http.createServer(async (request, response) => {
    try {
      if (![`127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(request.headers.host)) { response.writeHead(403); response.end(); return; }
      if (request.url === "/_roommate_test" || request.url === "/_roommate_test/login" || request.url === "/_roommate_test/status") {
        response.setHeader("cache-control", "private, no-store");
        response.setHeader("x-robots-tag", "noindex, nofollow");
        response.setHeader("referrer-policy", "same-origin");
        if (request.url === "/_roommate_test/login" && request.method === "POST") return await injectTestSession(request, response);
        if (request.url === "/_roommate_test/status") {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ projectId: PROJECT, authHost: AUTH_HOST, firestoreHost: FIRESTORE_HOST, skippedEnvLoads, blockedExternalFetches, externalFetchesSent: 0 }));
          return;
        }
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(`<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width, initial-scale=1"><title>로컬 룸메이트 UI 시험</title><body style="font:16px system-ui;max-width:600px;margin:40px auto;padding:20px"><h1>로컬 룸메이트 UI 시험</h1><p>demo-syu-roommates 에뮬레이터의 인증 상태를 테스트 도구로 발급합니다. 실제 메일 수신·링크 로그인 시험과 구분합니다.</p><form method="post" action="/_roommate_test/login"><p><label>가상 학생 <select name="email"><option>student-a@syuin.ac.kr</option><option>student-b@syuin.ac.kr</option></select></label></p><p><label><input type="checkbox" name="remember" value="true" checked> 30일 유지</label></p><button type="submit">테스트 세션으로 게시판 열기</button></form><p><a href="/campus/roommates/verify">비인증 화면 열기</a> · <a href="/_roommate_test/status">서버 격리 상태</a></p></body></html>`);
        return;
      }
      await handle(request, response);
    } catch (error) {
      console.error("[Roommate browser test]", error instanceof Error ? error.message : "Request failed");
      if (!response.headersSent) response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      response.end("Local browser test request failed.");
    }
  });
  server.on("upgrade", app.getUpgradeHandler());
  server.listen(PORT, "127.0.0.1", () => console.log(`Roommate UI test: ${ORIGIN}/_roommate_test (demo emulators only; mailbox proof excluded)`));
}

start().catch(() => { console.error("Local roommate browser test server failed to start."); process.exitCode = 1; });
