const encoder = new TextEncoder();
const COOKIE = "sp24_archive";
const SESSION_AGE = 12 * 60 * 60;
const EVENT_ID = /^[a-z0-9][a-z0-9-]{0,100}$/;
const PUBLIC = new Set(["/", "/index.html", "/app.js", "/styles.css", "/vendor/lucide.min.js", "/assets/archive-mark.svg", "/assets/archive-pattern.svg", "/assets/archive-desktop.webp", "/assets/archive-mobile.webp"]);
const failures = new Map();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
});
const encode64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const decode64 = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
async function key(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function token(secret, role) {
  const payload = encode64(encoder.encode(JSON.stringify({ role, expires: Date.now() + SESSION_AGE * 1000 })));
  return payload + "." + encode64(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload))));
}
async function session(request, secret) {
  const value = (request.headers.get("Cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!value || !secret || value.length > 1000) return null;
  try {
    const [payload, signature] = value.split(".");
    if (!await crypto.subtle.verify("HMAC", await key(secret), decode64(signature), encoder.encode(payload))) return null;
    const result = JSON.parse(new TextDecoder().decode(decode64(payload)));
    return result.expires > Date.now() && ["viewer", "admin"].includes(result.role) ? result : null;
  } catch { return null; }
}
async function equal(left, right) {
  const hashes = await Promise.all([left, right].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  return new Uint8Array(hashes[0]).reduce((diff, byte, index) => diff | (byte ^ new Uint8Array(hashes[1])[index]), 0) === 0;
}
function cookie(request, env, value, age = SESSION_AGE) {
  const local = env.LOCAL_DEVELOPMENT === true && new URL(request.url).protocol === "http:";
  return COOKIE + "=" + value + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + age + (local ? "" : "; Secure");
}
async function readBody(request, limit) {
  if (Number(request.headers.get("Content-Length")) > limit) throw new HttpError(413, "Plik jest za duży. Maksymalny rozmiar zdjęcia to 20 MB.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new HttpError(413, "Przekroczono dozwolony rozmiar danych.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function bodyJson(request) {
  try { return JSON.parse(new TextDecoder().decode(await readBody(request, 4096))); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Nieprawidłowe dane formularza."); }
}
async function readJson(bucket, name, fallback = null) {
  const object = await bucket.get(name);
  if (!object) return fallback;
  return JSON.parse((await object.text()).replace(/^\uFEFF/, ""));
}
// Conditional writes prevent concurrent uploads from replacing one another's manifest entries.
async function updateJson(bucket, name, fallback, transform) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const previous = await bucket.get(name);
    const data = previous ? JSON.parse((await previous.text()).replace(/^\uFEFF/, "")) : structuredClone(fallback);
    const result = transform(data);
    const saved = await bucket.put(name, JSON.stringify(result), {
      onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    if (saved) return result;
  }
  throw new HttpError(409, "Album jest teraz aktualizowany. Spróbuj ponownie.");
}
function cleanName(value) {
  if (!value || value.length > 180 || /[\u0000-\u001f\u007f/\\]/.test(value) || value === "." || value === "..") {
    throw new HttpError(400, "Nieprawidłowa nazwa pliku.");
  }
  return value;
}
function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ["image/jpeg", "jpg"];
  if ([137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte)) return ["image/png", "png"];
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (text.startsWith("RIFF") && text.slice(8) === "WEBP") return ["image/webp", "webp"];
  throw new HttpError(415, "Wybierz zdjęcia JPG, PNG lub WebP.");
}
function disposition(name) {
  const plain = name.replace(/[^\x20-\x7e]|["\\;]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
  return 'attachment; filename="' + plain + '"; filename*=UTF-8' + "''" + encoded;
}
function safeResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, headers });
}
async function login(request, env, admin, current) {
  if (admin && !current) throw new HttpError(401, "Najpierw otwórz archiwum.");
  const expected = admin ? env.GALLERY_ADMIN_TOKEN : env.GALLERY_PASSWORD;
  if (!expected) throw new HttpError(503, "Dodawanie zdjęć nie zostało jeszcze skonfigurowane.");
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const limitKey = ip + (admin ? ":admin" : ":viewer");
  const record = failures.get(limitKey);
  if (record && record.until > Date.now() && record.count >= 8) throw new HttpError(429, "Za dużo prób. Spróbuj ponownie za 10 minut.");
  if (env.AUTH_LIMITER && !(await env.AUTH_LIMITER.limit({ key: limitKey })).success) throw new HttpError(429, "Za dużo prób. Spróbuj ponownie później.");
  const data = await bodyJson(request);
  if (typeof data?.password !== "string" || !await equal(data.password, expected)) {
    if (failures.size > 2000) for (const [k, v] of failures) if (v.until <= Date.now()) failures.delete(k);
    failures.set(limitKey, { count: record?.until > Date.now() ? record.count + 1 : 1, until: Date.now() + 600000 });
    throw new HttpError(401, admin ? "Nieprawidłowe hasło organizatora." : "Nieprawidłowe hasło do archiwum.");
  }
  failures.delete(limitKey);
  const role = admin ? "admin" : "viewer";
  return json({ authenticated: true, admin }, 200, { "Set-Cookie": cookie(request, env, await token(env.GALLERY_SESSION_SECRET, role)) });
}
async function route(request, env) {
  const url = new URL(request.url);
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, "Nieprawidłowy adres."); }
  const read = ["GET", "HEAD"].includes(request.method);
  if (!read && request.headers.get("Origin") !== url.origin) throw new HttpError(403, "Niedozwolone źródło żądania.");
  if (read && PUBLIC.has(path)) return env.ASSETS.fetch(request);
  if (!env.GALLERY_PASSWORD || !env.GALLERY_SESSION_SECRET) throw new HttpError(503, "Archiwum wymaga konfiguracji serwera.");
  const current = await session(request, env.GALLERY_SESSION_SECRET);
  if (path === "/api/session" && request.method === "GET") return json({ authenticated: !!current, admin: current?.role === "admin" });
  if (path === "/api/login" && request.method === "POST") return login(request, env, false, current);
  if (path === "/api/logout" && request.method === "POST") return json({ authenticated: false }, 200, { "Set-Cookie": cookie(request, env, "", 0) });
  if (!current) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  if (path === "/api/admin/login" && request.method === "POST") return login(request, env, true, current);
  if (!env.MEDIA) throw new HttpError(503, "Magazyn zdjęć nie jest jeszcze podłączony.");
  if (path.startsWith("/api/admin/") && current.role !== "admin") throw new HttpError(403, "Podaj hasło organizatora, aby dodać zdjęcia.");
  if (path === "/api/events" && request.method === "GET") {
    return json(await readJson(env.MEDIA, "events/index.json", { events: [] }));
  }
  const eventMatch = path.match(/^\/api\/events\/([a-z0-9-]+)$/);
  if (eventMatch && request.method === "GET") {
    const manifest = await readJson(env.MEDIA, "events/" + eventMatch[1] + "/manifest.json");
    if (!manifest) throw new HttpError(404, "Nie znaleziono albumu.");
    return json(manifest);
  }
  if (path === "/api/admin/events" && request.method === "POST") {
    const data = await bodyJson(request);
    if (typeof data?.title !== "string" || !data.title.trim() || data.title.length > 100 ||
        (data.date && (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(Date.parse(data.date))))) {
      throw new HttpError(400, "Podaj nazwę spotkania i poprawną datę.");
    }
    const slug = data.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65);
    const id = (slug || "spotkanie") + "-" + crypto.randomUUID().slice(0, 8);
    const event = { id, title: data.title.trim(), date: data.date || "", location: "", description: "" };
    await env.MEDIA.put("events/" + id + "/manifest.json", JSON.stringify({ ...event, items: [], videos: [] }), { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "application/json" } });
    await updateJson(env.MEDIA, "events/index.json", { events: [] }, (catalog) => ({ events: [event, ...catalog.events] }));
    return json({ event }, 201);
  }
  const upload = path.match(/^\/api\/admin\/events\/([a-z0-9-]+)\/photos\/([^/]+)$/);
  if (upload && request.method === "PUT") {
    const [, id, originalName] = upload;
    cleanName(originalName);
    if (!EVENT_ID.test(id)) throw new HttpError(400, "Nieprawidłowy album.");
    const manifestKey = "events/" + id + "/manifest.json";
    if (!await env.MEDIA.head(manifestKey)) throw new HttpError(404, "Nie znaleziono albumu.");
    const bytes = await readBody(request, 20 * 1024 * 1024);
    const [contentType, extension] = imageType(bytes);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const name = hash + "." + extension;
    await env.MEDIA.put("events/" + id + "/photos/" + name, bytes, { httpMetadata: { contentType } });
    await updateJson(env.MEDIA, manifestKey, null, (manifest) => {
      if (!manifest) throw new HttpError(404, "Nie znaleziono albumu.");
      if (!manifest.items.some((item) => item.name === name)) manifest.items.push({ name, originalName, size: bytes.length });
      return manifest;
    });
    return json({ uploaded: name, originalName }, 201);
  }
  const media = path.match(/^\/media\/events\/([a-z0-9-]+)\/(photos|videos)\/([^/]+)$/);
  if (media && read) {
    const [, id, kind, name] = media;
    cleanName(name);
    const manifest = await readJson(env.MEDIA, "events/" + id + "/manifest.json");
    const item = (kind === "photos" ? manifest?.items : manifest?.videos)?.find((entry) => (typeof entry === "string" ? entry : entry.name) === name);
    if (!item) throw new HttpError(404, "Nie znaleziono pliku w albumie.");
    const keyName = "events/" + id + "/" + kind + "/" + name;
    const meta = await env.MEDIA.head(keyName);
    if (!meta) throw new HttpError(404, "Plik nie jest dostępny.");
    const headers = new Headers({ "Accept-Ranges": "bytes", "Content-Length": String(meta.size) });
    meta.writeHttpMetadata(headers);
    if (!headers.has("Content-Type")) headers.set("Content-Type", kind === "videos" ? "video/mp4" : /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : "image/jpeg");
    if (url.searchParams.get("download") === "1") headers.set("Content-Disposition", disposition(item.originalName || name));
    let range;
    const rawRange = request.headers.get("Range");
    if (rawRange) {
      const match = rawRange.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + meta.size } });
      const offset = match[1] ? Number(match[1]) : Math.max(0, meta.size - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), meta.size - 1) : meta.size - 1;
      if (offset > end || offset >= meta.size) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + meta.size } });
      range = { offset, length: end - offset + 1 };
      headers.set("Content-Range", "bytes " + offset + "-" + end + "/" + meta.size);
      headers.set("Content-Length", String(range.length));
    }
    const object = request.method === "HEAD" ? null : await env.MEDIA.get(keyName, range ? { range } : undefined);
    return new Response(object?.body || null, { status: range ? 206 : 200, headers });
  }
  throw new HttpError(404, "Nie znaleziono strony.");
}
export default {
  async fetch(request, env) {
    try { return safeResponse(await route(request, env)); }
    catch (error) {
      if (!(error instanceof HttpError)) console.error("Gallery request failed:", error.message);
      return safeResponse(json({ error: error instanceof HttpError ? error.message : "Nie udało się wykonać operacji. Spróbuj ponownie." }, error.status || 500));
    }
  },
};
