import http from "node:http";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./deploy/_worker.js";
import { LocalStorage } from "./server/local-storage.mjs";

const project = path.dirname(fileURLToPath(import.meta.url));
export function createGalleryServer(options = {}) {
  const assets = new LocalStorage(path.join(project, "deploy"));
  const env = {
    MEDIA: new LocalStorage(options.mediaRoot || process.env.GALLERY_MEDIA_ROOT || path.join(project, "media")),
    GALLERY_PASSWORD: options.password || process.env.GALLERY_PASSWORD || "SP24-2007",
    GALLERY_ADMIN_TOKEN: options.adminPassword || process.env.GALLERY_ADMIN_TOKEN || "organizator-lokalnie",
    GALLERY_SESSION_SECRET: options.secret || process.env.GALLERY_SESSION_SECRET || randomBytes(32).toString("hex"),
    LOCAL_DEVELOPMENT: true,
    ASSETS: { async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const object = await assets.get(pathname === "/" ? "index.html" : pathname.slice(1));
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    } },
  };
  return http.createServer(async (incoming, outgoing) => {
    try {
      const host = incoming.headers.host || "127.0.0.1";
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
        outgoing.writeHead(403).end("Invalid host"); return;
      }
      const init = { method: incoming.method, headers: incoming.headers };
      if (!["GET", "HEAD"].includes(incoming.method)) Object.assign(init, { body: Readable.toWeb(incoming), duplex: "half" });
      const response = await worker.fetch(new Request("http://" + host + incoming.url, init), env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const stream = Readable.fromWeb(response.body);
        stream.on("error", () => outgoing.destroy());
        outgoing.on("close", () => stream.destroy());
        stream.pipe(outgoing);
      } else outgoing.end();
    } catch (error) {
      if (!outgoing.headersSent) outgoing.writeHead(500);
      outgoing.end("Local server error");
      console.error(error.message);
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (existsSync(path.join(project, ".dev.vars")) && process.loadEnvFile) process.loadEnvFile(path.join(project, ".dev.vars"));
  const server = createGalleryServer();
  const preferred = Number(process.env.PORT || 8000);
  let port = preferred;
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT && port < preferred + 20) server.listen(++port, "127.0.0.1");
    else { console.error(error.message); process.exitCode = 1; }
  });
  server.on("listening", () => {
    const url = "http://127.0.0.1:" + port;
    console.log("Archiwum: " + url);
    if (process.argv.includes("--open") && process.platform === "win32") {
      const opener = spawn("powershell.exe", ["-NoProfile", "-Command", "Start-Process '" + url + "'"], { windowsHide: true, stdio: "ignore" });
      opener.on("error", () => console.log("Otworz adres podany powyzej w przegladarce."));
      opener.unref();
    }
  });
  server.listen(port, "127.0.0.1");
}
