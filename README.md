# Galeria SP24 Rybnik

Nowoczesna statyczna galeria 106 oryginalnych zdjęć ze spotkania szkolnego SP24 Rybnik z 31 marca 2007 roku.

## Co zawiera

- ekran wejścia na hasło
- responsywną galerię zdjęć dla telefonu i komputera
- filtrowanie serii oraz wyszukiwanie po numerze fotografii
- pełnoekranowy podgląd, obsługę strzałkami i pokaz slajdów
- pobieranie pełnej wersji każdego zdjęcia
- ulubione zdjęcia zapamiętywane w przeglądarce

## Uruchomienie lokalnie

Otwórz `index.html` w przeglądarce. Nie wymaga serwera ani instalowania dodatkowych programów.

## Zmiana hasła

W `app.js` zmień wartość stałej `ACCESS_PASSWORD`:

```js
const ACCESS_PASSWORD = "SP24-2007";
```

## Publikacja

Cały folder `galeria-spotkanie-sp24` należy wysłać do repozytorium. Folder `photos` musi pozostać obok `index.html`.

Szczegółową instrukcję pushowania na GitHub i publikacji przez Cloudflare Pages znajdziesz w `DOKUMENTACJA.md`.

> Ekran z hasłem ogranicza wejście do aplikacji, ale nie jest pełnym zabezpieczeniem plików przy publicznym hostingu statycznym. Nie publikuj w ten sposób materiałów, które wymagają ścisłej prywatności.
