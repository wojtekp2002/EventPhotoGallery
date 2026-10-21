const $ = (selector) => document.querySelector(selector);
const state = { events: [], manifests: new Map(), selected: "", mode: "photos", admin: false, photos: [], videos: [], current: 0, loading: 0, timer: null };
const upload = { files: [], busy: false, stop: false };
const icons = (root = document) => window.lucide?.createIcons({ root, attrs: { "aria-hidden": "true" } });
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function icon(name) {
  const node = el("i"); node.dataset.lucide = name; return node;
}
function showError(selector, message = "") {
  $(selector).textContent = message;
  $(selector).hidden = !message;
}
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { $("#toast").hidden = true; }, 4000);
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let data;
  try { data = await response.json(); } catch { throw new Error("Serwer nie zwrócił odpowiedzi. Spróbuj ponownie."); }
  if (!response.ok) {
    const error = new Error(data.error || "Nie udało się wykonać operacji.");
    error.status = response.status;
    throw error;
  }
  return data;
}
const post = (path, data) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
const dateLabel = (date) => date ? new Intl.DateTimeFormat("pl", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date + "T12:00:00")) : "";
const mediaUrl = (item, kind = "photos", download = false) => "/media/events/" + encodeURIComponent(item.eventId) + "/" + kind + "/" + encodeURIComponent(item.name) + (download ? "?download=1" : "");
const nameOf = (item) => item.originalName || item.name;
const yearOf = (event) => event.date?.slice(0, 4) || "";
const counted = (count, one, few, many) => count + " " + (count === 1 ? one : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? few : many);
const photoLabel = (count) => counted(count, "zdjęcie", "zdjęcia", "zdjęć");
function setHash(photo = null) {
  const params = new URLSearchParams();
  if (photo) { params.set("event", photo.eventId); params.set("photo", photo.name); }
  else if (state.selected) params.set("event", state.selected);
  history.replaceState(null, "", location.pathname + (params.size ? "#" + params.toString() : ""));
}
function enterGallery() {
  $("#access-screen").hidden = true;
  $("#private-label").hidden = true;
  $("#gallery-app").hidden = false;
  $("#header-actions").hidden = false;
  $("#access-password").value = "";
}
async function loadGallery({ deepLink = false } = {}) {
  const generation = ++state.loading;
  showError("#gallery-error");
  $("#retry-gallery").hidden = true;
  $("#result-count").textContent = "Wczytywanie archiwum…";
  try {
    const catalog = await api("/api/events");
    const events = [...catalog.events].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const manifests = await Promise.all(events.map(async (event) => [event.id, await api("/api/events/" + encodeURIComponent(event.id))]));
    if (generation !== state.loading) return;
    state.events = events;
    state.manifests = new Map(manifests);
    const hash = new URLSearchParams(location.hash.slice(1));
    if (deepLink) state.selected = hash.get("event") || "";
    if (!events.some((event) => event.id === state.selected)) state.selected = "";
    renderAlbums();
    renderCollection();
    if (deepLink && hash.get("photo")) {
      const index = state.photos.findIndex((item) => item.name === hash.get("photo") && item.eventId === hash.get("event"));
      if (index >= 0) openPhoto(index);
    }
  } catch (error) {
    if (generation !== state.loading) return;
    showError("#gallery-error", error.message);
    $("#retry-gallery").hidden = false;
    $("#result-count").textContent = "";
  }
}
function itemsFor(event, kind) {
  return (state.manifests.get(event.id)?.[kind === "photos" ? "items" : "videos"] || []).map((value) => ({
    ...(typeof value === "string" ? { name: value } : value), eventId: event.id, eventTitle: event.title, date: event.date,
  }));
}
function selectAlbum(id) {
  state.selected = id;
  $("#search").value = "";
  renderAlbums();
  renderCollection();
  setHash();
}
function renderAlbums() {
  const rail = $("#albums");
  rail.replaceChildren();
  const allCount = state.events.reduce((count, event) => count + itemsFor(event, "photos").length, 0);
  $("#archive-summary").textContent = counted(state.events.length, "spotkanie", "spotkania", "spotkań") + " · " + photoLabel(allCount);
  const make = (id, title, caption, cover) => {
    const button = el("button", "album");
    button.type = "button";
    button.setAttribute("aria-current", String(state.selected === id));
    button.setAttribute("aria-label", title);
    if (cover) {
      const image = el("img", "album-image"); image.src = mediaUrl(cover); image.alt = ""; image.loading = "lazy"; button.append(image);
    } else {
      const symbol = el("span", "album-symbol"); symbol.append(icon("gallery-vertical-end")); button.append(symbol);
    }
    const copy = el("span", "album-copy");
    copy.append(el("strong", "", title), el("small", "", caption));
    button.append(copy);
    button.addEventListener("click", () => selectAlbum(id));
    return button;
  };
  rail.append(make("", "Wszystkie spotkania", photoLabel(allCount), null));
  for (const event of state.events) {
    const photos = itemsFor(event, "photos");
    rail.append(make(event.id, event.title, [yearOf(event), photoLabel(photos.length)].filter(Boolean).join(" · "), photos[0]));
  }
  icons(rail);
}
function renderCollection() {
  const selected = state.events.find((event) => event.id === state.selected);
  $("#collection-title").textContent = selected?.title || "Wszystkie spotkania";
  $("#collection-date").textContent = selected ? [dateLabel(selected.date), selected.location].filter(Boolean).join(" · ") : "Fotografie i nagrania z naszych spotkań";
  const events = selected ? [selected] : state.events;
  const query = $("#search").value.trim().toLocaleLowerCase("pl");
  const allPhotos = events.flatMap((event) => itemsFor(event, "photos"));
  const allVideos = events.flatMap((event) => itemsFor(event, "videos"));
  const matches = (item) => [nameOf(item), item.title || "", item.eventTitle].join(" ").toLocaleLowerCase("pl").includes(query);
  state.photos = allPhotos.filter(matches);
  state.videos = allVideos.filter(matches);
  $("#photos-count").textContent = allPhotos.length;
  $("#videos-count").textContent = allVideos.length;
  $("#photos-tab").setAttribute("aria-pressed", String(state.mode === "photos"));
  $("#videos-tab").setAttribute("aria-pressed", String(state.mode === "videos"));
  $("#photo-grid").hidden = state.mode !== "photos";
  $("#video-grid").hidden = state.mode !== "videos";
  $("#browse").disabled = !state.photos.length;
  const count = state.mode === "photos" ? state.photos.length : state.videos.length;
  $("#result-count").textContent = (state.mode === "photos" ? photoLabel(count) : counted(count, "nagranie", "nagrania", "nagrań")) + (query ? " · wyniki wyszukiwania" : "");
  $("#empty-state").hidden = count > 0;
  $("#empty-title").textContent = query ? "Brak wyników wyszukiwania" : state.mode === "videos" ? "W tym albumie nie ma nagrań" : "Jeszcze nie ma zdjęć";
  $("#empty-add").hidden = !!query || state.mode === "videos";
  const grid = $("#photo-grid");
  grid.replaceChildren();
  const fragment = document.createDocumentFragment();
  state.photos.forEach((photo, index) => {
    const tile = el("article", "photo-tile");
    const media = el("div", "photo-media");
    const preview = el("button", "photo-preview");
    preview.type = "button"; preview.setAttribute("aria-label", "Otwórz zdjęcie " + nameOf(photo));
    const image = el("img"); image.src = mediaUrl(photo); image.alt = photo.caption || nameOf(photo); image.loading = "lazy"; image.decoding = "async";
    preview.append(image); preview.addEventListener("click", () => openPhoto(index));
    const download = el("a", "icon-button photo-download");
    download.href = mediaUrl(photo, "photos", true); download.download = nameOf(photo);
    download.title = "Pobierz zdjęcie"; download.setAttribute("aria-label", "Pobierz " + nameOf(photo)); download.append(icon("download"));
    media.append(preview, download);
    const caption = el("div", "photo-caption");
    caption.append(el("strong", "", nameOf(photo)), el("span", "", photo.date?.slice(0, 4) || ""));
    tile.append(media, caption); fragment.append(tile);
  });
  grid.append(fragment);
  const videos = $("#video-grid"); videos.replaceChildren();
  if (state.mode === "videos") for (const video of state.videos) {
    const card = el("article", "video-card");
    const player = el("video"); player.controls = true; player.preload = "metadata"; player.playsInline = true; player.src = mediaUrl(video, "videos");
    const info = el("div", "video-info"); const copy = el("div");
    copy.append(el("h3", "", video.title || nameOf(video)), el("p", "", video.eventTitle));
    const download = el("a", "button secondary"); download.href = mediaUrl(video, "videos", true); download.download = nameOf(video); download.append(icon("download"), document.createTextNode("Pobierz"));
    info.append(copy, download); card.append(player, info); videos.append(card);
  }
  icons(grid); icons(videos);
}
function openPhoto(index) {
  stopSlideshow();
  state.current = index;
  updatePhoto();
  if (!$("#lightbox").open) $("#lightbox").showModal();
}
function updatePhoto() {
  const photo = state.photos[state.current];
  if (!photo) return;
  $("#lightbox-image").src = mediaUrl(photo);
  $("#lightbox-image").alt = nameOf(photo);
  $("#lightbox-label").textContent = nameOf(photo);
  $("#lightbox-counter").textContent = (state.current + 1) + " / " + state.photos.length;
  $("#lightbox-download").href = mediaUrl(photo, "photos", true);
  $("#lightbox-download").download = nameOf(photo);
  $("#lightbox-status").textContent = photo.eventTitle;
  setHash(photo);
}
function step(direction) {
  if (state.photos.length) { state.current = (state.current + direction + state.photos.length) % state.photos.length; updatePhoto(); }
}
function stopSlideshow() {
  clearInterval(state.timer); state.timer = null;
  $("#slideshow").setAttribute("aria-pressed", "false");
  $("#slideshow").setAttribute("aria-label", "Rozpocznij pokaz slajdów");
  $("#slideshow").title = "Pokaz slajdów";
  $("#slideshow").replaceChildren(icon("play")); icons($("#slideshow"));
}
$("#slideshow").addEventListener("click", () => {
  if (state.timer) return stopSlideshow();
  state.timer = setInterval(() => step(1), 4500);
  $("#slideshow").setAttribute("aria-pressed", "true"); $("#slideshow").setAttribute("aria-label", "Wstrzymaj pokaz slajdów"); $("#slideshow").title = "Wstrzymaj pokaz slajdów";
  $("#slideshow").replaceChildren(icon("pause")); icons($("#slideshow"));
});
$("#share").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); $("#lightbox-status").textContent = "Link do zdjęcia został skopiowany."; }
  catch { $("#lightbox-status").textContent = "Nie udało się skopiować linku."; }
});
$("#lightbox-image").addEventListener("error", () => { $("#lightbox-status").textContent = "Nie udało się wczytać zdjęcia. Spróbuj ponownie po zalogowaniu."; });
$("#lightbox-close").addEventListener("click", () => $("#lightbox").close());
$("#lightbox").addEventListener("close", () => { stopSlideshow(); $("#lightbox-image").removeAttribute("src"); setHash(); });
$("#previous").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
$("#lightbox").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
  if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
});
let touchX = null;
$("#lightbox-image").addEventListener("touchstart", (event) => { if (event.touches.length === 1) touchX = event.touches[0].clientX; else touchX = null; }, { passive: true });
$("#lightbox-image").addEventListener("touchend", (event) => { if (touchX !== null && Math.abs(event.changedTouches[0].clientX - touchX) > 65) step(event.changedTouches[0].clientX < touchX ? 1 : -1); touchX = null; }, { passive: true });

