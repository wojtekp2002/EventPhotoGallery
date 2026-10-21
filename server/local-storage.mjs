import { mkdir, readFile, writeFile, stat, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".json": "application/json; charset=utf-8", ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
export function mime(file) { return types[path.extname(file).toLowerCase()] || "application/octet-stream"; }
export function inside(root, key) {
  const filename = path.resolve(root, key);
  const relative = path.relative(path.resolve(root), filename);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid storage path");
  return filename;
}
export class LocalStorage {
  constructor(root) { this.root = root; this.locks = new Map(); }
  async head(key) {
    const filename = inside(this.root, key);
    let info;
    try { info = await stat(filename); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (!info.isFile()) return null;
    const etag = key.endsWith(".json") ? createHash("sha256").update(await readFile(filename)).digest("hex") : info.size + "-" + info.mtimeMs;
    return { key, size: info.size, etag, httpEtag: '"' + etag + '"', writeHttpMetadata: (headers) => headers.set("Content-Type", mime(filename)) };
  }
  async get(key, options = {}) {
    const meta = await this.head(key);
    if (!meta) return null;
    const filename = inside(this.root, key);
    const range = options.range;
    const stream = () => Readable.toWeb(createReadStream(filename, range ? { start: range.offset, end: range.offset + range.length - 1 } : {}));
    return { ...meta, get body() { return stream(); }, text: () => readFile(filename, "utf8") };
  }
  async put(key, value, options = {}) {
    const previous = this.locks.get(key) || Promise.resolve();
    let release;
    const lock = new Promise((resolve) => { release = resolve; });
    this.locks.set(key, lock);
    await previous;
    try {
      const current = await this.head(key);
      if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== current?.etag) return null;
      if (options.onlyIf?.etagDoesNotMatch === "*" && current) return null;
      const filename = inside(this.root, key);
      await mkdir(path.dirname(filename), { recursive: true });
      const temporary = filename + "." + randomUUID() + ".tmp";
      await writeFile(temporary, value);
      await rename(temporary, filename);
      return await this.head(key);
    } finally {
      release();
      if (this.locks.get(key) === lock) this.locks.delete(key);
    }
  }
}
