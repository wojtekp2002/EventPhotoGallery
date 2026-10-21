import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createGalleryServer } from "../local-server.js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
const screenshotRoot = path.resolve(".artifacts");
await mkdir(screenshotRoot, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "sp24-ui-"));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlSAAAAAASUVORK5CYII=", "base64");
await mkdir(path.join(temp, "events/test/photos"), { recursive: true });
await writeFile(path.join(temp, "events/index.json"), JSON.stringify({ events: [{ id: "test", title: "Spotkanie 2007", date: "2007-03-31" }] }));
await writeFile(path.join(temp, "events/test/manifest.json"), JSON.stringify({ items: [{ name: "test.png" }] }));
await writeFile(path.join(temp, "events/test/photos/test.png"), png);
const server = createGalleryServer({ mediaRoot: temp, password: "viewer-test", adminPassword: "owner-test" });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function overflow() {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const elements = [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().width && element.getBoundingClientRect().right > width + 1 && !element.closest(".albums,.sr-only")).map((element) => element.tagName + "." + element.className);
    return { scroll: document.documentElement.scrollWidth, width, elements };
  });
}
try {
  await page.goto(base);
  for (const [width, height] of [[1440,900],[768,1024],[390,844],[320,740]]) {
    await page.setViewportSize({ width, height });
    await page.locator(".school-mark").evaluate((image) => image.decode());
    await page.locator(".access-symbol").evaluate((image) => image.decode());
    const background = page.locator(".archive-backdrop img");
    await background.evaluate((image) => image.decode());
    assert.ok((await background.evaluate((image) => image.currentSrc)).endsWith(width <= 650 ? "archive-mobile.webp" : "archive-desktop.webp"));
    assert.ok((await overflow()).scroll <= width);
    const logo = await page.locator(".school-mark").boundingBox();
    assert.equal(logo.width, logo.height);
    await page.screenshot({ path: path.join(screenshotRoot, "login-" + width + ".png") });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".archive-backdrop").evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#access-password").fill("wrong-password");
  await page.locator("#access-submit").click();
  await page.waitForFunction(() => !document.querySelector("#access-error").hidden);
  await page.locator("#access-password").fill("viewer-test");
  await page.locator("#access-submit").click();
  await page.locator(".photo-preview").first().waitFor();
  assert.equal(await page.locator("#access-screen").isVisible(), false);
  assert.equal(await page.getByText("Ulubione", { exact: true }).count(), 0);
  assert.equal(await page.locator("#albums .album-symbol svg").count(), 1);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".photo-download").first().click()]);
  assert.equal(download.suggestedFilename(), "test.png");
  assert.deepEqual(await readFile(await download.path()), png);
  await page.locator("#browse").click();
  await page.locator("#lightbox[open]").waitFor();
  const [lightboxDownload] = await Promise.all([page.waitForEvent("download"), page.locator("#lightbox-download").click()]);
  assert.deepEqual(await readFile(await lightboxDownload.path()), png);
  await page.keyboard.press("Escape");
  await page.locator("#add-photos").click();
  await page.locator("#organizer-password").fill("owner-test");
  await page.locator("#organizer-form button").click();
  await page.locator("#upload-form").waitFor({ state: "visible" });
  await page.locator("#upload-album").selectOption("__new");
  await page.locator("#album-title").fill("Spotkanie 2026");
  await page.locator("#album-date").fill("2026-10-21");
  await page.locator("#file-input").setInputFiles({ name: "Zdjęcie.png", mimeType: "image/png", buffer: png });
  await page.locator("#upload-submit").click();
  await page.waitForFunction(() => document.querySelector("#upload-status").textContent.includes("Album jest już aktualny"));
  await page.locator("#upload-cancel").click();
  assert.equal(await page.locator("#collection-title").textContent(), "Spotkanie 2026");
  assert.equal(await page.locator(".photo-tile").count(), 1);
  await page.reload();
  await page.locator(".photo-tile").first().waitFor();
  await page.locator("#add-photos").click();
  assert.equal(await page.locator("#organizer-form").isVisible(), false);
  await page.locator("#file-input").setInputFiles({ name: "Drugie.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.from("second")]) });
  await page.locator("#upload-submit").click();
  await page.waitForFunction(() => document.querySelector("#upload-status").textContent.includes("Album jest już aktualny"));
  await page.locator("#upload-cancel").click();
  assert.equal(await page.locator(".photo-tile").count(), 2);
  await page.locator("#search").fill("niewystepujace");
  assert.equal(await page.locator(".photo-tile").count(), 0);
  assert.equal(await page.locator("#empty-title").textContent(), "Brak wyników wyszukiwania");
  await page.locator("#search").fill("");
  for (const [width, height] of [[1440,900],[768,1024],[390,844],[320,740]]) {
    await page.setViewportSize({ width, height });
    const result = await overflow();
    assert.ok(result.scroll <= result.width, JSON.stringify({ width, ...result }));
    const distortedIcons = await page.locator("svg").evaluateAll((icons) => icons.filter((icon) => {
      const { width, height } = icon.getBoundingClientRect();
      return width && height && Math.abs(width - height) > 0.5;
    }).map((icon) => icon.getAttribute("class")));
    assert.deepEqual(distortedIcons, [], "Icons must retain square proportions at " + width);
    await page.locator("#add-photos").click();
    const dialog = await page.locator("#upload-dialog").boundingBox();
    assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width + 1);
    await page.locator("#upload-album").selectOption("__new");
    const resultWithForm = await overflow();
    assert.ok(resultWithForm.scroll <= resultWithForm.width, JSON.stringify({ width, ...resultWithForm }));
    await page.screenshot({ path: path.join(screenshotRoot, "upload-" + width + ".png") });
    await page.locator("#upload-close").click();
  }
  await page.locator("#logout").click();
  await page.locator("#access-screen").waitFor({ state: "visible" });
  await page.reload();
  await page.locator("#access-screen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#gallery-app").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log("UI: login, two downloads with exact bytes, new/existing album upload, persistence, search, logout, 4 viewport checks PASS");
  if (process.env.PREVIEW_URL) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(process.env.PREVIEW_URL);
    await page.locator("#access-password").fill("SP24-2007");
    await page.locator("#access-submit").click();
    await page.locator(".photo-tile").first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll(".photo-preview img")].slice(0,8).every((image) => image.complete && image.naturalWidth > 0));
    for (const [width,height] of [[1440,1000],[390,844],[320,740]]) {
      await page.setViewportSize({ width,height });
      assert.ok((await overflow()).scroll <= width);
      await page.evaluate(async () => {
        await Promise.all([...document.querySelectorAll(".photo-preview img")].filter((image) => image.getBoundingClientRect().top < innerHeight).map((image) => image.decode()));
      });
      await page.screenshot({ path: path.join(screenshotRoot, "gallery-" + width + ".png"), fullPage: false });
    }
    await page.locator("#videos-tab").click();
    await page.waitForFunction(() => [...document.querySelectorAll("video")].length === 2 && [...document.querySelectorAll("video")].every((video) => video.readyState >= 1), null, { timeout: 30000 });
    await page.evaluate(async () => {
      const video = document.querySelector("video");
      video.muted = true;
      await video.play();
    });
    await page.waitForFunction(() => document.querySelector("video").currentTime > 0.3);
    await page.evaluate(() => { const video = document.querySelector("video"); video.pause(); video.currentTime = 10; });
    await page.waitForFunction(() => !document.querySelector("video").seeking && document.querySelector("video").currentTime >= 10);
    console.log("Real archive: photos render; both videos loaded metadata; playback and seek to 10s PASS.");
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