function refreshAlbumSelect(preferred = state.selected) {
  const select = $("#upload-album"); select.replaceChildren();
  for (const event of state.events) select.add(new Option(event.title + (event.date ? " · " + event.date.slice(0, 4) : ""), event.id));
  select.add(new Option("+ Nowe spotkanie", "__new"));
  select.value = state.events.some((event) => event.id === preferred) ? preferred : state.events[0]?.id || "__new";
  changeAlbumFields();
}
function changeAlbumFields() {
  const isNew = $("#upload-album").value === "__new";
  $("#new-album-fields").hidden = !isNew;
  $("#album-title").required = isNew;
}
function openUpload() {
  showError("#organizer-error"); showError("#upload-error");
  $("#organizer-form").hidden = state.admin;
  $("#upload-form").hidden = !state.admin;
  refreshAlbumSelect();
  $("#upload-dialog").showModal();
}
function closeUpload() {
  if (upload.busy) { upload.stop = true; $("#upload-status").textContent = "Kończenie bieżącego zdjęcia…"; return; }
  $("#upload-dialog").close();
}
$("#upload-dialog").addEventListener("cancel", (event) => { if (upload.busy) { event.preventDefault(); closeUpload(); } });
$("#upload-dialog").addEventListener("close", () => {
  $("#organizer-password").value = "";
  for (const file of upload.files) URL.revokeObjectURL(file.preview);
  upload.files = [];
  $("#upload-status").textContent = ""; $("#upload-progress").hidden = true;
  $("#album-title").value = ""; $("#album-date").value = "";
  renderFiles();
});
$("#organizer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    await post("/api/admin/login", { password: $("#organizer-password").value });
    state.admin = true; $("#organizer-password").value = "";
    $("#organizer-form").hidden = true; $("#upload-form").hidden = false; $("#upload-album").focus();
  } catch (error) { showError("#organizer-error", error.message); }
  finally { button.disabled = false; }
});
function addFiles(files) {
  if (upload.busy) return;
  const rejected = [];
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024 || !file.size) { rejected.push(file.name); continue; }
    if (upload.files.length >= 200) { rejected.push(file.name); continue; }
    if (upload.files.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
    upload.files.push({ file, preview: URL.createObjectURL(file), status: "pending", error: "" });
  }
  showError("#upload-error", rejected.length ? "Pominięto " + rejected.length + " plików. Wybierz do 200 zdjęć JPG, PNG lub WebP, każde do 20 MB." : "");
  renderFiles();
}
function renderFiles() {
  const list = $("#file-list"); list.replaceChildren();
  upload.files.forEach((item, index) => {
    const row = el("li", "file-row " + item.status);
    const preview = el("img"); preview.src = item.preview; preview.alt = "";
    const info = el("div", "file-info");
    info.append(el("strong", "", item.file.name), el("small", "", item.status === "done" ? "Dodano" : item.status === "failed" ? item.error : (item.file.size / 1024 / 1024).toFixed(1) + " MB"));
    const remove = el("button", "icon-button"); remove.type = "button"; remove.title = "Usuń z listy"; remove.setAttribute("aria-label", "Usuń " + item.file.name); remove.disabled = upload.busy;
    remove.append(icon(item.status === "done" ? "check" : "x"));
    remove.addEventListener("click", () => { URL.revokeObjectURL(item.preview); upload.files.splice(index, 1); renderFiles(); });
    row.append(preview, info, remove); list.append(row);
  });
  $("#file-summary").textContent = upload.files.length ? "Wybrano: " + upload.files.length + " zdjęć" : "";
  $("#upload-submit").disabled = upload.busy || !upload.files.some((file) => file.status !== "done");
  icons(list);
}
function sendFile(eventId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/admin/events/" + encodeURIComponent(eventId) + "/photos/" + encodeURIComponent(file.name));
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = 180000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    xhr.onload = () => {
      let data; try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error || "Nie udało się dodać zdjęcia."));
    };
    xhr.onerror = () => reject(new Error("Brak połączenia. Spróbuj ponownie."));
    xhr.ontimeout = () => reject(new Error("Przesyłanie trwało za długo. Spróbuj ponownie."));
    xhr.send(file);
  });
}
$("#upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (upload.busy) return;
  const pending = upload.files.filter((file) => file.status !== "done");
  if (!pending.length) return;
  upload.busy = true; upload.stop = false;
  showError("#upload-error");
  $("#upload-progress").hidden = false; $("#upload-progress").value = 0;
  $("#upload-cancel").textContent = "Zatrzymaj";
  for (const id of ["upload-album", "album-title", "album-date", "file-input"]) $("#" + id).disabled = true;
  renderFiles();
  let albumId = $("#upload-album").value;
  let complete = 0;
  try {
    if (albumId === "__new") {
      const { event: created } = await post("/api/admin/events", { title: $("#album-title").value.trim(), date: $("#album-date").value });
      state.events.unshift(created); state.manifests.set(created.id, { items: [], videos: [] });
      albumId = created.id;
      refreshAlbumSelect(albumId);
    }
    for (let index = 0; index < pending.length && !upload.stop; index++) {
      const item = pending[index];
      $("#upload-status").textContent = "Dodawanie " + (index + 1) + " z " + pending.length + ": " + item.file.name;
      try {
        await sendFile(albumId, item.file, (progress) => { $("#upload-progress").value = (index + progress) / pending.length * 100; });
        item.status = "done"; item.error = ""; complete++;
      } catch (error) { item.status = "failed"; item.error = error.message; }
      $("#upload-progress").value = (index + 1) / pending.length * 100;
      renderFiles();
    }
    state.selected = albumId;
    state.mode = "photos";
    $("#search").value = "";
    await loadGallery();
    setHash();
    const remaining = upload.files.filter((file) => file.status !== "done").length;
    $("#upload-status").textContent = "Przesłano " + complete + " zdjęć." + (remaining ? " Pozostało: " + remaining + "." : " Album jest już aktualny.");
    if (remaining) showError("#upload-error", "Nie wszystkie zdjęcia zostały dodane. Możesz ponowić przesłanie pozostałych.");
  } catch (error) { showError("#upload-error", error.message); }
  finally {
    upload.busy = false;
    for (const id of ["upload-album", "album-title", "album-date", "file-input"]) $("#" + id).disabled = false;
    $("#upload-cancel").textContent = "Gotowe";
    renderFiles();
  }
});
$("#file-input").addEventListener("change", (event) => { addFiles(event.target.files); event.target.value = ""; });
$("#dropzone").addEventListener("dragover", (event) => { event.preventDefault(); if (!upload.busy) $("#dropzone").classList.add("dragging"); });
$("#dropzone").addEventListener("dragleave", () => $("#dropzone").classList.remove("dragging"));
$("#dropzone").addEventListener("drop", (event) => { event.preventDefault(); $("#dropzone").classList.remove("dragging"); addFiles(event.dataTransfer.files); });
$("#upload-album").addEventListener("change", changeAlbumFields);
$("#add-photos").addEventListener("click", openUpload);
$("#empty-add").addEventListener("click", openUpload);
$("#upload-close").addEventListener("click", closeUpload);
$("#upload-cancel").addEventListener("click", closeUpload);
$("#browse").addEventListener("click", () => { if (state.photos.length) openPhoto(0); });
$("#search").addEventListener("input", renderCollection);
$("#photos-tab").addEventListener("click", () => { state.mode = "photos"; renderCollection(); });
$("#videos-tab").addEventListener("click", () => { state.mode = "videos"; renderCollection(); });
$("#retry-gallery").addEventListener("click", () => loadGallery());
$("#password-toggle").addEventListener("click", () => {
  const show = $("#access-password").type === "password";
  $("#access-password").type = show ? "text" : "password";
  $("#password-toggle").setAttribute("aria-label", show ? "Ukryj hasło" : "Pokaż hasło");
  $("#password-toggle").title = show ? "Ukryj hasło" : "Pokaż hasło";
});
$("#access-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#access-submit").disabled = true; showError("#access-error");
  try { await post("/api/login", { password: $("#access-password").value }); state.admin = false; enterGallery(); await loadGallery({ deepLink: true }); }
  catch (error) { showError("#access-error", error.message); }
  finally { $("#access-submit").disabled = false; }
});
$("#logout").addEventListener("click", async () => {
  try {
    await post("/api/logout", {});
    state.admin = false; state.events = []; state.manifests.clear(); state.photos = []; state.videos = []; state.selected = "";
    $("#photo-grid").replaceChildren(); $("#video-grid").replaceChildren(); $("#albums").replaceChildren();
    $("#gallery-app").hidden = true; $("#header-actions").hidden = true;
    $("#access-screen").hidden = false; $("#private-label").hidden = false;
    setHash(); $("#access-password").focus();
  } catch (error) { notify(error.message); }
});
icons();
api("/api/session").then(async (data) => { if (data.authenticated) { state.admin = data.admin; enterGallery(); await loadGallery({ deepLink: true }); } }).catch((error) => showError("#access-error", error.message));
