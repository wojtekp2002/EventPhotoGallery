// Hasło poniżej służy wyłącznie do lokalnego podglądu.
// Na Cloudflare właściwe hasło jest sekretem serwera.
const LOCAL_PREVIEW_PASSWORD = "SP24-2007";
const accessStorageKey = "sp24-gallery-access";
const isLocalPreview =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(location.hostname);

const photoNames = [
  ...Array.from({ length: 94 }, (_, i) => `P331${1370 + i}.JPG`),
  ...Array.from({ length: 12 }, (_, i) => `P401${1464 + i}.JPG`),
];

const photos = photoNames.map((name) => ({
  name,
  number: name.slice(0, -4),
  series: name.startsWith("P331") ? "p331" : "p401",
  src: `photos/${name}`,
}));

const accessScreen = document.querySelector("#access-screen");
const galleryApp = document.querySelector("#gallery-app");
const accessForm = document.querySelector("#access-form");
const passwordInput = document.querySelector("#access-password");
const accessError = document.querySelector("#access-error");
const photoGrid = document.querySelector("#photo-grid");
const photoCount = document.querySelector("#photo-count");
const searchInput = document.querySelector("#photo-search");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxLabel = document.querySelector("#lightbox-label");
const downloadStatus = document.querySelector("#download-status");
const slideshowButton = document.querySelector("#slideshow-button");

let activeSeries = "all";
let visiblePhotos = photos;
let selectedPhotoIndex = 0;
let slideshowTimer = null;
let accessHideTimer = null;
let statusTimer = null;

function getVisiblePhotos() {
  const query = searchInput.value.trim().toLowerCase();
  return photos.filter((photo) =>
    (activeSeries === "all" || photo.series === activeSeries) &&
    photo.number.toLowerCase().includes(query)
  );
}

