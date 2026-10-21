import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createGalleryServer } from "../local-server.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlSAAAAAASUVORK5CYII=", "base64");
let server, root, base, viewer, admin;
async function call(url, { cookie, body, method = "GET", origin = base, headers = {} } = {}) {
  return fetch(base + url, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== "GET" && method !== "HEAD" ? { Origin: origin } : {}), ...headers }, body });
}
async function login(adminLogin = false) {
  const result = await call(adminLogin ? "/api/admin/login" : "/api/login", {
    cookie: viewer, method: "POST", body: JSON.stringify({ password: adminLogin ? "owner-test" : "viewer-test" }),
  });
  assert.equal(result.status, 200);
  return result.headers.get("set-cookie").split(";")[0];
}
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "sp24-api-"));
  const directory = path.join(root, "events", "sample");
  await mkdir(path.join(directory, "photos"), { recursive: true });
  await mkdir(path.join(directory, "videos"), { recursive: true });
  await writeFile(path.join(root, "events/index.json"), JSON.stringify({ events: [{ id: "sample", title: "Spotkanie 2007", date: "2007-03-31" }] }));
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ items: [{ name: "test.png", originalName: "Zdjęcie żółte.png" }], videos: [{ name: "test.mp4" }] }));
  await writeFile(path.join(directory, "photos/test.png"), png);
  await writeFile(path.join(directory, "videos/test.mp4"), Buffer.alloc(100, 7));
  server = createGalleryServer({ mediaRoot: root, password: "viewer-test", adminPassword: "owner-test", secret: "test-session-secret-32-characters-long" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  viewer = await login();
  admin = await login(true);
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  if (root) await rm(root, { recursive: true, force: true });
});
test("media and APIs require server-side login", async () => {
  for (const url of ["/api/events", "/media/events/sample/photos/test.png", "/media/events/index.json"]) assert.equal((await call(url)).status, 401);
  const session = await call("/api/session");
  assert.equal((await session.json()).authenticated, false);
});
test("only approved branding assets are public and use the SVG content type", async () => {
  for (const url of ["/assets/archive-mark.svg", "/assets/archive-pattern.svg"]) {
    const response = await call(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/svg+xml");
    assert.match(await response.text(), /<svg /);
    const head = await call(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  }
  assert.notEqual((await call("/assets/unlisted.svg")).status, 200);
  assert.notEqual((await call("/_worker.js")).status, 200);
});
test("login sets an HttpOnly SameSite cookie and rejects tampering", async () => {
  const response = await call("/api/login", { method: "POST", body: JSON.stringify({ password: "viewer-test" }) });
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const result = await call("/api/events", { cookie: viewer + "broken" });
  assert.equal(result.status, 401);
});
test("decorative backgrounds are public WebP images, not private archive media", async () => {
  for (const url of ["/assets/archive-desktop.webp", "/assets/archive-mobile.webp"]) {
    const response = await call(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.ok(bytes.length < 200_000, "Background must stay lightweight");
  }
  assert.equal((await call("/media/events/sample/photos/test.png")).status, 401);
});
test("download uses attachment and preserves exact bytes and Polish filename", async () => {
  const response = await call("/media/events/sample/photos/test.png?download=1", { cookie: viewer });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /^attachment;/);
  assert.match(response.headers.get("content-disposition"), /filename\*=UTF-8''Zdj%C4%99cie/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
});
test("HEAD download returns metadata without a body", async () => {
  const response = await call("/media/events/sample/photos/test.png?download=1", { cookie: viewer, method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(png.length));
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});
test("only the organizer can create albums or upload", async () => {
  const response = await call("/api/admin/events", { cookie: viewer, method: "POST", body: JSON.stringify({ title: "No access" }) });
  assert.equal(response.status, 403);
});
test("cross-origin writes are rejected", async () => {
  const response = await call("/api/admin/events", { cookie: admin, method: "POST", origin: "https://untrusted.example", body: JSON.stringify({ title: "No access" }) });
  assert.equal(response.status, 403);
});
test("new albums get their own id and show immediately in catalog", async () => {
  const response = await call("/api/admin/events", { cookie: admin, method: "POST", body: JSON.stringify({ title: "Spotkanie 2026", date: "2026-06-20" }) });
  assert.equal(response.status, 201);
  const { event } = await response.json();
  assert.match(event.id, /^spotkanie-2026-/);
  const catalog = await (await call("/api/events", { cookie: viewer })).json();
  assert.equal(catalog.events.filter((entry) => entry.id === event.id).length, 1);
  const manifest = await (await call("/api/events/" + event.id, { cookie: viewer })).json();
  assert.deepEqual(manifest.items, []);
});
test("upload rejects disguised HTML", async () => {
  const response = await call("/api/admin/events/sample/photos/fake.jpg", { cookie: admin, method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: "<html>not a photo</html>" });
  assert.equal(response.status, 415);
});
test("simultaneous uploads and retries do not lose or duplicate photos", async () => {
  const files = [Buffer.concat([png, Buffer.from("one")]), Buffer.concat([png, Buffer.from("two")])];
  const responses = await Promise.all(files.map((file, index) => call("/api/admin/events/sample/photos/" + index + ".png", { cookie: admin, method: "PUT", body: file })));
  for (const response of responses) assert.equal(response.status, 201);
  assert.equal((await call("/api/admin/events/sample/photos/retry.png", { cookie: admin, method: "PUT", body: files[0] })).status, 201);
  const manifest = await (await call("/api/events/sample", { cookie: viewer })).json();
  assert.equal(manifest.items.length, 3);
});
test("video seeking uses correct byte ranges", async () => {
  const response = await call("/media/events/sample/videos/test.mp4", { cookie: viewer, headers: { Range: "bytes=10-19" } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 10-19/100");
  assert.equal((await response.arrayBuffer()).byteLength, 10);
  const invalid = await call("/media/events/sample/videos/test.mp4", { cookie: viewer, headers: { Range: "bytes=200-300" } });
  assert.equal(invalid.status, 416);
});
test("legacy sources and traversal are not served as assets", async () => {
  for (const url of ["/_worker.js", "/app-v2.js", "/media/events/sample/photos/%2e%2e%2fmanifest.json"]) assert.equal((await call(url, { cookie: viewer })).status, 404);
});
test("null login payload fails cleanly and logout expires the cookie", async () => {
  assert.equal((await call("/api/login", { method: "POST", body: "null" })).status, 401);
  const response = await call("/api/logout", { cookie: admin, method: "POST", body: "{}" });
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});
