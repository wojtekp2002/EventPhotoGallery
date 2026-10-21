# Grafiki i publiczny podgląd

## Pochodzenie

| Plik | Źródło i zastosowanie |
| --- | --- |
| `deploy/assets/archive-mark.svg` | Własny znak archiwum: karty albumu i numer szkoły. Nie jest oficjalnym herbem SP24. |
| `deploy/assets/archive-desktop.webp` | Dekoracyjne tło wygenerowane wbudowanym narzędziem ImageGen. 1536 × 1024, 91 436 bajtów. |
| `deploy/assets/archive-mobile.webp` | Pionowa adaptacja tła wykonana tym samym narzędziem. 1024 × 1536, 37 136 bajtów. |
| `docs/images/archive-preview.webp` | Zrzut publicznego ekranu logowania, wykonany przez Playwright i zapisany jako WebP. Bez zdjęć uczestników, haseł i innych danych prywatnych. |
| `deploy/vendor/lucide.min.js` | Biblioteka ikon. Licencja w sąsiednim pliku `LUCIDE-LICENSE`. |

Generowanie: 21 października 2026, wbudowany ImageGen, bez zewnętrznego skryptu API. Pliki źródłowe zostały zakodowane do WebP w jakości 80 bez zmiany kompozycji. Nie wysyłano prywatnych zdjęć jako materiałów referencyjnych. Wariant mobilny powstał wyłącznie na podstawie wygenerowanego tła komputerowego.

## Brief komputerowy

```text
Use case: photorealistic-natural. Asset type: full-bleed background for a private Polish school reunion photo archive, not a UI mockup. Generate a refined, photorealistic overhead still life of an archival photo album workspace on a very light pearl-grey paper surface. Landscape composition around 3:2. Crucial layout: the middle 60 percent of the image is empty uninterrupted almost-white matte paper, perfectly suitable for dark login text placed later by HTML. At the far left edge, partially outside the image, a muted sage-green linen-bound photo album with a fine cloth weave; at the far right edge, a few carefully arranged blank white photographic paper sheets with restrained cool shadows and one tiny dusty-lilac paper divider. Objects must remain in outer 15-20 percent at left and right, central area empty from top to bottom. Daylight, crisp tactile paper details, very soft realistic shadows. Sophisticated editorial museum-archive feel, nostalgic without vintage sepia. Bright cool-white, quiet sage and a minimal lilac accent. No people, no faces, no actual photographs printed on the sheets, no school building, no camera, no flowers, no text, no numbers, no logo, no watermark, no UI, no borders, no gradients, no bokeh, no beige or brown tones. The photograph itself is the entire image.
```

## Brief mobilny

```text
Create a portrait mobile background adaptation of this generated archive still life. Portrait 2:3 canvas, not landscape. Preserve the exact calm pearl-grey paper, muted sage cloth album, pale lilac and white paper sheets, realistic overhead photography, very soft shadows. Recompose for a mobile login screen: only a small corner of the sage linen album peeks in at the extreme upper-left (within top 12% of the image), and a small stack of white and pale lilac paper corners peeks in at the extreme lower-right (within bottom 12%). Keep the entire middle 75% height and full central 90% width completely empty light paper for HTML text and form overlay. No text, no numbers, no people, no photos, no logos, no interface, no new objects, no dark or vignette effect. This is a neutral decorative texture, not an actual school photograph.
```

Nie używaj zrzutów zalogowanej galerii do publicznego README. Nie przedstawiaj wygenerowanego tła jako historycznej fotografii szkoły lub spotkania.
