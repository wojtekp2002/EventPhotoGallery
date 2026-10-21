# Hosting bez karty

Sprawdzone: 21 października 2026. To analiza wariantów, nie potwierdzenie wdrożenia. Nie utworzono kont, nie przesłano prywatnych mediów i nie aktywowano płatnych usług.

## Wniosek

Małe archiwum można uruchomić w darmowych limitach, ale nie należy utożsamiać darmowej strony z nieograniczonym hostingiem filmów. Najbardziej obiecujący wariant bez karty to Cloudflare Workers dla aplikacji i prywatny Backblaze B2 dla mediów. Wymaga dodatkowej integracji; obecny kod obsługuje lokalny dysk i R2, nie B2.

## Ile miejsca potrzeba

Lokalny katalog `media/` zawiera 106 zdjęć, dwa MP4 i manifesty: 821 549 226 bajtów, około 0,82 GB. Nagrania mają około 353 MB i 399 MB. Oglądanie i pobieranie tych samych plików przez kolejne osoby ponownie zużywa transfer. Nowe albumy zwiększą także zapotrzebowanie na miejsce.

## Wariant bez karty

- **Aplikacja:** Cloudflare Workers Free. Oficjalny warsztat wskazuje konto bez karty; limit Workers Free to 100 000 żądań dziennie i 10 ms CPU na żądanie. [Rejestracja](https://developers.cloudflare.com/labs/workers), [limity](https://developers.cloudflare.com/workers/platform/pricing/).
- **Pliki:** Backblaze B2. Rejestracja nie wymaga karty, a pierwsze 10 GB przestrzeni jest bezpłatne. Trzeba wybrać prywatny bucket; darmowa rejestracja nie oznacza dostępu do wszystkich dodatkowych usług. [Rejestracja](https://www.backblaze.com/sign-up/cloud-storage), [cennik](https://www.backblaze.com/cloud-storage/pricing).
- **Transfer:** standardowy bezpłatny transfer B2 wynosi do trzykrotności średniej miesięcznej ilości przechowywanych danych. Przy stałych 0,82 GB daje to około 2,46 GB miesięcznie, czyli zaledwie około trzech pełnych pobrań archiwum. Nie jest to oferta bez limitu oglądania. [Zasady transferu](https://www.backblaze.com/cloud-storage/pricing).
- **Limity konta:** należy sprawdzić Caps & Alerts. Niepłacące konta mają także dzienne limity operacji; ich przekroczenie może blokować żądania. [Opis ograniczeń API](https://www.backblaze.com/apidocs/b2-list-buckets).

B2 opisuje darmowy transfer do Cloudflare i obsługę prywatnych bucketów przez Worker. Nie traktujemy tego jako automatycznej gwarancji darmowego streamingu: zwykły CDN Cloudflare ma ograniczenia dotyczące filmów i dużych plików spoza ich platformy. Przed wdrożeniem trzeba potwierdzić dopuszczony sposób dostarczania mediów. Alternatywa to krótkotrwałe, podpisane adresy B2 po zalogowaniu, z transferem liczonym bezpośrednio w B2. [Integracja B2](https://www.backblaze.com/docs/cloud-storage-deliver-private-backblaze-b2-content-through-cloudflare-cdn), [warunki CDN](https://www.cloudflare.com/service-specific-terms-application-services/).

## Co trzeba jeszcze zrobić

1. Dodać adapter B2 i konfigurację wdrożenia bez bindingu R2. Nie wystarczy zmienić nazwy bucketa w `wrangler.toml`.
2. Zachować autoryzację widza i organizatora, obsługę Range, nazwy pobieranych plików oraz ochronę przed utratą równoległych zmian albumów. Zgodność API S3 nie oznacza identycznych gwarancji warunkowego zapisu jak w R2.
3. Przy podpisanych adresach ograniczyć czas ważności i zakres do jednego pliku. Taki adres można przekazać dalej do czasu wygaśnięcia; klucz magazynu musi pozostać wyłącznie na serwerze.
4. Przetestować logowanie, pobieranie, dodawanie i odtwarzanie na docelowej domenie oraz zmierzyć rzeczywiste zużycie limitów. Bez tego nie ogłaszamy hostingu jako gotowego.
5. Zostawić niezależną lokalną kopię oryginałów. Dodać adres strony do README dopiero po udanym wdrożeniu.

## Pozostałe warianty

| Wariant | Ocena dla tego archiwum |
| --- | --- |
| Cloudflare Pages + R2 | Obsługiwany przez obecny kod. R2 wymaga aktywacji subskrypcji i checkout, więc nie przedstawiamy go jako pewnej opcji bez karty. [Warunki](https://developers.cloudflare.com/r2/get-started/). |
| Vercel Hobby + private Blob | Darmowy Blob obejmuje 1 GB przestrzeni i 10 GB transferu. Obecne pliki mieszczą się, ale zostaje mało miejsca na następne spotkania; przekroczenie limitów blokuje usługę. Wymaga osobnego adaptera i weryfikacji rejestracji bez karty. [Cennik](https://vercel.com/docs/vercel-blob/usage-and-pricing). |
| Supabase Free | Limit pojedynczego pliku 50 MB wyklucza obecne MP4 bez przetworzenia lub podziału. Nie jest bezpośrednim zamiennikiem obecnego magazynu. [Cennik](https://supabase.com/pricing). |

Publiczny katalog z fotografiami i samo okno hasła w JavaScript nie są zamiennikiem prywatnego magazynu. Logo, wzór tła i kod interfejsu mogą być publiczne; oryginały, manifesty i sekrety pozostają prywatne.
