import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "media", "events");
const catalog = JSON.parse((await readFile(path.join(root, "index.json"), "utf8")).replace(/^\uFEFF/, ""));
for (const event of catalog.events) {
  const location = path.join(root, event.id, "manifest.json");
  const manifest = JSON.parse((await readFile(location, "utf8")).replace(/^\uFEFF/, ""));
  for (const [folder, property, pattern] of [["photos", "items", /\.(jpe?g|png|webp)$/i], ["videos", "videos", /\.mp4$/i]]) {
    let names;
    try { names = (await readdir(path.join(root, event.id, folder), { withFileTypes: true })).filter((item) => item.isFile() && pattern.test(item.name)).map((item) => item.name).sort(); }
    catch (error) { if (error.code !== "ENOENT") throw error; names = []; }
    const existing = manifest[property] || [];
    manifest[property] = [...existing];
    for (const name of names) if (!existing.some((item) => (typeof item === "string" ? item : item.name) === name)) {
      manifest[property].push({ name, ...(folder === "videos" ? { title: "Nagranie " + (manifest[property].length + 1) } : {}) });
    }
  }
  await writeFile(location, JSON.stringify(manifest, null, 2) + "\n");
  console.log(event.id + ": " + manifest.items.length + " zdjec, " + manifest.videos.length + " nagran.");
}
