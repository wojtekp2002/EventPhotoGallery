# Dokumentacja archiwum SP24

## Lokalne uruchomienie

`npm run dev` uruchamia wspólne API i serwuje aplikację na `127.0.0.1`. Otwórz dokładny adres z terminala; inny serwer na IPv6 pod `localhost` może pokazywać starszą stronę.

Lokalne hasła: `SP24-2007` (widz) i `organizator-lokalnie` (organizator). To wartości serwera deweloperskiego, nie kodu przeglądarki. Własne ustawienia w `.dev.vars`:
~~~dotenv
GALLERY_PASSWORD=twoje-haslo-widzow
GALLERY_ADMIN_TOKEN=twoje-haslo-organizatora
GALLERY_SESSION_SECRET=dlugi-losowy-sekret-minimum-32-znaki
~~~
Nie commituj tego pliku. Restart lokalnego serwera bez ustawionego sekretu unieważnia dotychczasowe sesje.

## Albumy i przesyłanie

Nazwa całej strony to **Archiwum spotkań rocznika 1964 · SP24**. Daty należą do albumów.

**Dodaj zdjęcia** otwiera logowanie organizatora. Wybierz album albo **Nowe spotkanie**. Identyfikator folderu powstaje automatycznie z nazwy i unikalnego sufiksu, np. `spotkanie-2026-a1b2c3d4`. Data jest opcjonalna.

~~~text
media/events/
  index.json
  spotkanie-2007/
    manifest.json
    photos/
    videos/
  spotkanie-2026-a1b2c3d4/
    manifest.json
    photos/
~~~

Nowo przesyłane pliki otrzymują nazwę będącą skrótem zawartości. Oryginalna nazwa zostaje zachowana w metadanych i podczas pobierania. Różne zdjęcia o tej samej nazwie nie nadpisują się. Ponowne przesłanie tych samych bajtów przez panel nie tworzy duplikatu.

Przycisk **Zatrzymaj** kończy bieżący plik i zatrzymuje kolejkę. Ponowienie pomija zakończone pliki. Zamknięcie formularza usuwa tylko jego kolejkę, nie przesłane zdjęcia. JPG, PNG, WebP; limit 20 MB na zdjęcie, do 200 plików w kolejce.

## Import starszych materiałów

Zachowano album 2007 z 106 zdjęciami i dwoma MP4. Utworzenie lokalnego katalogu:
~~~sh
npm run event:create -- spotkanie-2026 --title="Spotkanie 2026" --date=2026-06-20
~~~
Po dodaniu plików do `photos/` lub `videos/`:
~~~sh
npm run media:scan
~~~
Skan dopisuje nowe pliki do manifestów, zachowując wcześniejsze wpisy i oryginały. Panel internetowy przesyła zdjęcia; duże MP4 importuje się do magazynu wraz z manifestem. API obsługuje Range dla odtwarzania i przewijania.

## Pobieranie

Linki mają atrybut `download`, a API wysyła `Content-Disposition: attachment` z nazwą UTF-8 i oryginalnymi bajtami. Ten sam kod działa lokalnie i w Cloudflare. [Opis nagłówka](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition).

Przeglądarka decyduje, czy zapisać plik w Pobranych, czy zapytać o folder. Strona nie zmienia tego ustawienia.

## Wdrożenie

Wymaganie bez karty, porównanie magazynów i ograniczenia nagrań opisano w [HOSTING.md](HOSTING.md). Poniższa konfiguracja dotyczy istniejącego adaptera R2, nie proponowanego wariantu B2.

Kod obsługuje Cloudflare Pages i prywatne R2. Nie aktywuje usług. R2 wymaga subskrypcji i checkout mimo bezpłatnego limitu. Przy wymaganiu „bez karty” nie zakładaj, że R2 je spełni. [Warunki R2](https://developers.cloudflare.com/r2/get-started/).

1. Utwórz prywatny bucket, jeżeli akceptujesz warunki usługi. Nie włączaj publicznego dostępu.
2. W `wrangler.toml` ustaw `bucket_name`. Binding ma nazwę `MEDIA`.
3. W Pages ustaw katalog publikacji `deploy`.
4. Ustaw sekrety `GALLERY_PASSWORD`, `GALLERY_ADMIN_TOKEN`, `GALLERY_SESSION_SECRET` (co najmniej 32 losowe znaki).
5. Skopiuj strukturę spod `media/` do bucketa, poczynając od `events/index.json`. Prefiks `media/` nie jest częścią klucza.
6. Opublikuj kod i zweryfikuj logowanie, pobieranie oraz przesłanie zdjęcia na docelowej domenie. Dopiero sprawdzony adres wpisz do README.

Sam push do GitHub nie przesyła mediów. Bucket potrzebuje fotografii, filmów i manifestów.

## Dostęp

Sesja HMAC trwa 12 godzin. Cookie ma HttpOnly/SameSite=Strict oraz Secure w produkcji HTTPS. Rola organizatora jest częścią podpisanej sesji. Hasła nie trafiają do localStorage ani kodu klienta.

Media i katalogi albumów wymagają zalogowania. Zapis wymaga roli organizatora i zgodnego Origin. Walidowane są rozmiar oraz sygnatura formatu zdjęcia. Dane albumów są wstawiane jako tekst; odpowiedzi mają CSP, nosniff i zakaz cache prywatnych mediów.

Warunkowe zapisy manifestów z ETag zapobiegają zgubieniu równoległych zmian. [API R2](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

Limit błędnych logowań w pamięci chroni pojedynczą instancję, nie całą rozproszoną usługę. Przed publicznym udostępnieniem dodaj w hostingu ograniczenie prób na `/api/login` i `/api/admin/login`. Handler obsługuje opcjonalny binding `AUTH_LIMITER`.

Wspólne hasło daje wspólny dostęp. Nie ma osobistych kont ani ulubionych. Uprawniony widz może dalej udostępnić pobrany plik. Wylogowanie usuwa cookie w jego przeglądarce; awaryjne unieważnienie wszystkich sesji wymaga zmiany `GALLERY_SESSION_SECRET`.

## Repozytorium

`deploy/assets/archive-mark.svg` to własny znak projektu oraz favicona. Tło korzysta z `archive-desktop.webp` i `archive-mobile.webp`; `<picture>` wybiera pionowy wariant do 650 px szerokości. Po zalogowaniu tło jest stonowane, a ograniczenie ruchu wyłącza przejście. Te zasoby są jawnie dopuszczone przed zalogowaniem; nie otwarto dostępu do całego katalogu zasobów ani prywatnych mediów. Plik `archive-pattern.svg` pozostał jako poprzedni wzór, ale nie jest już używany przez interfejs.

Tła są ilustracjami wygenerowanymi na potrzeby projektu, nie fotografiami szkoły. [Pochodzenie grafik i briefy](docs/ASSETS.md). Publiczny podgląd `docs/images/archive-preview.webp` pokazuje wyłącznie niezalogowany ekran z pustym polem hasła. Pozostałe zrzuty w `.artifacts/` mogą zawierać prywatne media i nie powinny trafiać na GitHub.

`media/`, `videos/`, `deploy/photos/`, `.artifacts/`, `node_modules/` i sekrety są ignorowane. Nie dołączaj do README zrzutów z prywatnymi fotografiami. Sam `.gitignore` nie usuwa plików z wcześniejszej historii.

~~~sh
git status
git ls-files
npm test
~~~

Projekt nie wykonuje automatycznych commitów, pushy ani wdrożeń.
