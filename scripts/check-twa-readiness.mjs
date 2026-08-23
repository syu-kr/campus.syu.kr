import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const PACKAGE_NAME = "kr.syukr.campus";
const FINGERPRINT_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const DEBUG_FINGERPRINT =
  "1C:D2:A5:CC:E3:37:F9:CE:60:79:51:F9:7A:2D:48:CD:03:6D:64:6D:BA:71:A2:63:AE:67:D1:57:D1:93:80:BA";
const releaseMode = process.argv.includes("--release");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readPngSize(src) {
  const filePath = path.join(PUBLIC_DIR, src.replace(/^\//, ""));
  const buffer = await readFile(filePath);
  const pngSignature = "89504e470d0a1a0a";

  assert(
    buffer.subarray(0, 8).toString("hex") === pngSignature,
    `${src} 파일이 PNG 형식이 아닙니다.`,
  );

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function findIcon(icons, size, purpose) {
  return icons.find(
    (icon) => icon.sizes === `${size}x${size}` && icon.purpose === purpose,
  );
}

async function verifyIcon(icons, size, purpose) {
  const icon = findIcon(icons, size, purpose);
  assert(icon, `${size}px ${purpose} 아이콘이 manifest에 없습니다.`);
  assert(icon.type === "image/png", `${icon.src}의 MIME 형식이 PNG가 아닙니다.`);

  const actual = await readPngSize(icon.src);
  assert(
    actual.width === size && actual.height === size,
    `${icon.src} 해상도가 ${actual.width}x${actual.height}입니다.`,
  );
}

async function main() {
  const manifest = await readJson("public/manifest.json");
  const assetLinks = await readJson("public/.well-known/assetlinks.json");

  assert(manifest.id === "/", "manifest.id는 / 이어야 합니다.");
  assert(manifest.start_url === "/", "manifest.start_url은 / 이어야 합니다.");
  assert(manifest.scope === "/", "manifest.scope는 / 이어야 합니다.");
  assert(manifest.display === "standalone", "manifest.display는 standalone이어야 합니다.");
  assert(manifest.lang === "ko", "manifest.lang은 ko여야 합니다.");

  await verifyIcon(manifest.icons, 192, "any");
  await verifyIcon(manifest.icons, 512, "any");
  await verifyIcon(manifest.icons, 512, "maskable");
  await verifyIcon(manifest.icons, 512, "monochrome");

  assert(Array.isArray(assetLinks), "assetlinks.json은 배열이어야 합니다.");
  const androidTarget = assetLinks.find(
    (entry) =>
      entry?.target?.namespace === "android_app" &&
      entry.target.package_name === PACKAGE_NAME &&
      entry.relation?.includes("delegate_permission/common.handle_all_urls"),
  );

  assert(androidTarget, `${PACKAGE_NAME} Digital Asset Links 항목이 없습니다.`);
  assert(
    androidTarget.target.sha256_cert_fingerprints?.length > 0,
    "Android 인증서 SHA-256 지문이 없습니다.",
  );
  for (const fingerprint of androidTarget.target.sha256_cert_fingerprints) {
    assert(
      FINGERPRINT_PATTERN.test(fingerprint),
      `올바르지 않은 SHA-256 지문입니다: ${fingerprint}`,
    );
  }

  if (releaseMode) {
    assert(
      !androidTarget.target.sha256_cert_fingerprints.includes(DEBUG_FINGERPRINT),
      "출시용 assetlinks.json에 Android 디버그 인증서 지문이 남아 있습니다.",
    );
  }

  console.log(
    `[check:twa] manifest, icons, Digital Asset Links verified${releaseMode ? " for release" : ""}`,
  );
}

main().catch((error) => {
  console.error(`[check:twa] ${error.message}`);
  process.exitCode = 1;
});
