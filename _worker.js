const COOKIE_NAME = "sp24_session";
const SESSION_SECONDS = 24 * 60 * 60;
const encoder = new TextEncoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(text) {
  const padded =
    text.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - text.length % 4) % 4);

  return Uint8Array.from(
    atob(padded),
    (char) => char.charCodeAt(0)
  );
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createSession(secret) {
  const expiry = String(
    Date.now() + SESSION_SECONDS * 1000
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(expiry)
  );

  return `${expiry}.${toBase64Url(new Uint8Array(signature))}`;
}

async function hasSession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";

  const entry = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  if (!entry) return false;

  const value = entry.slice(COOKIE_NAME.length + 1);
  const parts = value.split(".");

  if (parts.length !== 2 || !/^\d{13}$/.test(parts[0])) {
    return false;
  }

  if (Number(parts[0]) <= Date.now()) {
    return false;
  }

  try {
    const signature = fromBase64Url(parts[1]);
    if (signature.length !== 32) return false;

    return await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      signature,
      encoder.encode(parts[0])
    );
  } catch {
    return false;
  }
}

async function samePassword(candidate, expected) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);

  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;

  for (let i = 0; i < left.length; i++) {
    difference |= left[i] ^ right[i];
  }

  return difference === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const publicPaths = new Set([
        "/",
        "/index.html",
        "/styles.css",
        "/app.js",
        "/photos/P3311370.JPG"
    ]);

    if (
      publicPaths.has(path) &&
      ["GET", "HEAD"].includes(request.method)
    ) {
      return env.ASSETS.fetch(request);
    }

    // Bez skonfigurowanych sekretów zdjęcia pozostają zablokowane.
    if (!env.GALLERY_PASSWORD || !env.GALLERY_SESSION_SECRET) {
      return json(
        { error: "Gallery secrets are not configured" },
        503
      );
    }

    if (path.startsWith("/api/")) {
      if (path === "/api/session" && request.method === "GET") {
        const authenticated = await hasSession(
          request,
          env.GALLERY_SESSION_SECRET
        );

        return json(
          { authenticated },
          authenticated ? 200 : 401
        );
      }

      if (path === "/api/login" && request.method === "POST") {
        const origin = request.headers.get("Origin");

        if (origin && origin !== url.origin) {
          return json({ error: "Forbidden" }, 403);
        }

        if (
          Number(request.headers.get("Content-Length") || 0) > 1024
        ) {
          return json({ error: "Request too large" }, 413);
        }

        let data;

        try {
          const body = await request.text();

          if (body.length > 1024) {
            return json({ error: "Request too large" }, 413);
          }

          data = JSON.parse(body);
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        if (
          typeof data.password !== "string" ||
          !await samePassword(
            data.password,
            env.GALLERY_PASSWORD
          )
        ) {
          return json({ error: "Invalid password" }, 401);
        }

        const token = await createSession(
          env.GALLERY_SESSION_SECRET
        );

        return json(
          { authenticated: true },
          200,
          {
            "Set-Cookie":
              `${COOKIE_NAME}=${token}; Path=/; ` +
              `Max-Age=${SESSION_SECONDS}; ` +
              "HttpOnly; Secure; SameSite=Lax",
          }
        );
      }

      if (path === "/api/logout" && request.method === "POST") {
        const origin = request.headers.get("Origin");

        if (origin && origin !== url.origin) {
          return json({ error: "Forbidden" }, 403);
        }

        return json(
          { authenticated: false },
          200,
          {
            "Set-Cookie":
              `${COOKIE_NAME}=; Path=/; Max-Age=0; ` +
              "HttpOnly; Secure; SameSite=Lax",
          }
        );
      }

      return json({ error: "Not found" }, 404);
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response(
        "Method not allowed",
        { status: 405 }
      );
    }

    if (
      !await hasSession(
        request,
        env.GALLERY_SESSION_SECRET
      )
    ) {
      return new Response("Brak dostępu", {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("Cache-Control", "private, no-store");

    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};