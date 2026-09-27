# Dokumentacja galerii SP24 Rybnik

## Zawartość projektu

| Plik lub folder | Przeznaczenie |
| --- | --- |
| `index.html` | struktura strony |
| `styles.css` | wygląd na telefonach i komputerach |
| `app.js` | hasło, galeria, filtry, podgląd i pobieranie |
| `photos/` | 106 pełnych, oryginalnych zdjęć JPG |
| `README.md` | krótki opis projektu |

## Ustawienia przed publikacją

### Hasło

W `app.js` znajdź pierwszy wiersz i podmień hasło:

```js
const ACCESS_PASSWORD = "SP24-2007";
```

Przykład:

```js
const ACCESS_PASSWORD = "Twoje-mocne-haslo-2026";
```

### Nazwa wydarzenia

Teksty widoczne na stronie znajdują się w `index.html`. Najważniejsze są trzy fragmenty:

```html
<h1>Spotkanie szkolne</h1>
<p class="event-meta">SP24 Rybnik <span>/</span> 31.03.2007</p>
<strong>Spotkanie szkolne</strong>
```

## Utworzenie repozytorium GitHub

1. Na GitHub wybierz `New repository`.
2. Nadaj nazwę, np. `galeria-sp24-rybnik`.
3. Wybierz widoczność `Public`, jeśli strona ma być dostępna dla każdego z linkiem.
4. Nie dodawaj automatycznie pliku README, ponieważ projekt ma już własny.
5. Skopiuj adres nowo utworzonego repozytorium.

W terminalu otwartym w folderze `galeria-spotkanie-sp24` wykonaj:

```powershell
git init
git add .
git commit -m "Dodaj galerię spotkania SP24"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/galeria-sp24-rybnik.git
git push -u origin main
```

Zastąp `TWOJ_LOGIN` swoim loginem GitHub. Przy pierwszym `git push` GitHub może poprosić o zalogowanie w przeglądarce.

### Gdy Git zgłasza brak miejsca na dysku

Zdjęcia zajmują około 66 MB, a Git potrzebuje dodatkowego miejsca na swoją kopię plików przed pierwszym commitem. Jeśli `D:` ma mało wolnego miejsca, najprościej przenieść cały folder projektu na dysk `C:`, gdzie jest wolne miejsce, a potem ponowić polecenia Git w nowej lokalizacji.

```powershell
Move-Item -LiteralPath "D:\galeria-spotkanie-sp24" -Destination "C:\galeria-spotkanie-sp24"
```

Po przeniesieniu:

```powershell
cd C:\galeria-spotkanie-sp24
git add .
git commit -m "Dodaj galerię spotkania SP24"
```

## Darmowa publikacja przez Cloudflare Pages

Plan Cloudflare Pages Free nie wymaga podania karty płatniczej. Dla tej galerii jest odpowiedni: projekt ma około 66 MB i 110 plików, a limit Free to 20 000 plików oraz 25 MiB na pojedynczy plik.

1. Załóż konto na [Cloudflare](https://dash.cloudflare.com/sign-up) przez e-mail.
2. Potwierdź adres e-mail.
3. Przejdź do `Workers & Pages` i wybierz `Create application`.
4. Wybierz `Pages`, a następnie `Import an existing Git repository`.
5. Połącz konto GitHub i wskaż repozytorium galerii.
6. Ustawienia kompilacji zostaw puste, ponieważ to prosta strona HTML, CSS i JavaScript.
7. Kliknij `Save and Deploy`.

Po chwili strona otrzyma darmowy adres w rodzaju:

```text
https://galeria-sp24-rybnik.pages.dev
```

Każdy kolejny push do gałęzi `main` automatycznie odświeży opublikowaną stronę.

## Prywatność zdjęć

Hasło zapisane w `app.js` jest ochroną tylko na poziomie interfejsu. Osoba techniczna, która ma bezpośredni link do pliku JPG, może go otworzyć bez podawania hasła.

Jeżeli zdjęcia mają być dostępne tylko dla konkretnej listy osób, zastosuj zamiast tego Cloudflare Access z logowaniem e-mailem albo prywatny folder udostępniony wybranym osobom. Do wygodnej galerii dla absolwentów, dostępnej pod niepublicznym linkiem i z hasłem, obecna wersja jest wystarczająca.

### Prawdziwe logowanie przez Cloudflare Access

Nie musisz włączać go teraz. Najpierw opublikuj stronę w Cloudflare Pages. Następnie w panelu Cloudflare możesz utworzyć aplikację Access dla adresu galerii i wybrać logowanie kodem wysłanym na e-mail. Do zasad dostępu dodasz konkretne adresy osób, które mogą oglądać zdjęcia.

Cloudflare Access działa przed otwarciem strony, więc nie wymaga zmiany kodu galerii. Gdy Access będzie gotowy, można usunąć hasło z `app.js`, ponieważ dostęp będzie kontrolowany przez Cloudflare.

## Pobieranie zdjęć

Każde zdjęcie ma ikonę pobierania w prawym górnym rogu. Kliknięcie jej natychmiast pobiera pełny oryginalny plik JPG na komputer. Ten sam przycisk znajduje się też w pełnoekranowym podglądzie.

## Ulubione zdjęcia

Kliknięcie serca na zdjęciu zapisuje je jako ulubione w tej przeglądarce. Przycisk `Ulubione` pokazuje później tylko oznaczone fotografie.

## Filmy z płyty

Nagrania są w formacie DVD `.VOB`, a więc nie działają wygodnie w nowoczesnej przeglądarce. Do dodania ich do galerii trzeba najpierw przekonwertować główne pliki `VTS_01_1.VOB` oraz `VTS_01_2.VOB` do MP4 (H.264). Po konwersji można dodać osobną sekcję filmów.
