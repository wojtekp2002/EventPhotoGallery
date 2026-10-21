import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [id, ...argumentsList] = process.argv.slice(2);
const values = Object.fromEntries(argumentsList.map((value) => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=").trim()];
}));

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) {
  throw new Error("Użyj identyfikatora małymi literami, np. spotkanie-2026.");
}

const event = {
  id,
  title: values.title || id,
  date: values.date || "",
  location: values.location || "",
  description: values.description || "",
};
const eventsDirectory = path.join(root, "media", "events");
const eventDirectory = path.join(eventsDirectory, id);
const indexPath = path.join(eventsDirectory, "index.json");
const manifestPath = path.join(eventDirectory, "manifest.json");

await mkdir(path.join(eventDirectory, "photos"), { recursive: true });
await mkdir(path.join(eventDirectory, "videos"), { recursive: true });
let catalog = { events: [] };
try { catalog = JSON.parse(await readFile(indexPath, "utf8")); } catch {}
if (catalog.events.some((item) => item.id === id)) throw new Error(`Wydarzenie ${id} już istnieje.`);
catalog.events.unshift(event);
await writeFile(indexPath, `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(manifestPath, `${JSON.stringify({ ...event, items: [] }, null, 2)}\n`, { flag: "wx" });
console.log(`Utworzono media/events/${id}/ z folderami photos i videos.`);