function renderGallery() {
  visiblePhotos = getVisiblePhotos();
  photoCount.textContent =
    `Wyświetlane: ${visiblePhotos.length} z ${photos.length} zdjęć`;
  photoGrid.replaceChildren();

  if (visiblePhotos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nie znaleziono zdjęć. Zmień serię lub wpisany numer.";
    photoGrid.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const photo of visiblePhotos) {
    const tile = document.createElement("article");
    tile.className = "photo-tile";

    const preview = document.createElement("button");
    preview.className = "photo-preview";
    preview.type = "button";
    preview.setAttribute("aria-label", `Otwórz zdjęcie ${photo.number}`);

    const image = document.createElement("img");
    image.src = photo.src;
    image.alt = `Zdjęcie ${photo.number}`;
    image.loading = "lazy";
    image.decoding = "async";
    preview.append(image);
    preview.addEventListener("click", () => openPhoto(photo));

    const number = document.createElement("span");
    number.className = "photo-number";
    number.textContent = photo.number;

    const download = document.createElement("button");
    download.className = "photo-download";
    download.type = "button";
    download.title = `Pobierz ${photo.number}`;
    download.setAttribute("aria-label", `Pobierz zdjęcie ${photo.number}`);

    download.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>
      </svg>
    `;
    download.addEventListener("click", () => downloadPhoto(photo));

    tile.append(preview, number, download);
    fragment.append(tile);
  }

  photoGrid.append(fragment);
}

function openPhoto(photo) {
  selectedPhotoIndex = visiblePhotos.indexOf(photo);
  if (selectedPhotoIndex < 0) return;

  stopSlideshow();
  updateLightbox();
  if (!lightbox.open) lightbox.showModal();
}

function updateLightbox() {
  const photo = visiblePhotos[selectedPhotoIndex];
  if (!photo) return;

  lightboxImage.src = photo.src;
  lightboxImage.alt = `Zdjęcie ${photo.number}`;
  lightboxLabel.textContent =
    `${selectedPhotoIndex + 1} / ${visiblePhotos.length} · ${photo.number}`;
}

function showStatus(message) {
  window.clearTimeout(statusTimer);
  (lightbox.open ? lightbox : document.body).append(downloadStatus);
  downloadStatus.textContent = message;
  downloadStatus.hidden = false;
  statusTimer = window.setTimeout(() => {
    downloadStatus.hidden = true;
  }, 5500);
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

async function downloadPhoto(photo) {
  if (!photo) return;

  if (location.protocol === "file:") {
    showStatus(
      "Uruchom start-galeria.bat i otwórz stronę przez http://localhost:8000, aby pobierać zdjęcia."
    );
    return;
  }

  showStatus(`Pobieranie ${photo.name}…`);

  try {
    const response = await fetch(photo.src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("Zamiast zdjęcia serwer zwrócił stronę HTML");
    }

    const blob = await response.blob();
    if (!blob.size) throw new Error("Pusty plik");

    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, photo.name);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    showStatus(`Rozpoczęto pobieranie ${photo.name}`);
  } catch (error) {
    console.error(`Nie udało się pobrać ${photo.src}:`, error);
    showStatus(
      `Nie udało się pobrać ${photo.name}. Sprawdź ścieżkę photos/${photo.name}.`
    );
  }
}

function stepPhoto(direction) {
  if (!visiblePhotos.length) return;
  selectedPhotoIndex =
    (selectedPhotoIndex + direction + visiblePhotos.length) %
    visiblePhotos.length;
  updateLightbox();
}

function stopSlideshow() {
  if (slideshowTimer) window.clearInterval(slideshowTimer);
  slideshowTimer = null;
  slideshowButton.textContent = "Pokaz slajdów";
  slideshowButton.setAttribute("aria-pressed", "false");
}

function closeLightbox() {
  stopSlideshow();
  if (lightbox.open) lightbox.close();
}

function showGallery() {
  window.clearTimeout(accessHideTimer);
  galleryApp.hidden = false;
  renderGallery();
  window.scrollTo(0, 0);
  requestAnimationFrame(() => accessScreen.classList.add("is-leaving"));
  accessHideTimer = window.setTimeout(() => {
    accessScreen.hidden = true;
  }, 300);
}

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = passwordInput.value;
  const submitButton = accessForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  if (isLocalPreview) {
    submitButton.disabled = false;

    if (password !== LOCAL_PREVIEW_PASSWORD) {
      accessError.textContent =
        "Nieprawidłowe hasło. Spróbuj ponownie.";
      accessError.hidden = false;
      passwordInput.select();
      return;
    }

    sessionStorage.setItem(accessStorageKey, "granted");
    accessError.hidden = true;
    passwordInput.value = "";
    showGallery();
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      throw new Error(
        response.status === 401 ? "wrong-password" : "server-error"
      );
    }

    accessError.hidden = true;
    passwordInput.value = "";
    showGallery();
  } catch (error) {
    accessError.textContent =
      error.message === "wrong-password"
        ? "Nieprawidłowe hasło. Spróbuj ponownie."
        : "Nie można zalogować. Sprawdź konfigurację galerii.";
    accessError.hidden = false;
    passwordInput.select();
  } finally {
    submitButton.disabled = false;
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeSeries = button.dataset.series;

    filterButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });

    renderGallery();
  });
});

searchInput.addEventListener("input", renderGallery);

document.querySelector("#previous-photo").addEventListener(
  "click", () => stepPhoto(-1)
);
document.querySelector("#next-photo").addEventListener(
  "click", () => stepPhoto(1)
);
document.querySelector("#close-lightbox").addEventListener(
  "click", closeLightbox
);
document.querySelector("#browse-button").addEventListener("click", () => {
  if (visiblePhotos.length) openPhoto(visiblePhotos[0]);
  else showStatus(
    "Brak zdjęć w obecnym widoku. Zmień filtr lub wyszukiwanie."
  );
});
document.querySelector("#download-link").addEventListener("click", () => {
  downloadPhoto(visiblePhotos[selectedPhotoIndex]);
});

slideshowButton.addEventListener("click", () => {
  if (slideshowTimer) {
    stopSlideshow();
    return;
  }

  slideshowButton.textContent = "Zatrzymaj pokaz";
  slideshowButton.setAttribute("aria-pressed", "true");
  stepPhoto(1);
  slideshowTimer = window.setInterval(() => stepPhoto(1), 4200);
});

document.querySelector("#logout-button").addEventListener(
  "click", async () => {
    stopSlideshow();

    if (!isLocalPreview) {
      try {
        const response = await fetch("/api/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch {
        showStatus(
          "Nie udało się wylogować. Odśwież stronę i spróbuj ponownie."
        );
        return;
      }
    }

    window.clearTimeout(accessHideTimer);
    sessionStorage.removeItem(accessStorageKey);
    galleryApp.hidden = true;
    accessScreen.hidden = false;
    accessScreen.classList.remove("is-leaving");
    passwordInput.value = "";
    passwordInput.focus();
  }
);

lightbox.addEventListener("close", stopSlideshow);

document.addEventListener("keydown", (event) => {
  if (!lightbox.open) return;
  if (event.key === "ArrowLeft") stepPhoto(-1);
  if (event.key === "ArrowRight") stepPhoto(1);
  if (event.key === "Escape") closeLightbox();
});

async function initializeAccess() {
  if (isLocalPreview) {
    if (sessionStorage.getItem(accessStorageKey) === "granted") {
      showGallery();
    } else {
      passwordInput.focus();
    }
    return;
  }

  try {
    const response = await fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.ok) {
      showGallery();
      return;
    }
    if (response.status === 503) {
      accessError.textContent =
        "Galeria czeka na konfigurację hasła na Cloudflare.";
      accessError.hidden = false;
    }
  } catch {
    accessError.textContent =
      "Nie można sprawdzić dostępu do galerii.";
    accessError.hidden = false;
  }

  passwordInput.focus();
}

initializeAccess();