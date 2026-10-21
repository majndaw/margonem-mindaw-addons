# Margonem Bag Tools – kontekst projektu dla Claude Code

Userscript (Tampermonkey) do gry **Margonem**, tylko **nowy interfejs (NI)**.
Plik skryptu: `margonem-bag-tools.user.js` (jeden plik, bez zależności).
Aktualna wersja: **0.22.0** (20.10.2026).

Komunikacja z użytkownikiem i cały interfejs skryptu: **po polsku**.
**Instalacja:** w Tampermonkey jest tylko skrypt-ładowacz, który przy każdym wejściu do gry wczytuje
`https://majndaw.github.io/margonem-mindaw-addons/margonem-bag-tools.user.js` (GitHub Pages z gałęzi `main`).
Zmiana zatwierdzona na `main` działa po odświeżeniu gry. Plik musi pozostać poprawnym JS uruchamianym w kontekście strony
(`window.Engine`, `window._g`), bez funkcji `GM_*`. Nie zmieniaj nazwy ani położenia pliku bez poprawienia ładowacza.

**Ładowacz:** `loader.user.js` to kopia (tylko do wglądu) skryptu-ładowacza zainstalowanego w Tampermonkey –
zmiana tego pliku w repozytorium **nie** zmienia ładowacza w grze (użytkownik musi go podmienić ręcznie).
Wczytuje pliki z GitHub Pages z dopiskiem `?v=<czas>` (bez pamięci podręcznej). Nowy dodatek = nowy plik
`*.user.js` w głównym katalogu + dopisanie jego nazwy do tablicy `ADDONS` w ładowaczu (w repo i w Tampermonkey).

## Zasady obowiązkowe

0. **Tryb pracy (decyzja użytkownika, 10.2026):** nie pytać o zgodę na scalenie – po skończeniu zmiany od razu ją
   scalić na `main` (gałąź + PR + scalenie), żeby działała w grze. Opisy PR i odpowiedzi krótkie.

1. **Nigdy nie usuwać, nie sprzedawać i nie wyrzucać przedmiotów.** Żadnych funkcji tego typu
   (przycisk „Usuń zaznaczone” został usunięty w 0.15.0 – nie przywracać).
   Nie dodawać nieaktywnych przycisków ani opcji bez widocznego efektu (prośba użytkownika, 0.15.0).
2. **Każda zmiana w skrypcie = aktualizacja zakładki „Pomoc”** (zakładka `help` w tablicy `TABS`):
   - popraw lub dopisz opis w odpowiedniej sekcji (`h-start`, `h-merge`, `h-search`, `h-watch`, `h-loot`,
     `h-mods`, `h-sort`, `h-depo`, `h-others`, `h-keys`, `h-look`, `h-backup`, `h-diag`, `h-soon`, `h-unsure`),
   - dopisz wpis na górze sekcji **Historia zmian** (`h-log`),
   - podbij wersję w **dwóch** miejscach: `// @version` w nagłówku i `const VER`.
3. **Informacje o grze sprawdzaj pod kątem aktualności** – gra często się zmienia, stare wpisy z forum bywają
   nieaktualne. Podawaj, z jakiego okresu jest źródło. Dane z diagnostyki użytkownika (aktualna gra) mają
   pierwszeństwo przed starymi źródłami. Jeśli coś jest niepotwierdzone, napisz to wprost (i dopisz do `h-unsure`).
4. **Akcje wysyłające komendy do serwera** (np. łączenie stosów): spokojne tempo (odstępy 200–600 ms),
   sprawdzenie efektu po każdym kroku, przerwanie przy pierwszym niepowodzeniu, zakres ograniczony
   (otwarta torba / otwarta strona depozytu). Nic nie dzieje się bez kliknięcia lub skrótu użytkownika.
5. **Nowe funkcje dodawaj jako zakładkę w tablicy `TABS`** (od 0.21.0 jedno główne okno z paskiem ikon po lewej) –
   dostaje przycisk na pasku i własną treść. Osobne okna (`WINS`: `main`, `watch`) tylko gdy naprawdę potrzebne.
   Okna przesuwa się **tylko** kropkami. Wygląd wg projektu zaakceptowanego przez użytkownika (21.10.2026): karty,
   ikony liniowe SVG (`ICONS`, `ic()`), **bez paska stanu** – na dole okna tylko czerwony pasek błędu (`errBar`).
6. Po zmianach sprawdź składnię (`node --check margonem-bag-tools.user.js`), a logikę (np. planowanie łączenia)
   testuj w małych skryptach Node na sztucznych danych. W grze testuje użytkownik.

## Architektura skryptu (w kolejności w pliku)

- **Przejmowanie starej wersji:** jeśli istnieje `#mbt-root` z inną wersją, jest usuwany razem ze stylami.
- **Ustawienia:** obiekt `def` (domyślne) i `S` (aktualne), zapis w `localStorage` pod kluczem `mbt-settings-v6`.
  `sv` = wersja schematu ustawień (migracje). Dziennik zdobyczy osobno: `mbt-loot-v1`.
- **Interfejs (0.21.0):** `TABS` – zakładki głównego okna: `torba`, `depo`, `watch` (zarządzanie obserwowanymi), `loot`,
  `set`, `help`; `S.tab` = otwarta zakładka, pasek `[data-go]`, przycisk ukrywania graczy `[data-act=others]` na pasku.
  `WINS` – okna: `main` (520 px) i `watch` (małe okienko, `mini`). Pozycje: `S.pos.main`, `S.pos.watch`, `S.pos.dock` (ikona
  „M Mindaw” po zamknięciu). `sec()` = karta z tytułem (zwijana, `S.fold`), `chk()` = przełącznik, `ic(n)` = ikona SVG.
  Pasek błędu: `errBar(tytuł, opis)` / `errHide()`; `say()`/`dsay()` same wykrywają błąd (`ERR_RE`) i pokazują pasek.
  `busyUI()` zmienia przyciski sortowania/łączenia na „Zatrzymaj”. Wyniki szukania: `renderFind()` (lista, `S.lastFind`).
  Karta torby: `updateNote()`; karta depozytu: `depoInfo()`; postęp łączenia w depozycie: `depoProg()`.
- **Dodatki osobno (0.22.0, prośba użytkownika):** `MODS` (torba, depo, watch, loot, others), stan `S.mods`, `on(id)`,
  `tabOn(tab)`; zakładka `mods` („Dodatki”, karty `[data-mod]`). Wyłączony dodatek nie działa wcale: znika z paska
  i okna, jego `watchTick`/`lootTick`/`sigTick`/`hookOthers` nie są wywoływane, skróty Torby odmawiają. Ukrywanie graczy
  domyślnie wyłączone (bez nakładki na `parseJSON`, póki nie zainstalowane). Nowy dodatek = wpis w `MODS` + zakładka/
  funkcje sprawdzające `on(id)`. Pierwsze uruchomienie z tą wersją (`firstMods`) otwiera listę dodatków.
- **CSS:** zmienne `--ac` (akcent), `--a` (przezroczystość), `--sc` (skala), `--fs` (czcionka), motywy
  (`--bg`, `--card`, `--card2`, `--inp`, `--bd`, `--bd2`, `--rail`), klasa `.compact`. Schemat ustawień `sv: 3`.
- **`place()` / `apply()` / `view()` / `arrange()`:** pozycje, wygląd, widoczność, układy okien.
- **Dane gry:** `readItems()` → `Engine.items.fetchLocationItems('g')`; `snap()` zwraca przedmioty z numerem torby.
- **Torby:** `layout()`, `detectBag()` (najpierw widoczne węzły `.item.item-id-*`, potem aktywna zakładka w `.bags-navigation`).
- **Przełączniki:** `chk(opt, napis)` tworzy przycisk `.tg[data-tg=opt]` (stan w `S[opt]`, malowanie `paintToggles()`).
  **Nie używać `<input type="checkbox">`** – gra anuluje domyślne działanie kliknięć, pola wyboru „migały” i nie działały.
  Przyciski z rysunkiem w środku (logo) obsługiwać przez `closest('[data-…]')`, nie `e.target.dataset`.
- **Sortowanie:** `sortPlan()` (czysta funkcja: miejsce j dostaje j-ty przedmiot, przeniesienia tylko na wolne pola,
  ≤ 2 ruchy na przedmiot, wymaga 1 wolnego pola) i `sortBag()` / `sortDepo()` przez wspólne `runSort()` (komenda `moveitem&st=0&id&x&y`, `waitPos()` po każdym
  kroku co 50 ms, przerwanie przy pierwszym błędzie, przerwa 200 ms, zatrzymanie kolejnym kliknięciem).
  `send()` nie czeka na odpowiedź zwrotną `_g` (czekanie dawało do 4 s na krok – użytkownik: „bardzo wolne”). Test: 6000 losowych toreb.
- **Szukanie:** `find()` (bez polskich znaków przez `norm()`, kilka słów, historia, filtr rzadkości), `dups()`.
- **Łączenie:** `buildPlan()` (największy niepełny stos dobiera od najmniejszych do limitu `capacity`)
  i `merge()` (komenda `moveitem&st=0&id=…&x=…&y=…`, kontrola `waitGrow()` po każdym kroku).
- **Obserwowane:** `watchTick()`, progi `warn` i `watchCrit`, napisy `toast()`, dodawanie: nazwa, `addFromItem()`
  (przeciągnięcie na `.wslot` lub tryb „Wskaż w grze” `setPick()`), ikony `iconSrc()` / `paintIcons()`.
  Przeciąganie: `press` = przedmiot wciśnięty myszą (nasłuch `mousedown` w fazie capture, tylko obserwacja), ruch > 6 px
  = przeciąganie. **Nie** szukać przeciąganego przedmiotu po klasie `[class*="drag"]` – każdy przedmiot ma `ui-draggable`
  (błąd z 0.13: zawsze wybierał pierwszy przedmiot z ekwipunku). `noteDrop()` zapisuje reakcję gry do Diagnostyki.
  `release()` (nasłuch `pointerup`/`mouseup` na `window`, capture): puszczenie przeciąganego przedmiotu nad oknem
  dodatku jest zatrzymywane, a grze wysyłane są sztuczne `pointermove/mousemove/pointerup/mouseup` w miejscu, skąd
  przedmiot wzięto (przedmiot wraca na miejsce zamiast „na ziemię”). Flaga `replay` chroni przed własną obsługą.
  Wiersze małego okienka przebudowywane tylko przy zmianie HTML (inaczej giną kliknięcia w ✕).
- **Okna:** `place()` liczy `max-height` treści z pozycji okna i skali (dół okna zawsze na ekranie). Suwaki skali
  i czcionki zapisują wartość na `change` (po puszczeniu) – na `input` okno zmieniało rozmiar pod kursorem i suwak skakał.
- **Zdobycze:** `lootTick()`, `addLoot()`, `renderLoot()`; źródło dropu z sygnałów `sigTick()` (okna) i `noteCmd()`
  (obserwacja `_g` przez `hookG()`); tryb ścisły / luźny (`lootLoose`). Liczy heroiki, legendy, smocze runy.
- **Ukrywanie graczy (0.20.0):** ikona ludzi na pasku zakładek (`data-act="others"`, `S.hideOthers`). `hookOthers()`
  owija `Engine.communication.parseJSON` i czyści pole `other` (wg skryptu użytkownika „usuwacz innych”, 10.2026).
  Flaga `window.__mbtHideOthers` – nowa wersja skryptu steruje nakładką starszej. Tylko wygląd, bez komend.
  Niepotwierdzone: czy gracze już widoczni znikają od razu (zakładamy: po zmianie mapy / odświeżeniu).
- **`diag()`:** Diagnostyka – pierwsza rzecz do poproszenia, gdy coś nie działa.
- **Kopia ustawień:** eksport/import JSON (`importSettings()` waliduje dane).
- **Skróty:** tablica `ACTIONS` (toggle, merge, find); nagrywanie 1–3 klawiszy; nowe akcje dopisuj do `ACTIONS`.

## Fakty potwierdzone diagnostyką użytkownika (październik 2026)

- `window.Engine.items.fetchLocationItems('g')` zwraca przedmioty ekwipunku (loc `g`), `window._g` to funkcja.
- Pola przedmiotu m.in.: `id, name, tpl, loc, st, x, y, cl, stat, _cachedStats, $` oraz metody
  (`getAmount`, `issetAmountStat`, `issetLootboxStat`, `canSplit`…).
- `st`: 0 = plecak (torby), 1–9 = założony ekwipunek, 20–22 = torby 1–3.
- Siatka toreb ma 7 kolumn; torba k (0, 1, 2) zaczyna się od rzędu `6·k`; pojemność torby ze statystyki `bag=`.
- Stosy mają `amount=` i limit `capacity=` (np. `capacity=10`).
- `item.$` jest odłączonym elementem (nie leży w oknie gry); w DOM są węzły `.item.item-id-<id>` oraz `.bags-navigation`.

- **Depozyt (wynik „Zbadaj” + nagranie użytkownika, 20.10.2026):** przedmioty w `fetchLocationItems('d')`, `st=0`,
  strona ma 14 kolumn (x 0–13); okno gry `.depo`, zakładki `.card` (aktywna `.card.active`), licznik
  `.available-slots-current`. Komendy: `depo&move=ID&x&y` (w depozycie), `depo&get=ID&x&y` (depozyt → torba, x/y torby),
  `depo&put=ID&x&y` (torba → depozyt); id przedmiotu się nie zmienia. **W depozycie stosów nie da się łączyć**
  (`depo&move` na stos nic nie robi). Branie/odkładanie darmowe, bez limitu (użytkownik). Konto testowe ma 1 stronę.

## Niepotwierdzone (wymaga testu w grze)

- Komenda łączenia `moveitem&st=0…` i częściowe łączenie (gdy cały stos się nie mieści).
- Wykrywanie otwartej torby, nazwy rzadkości (`heroic`, `legendary`…), klasa przeciąganego przedmiotu
  (`ui-draggable-dragging`), dostępność grafiki przedmiotu, sygnały źródła dropów (okno łupu, skrzynki, komendy).
- Upuszczenie przedmiotu na okno dodatku wywoływało w grze pytanie o wyrzucenie/zniszczenie (zgłoszenie użytkownika,
  10.2026, także po 0.14.0). W 0.15.0 puszczenie jest przekierowane na miejsce startu (`release()`) – działa na stronie
  testowej, w grze niepotwierdzone. Sprawdzić linijkę „Ostatnie upuszczenie” w Diagnostyce.

## Depozyt: łączenie (0.18.0) i dalsze plany

`depoMerge()`: grupy = niepełne identyczne stosy z limitem, **widoczne na ekranie** (`visibleIds()`), ≥ 2 sztuki.
Dla każdej grupy: `depo&get` na wolne pola torby → `stackSteps()` + `moveitem` w torbie → `depo&put` na pierwotne
pola (także po błędzie). Sprawdzenie po każdym kroku (`waitFor`, 50 ms, do 3 s), przerwa 200 ms, przerwanie przy
pierwszym błędzie, zatrzymanie kolejnym kliknięciem między grupami. Niepotwierdzone w grze: całość (test na stronie
testowej); numeracja pól przy wielu stronach. **Potwierdzone w grze przez użytkownika (20.10.2026): „działa od razu”.**

`sortDepo()` (0.19.0; od 0.20.0 tylko „po jakości” – prośba użytkownika): `depoPage()` bierze przedmioty widoczne na ekranie, wyznacza prostokąt strony 14×8
(`DCOLS`, `DROWS`; 8 rzędów wynika z licznika 89 wolnych + 23 przedmioty = 112) i odmawia, gdy przedmioty się w nim
nie mieszczą albo leży w nim coś niewidocznego. Plan: `sortPlan()` z `b.cols`/`b.x0`; wykonanie: wspólne `runSort()`
(torba: `moveitem`, depozyt: `depo&move=ID&x&y` na wolne pole – potwierdzone nagraniem).

Ustalone (źródła z 2025, sprawdzone 10.2026): do 16 zakładek; po otwarciu depozytu gra ładuje zakładki 1–8,
a 9–16 dopiero po kliknięciu którejś z nich; wbudowana wyszukiwarka widzi tylko załadowane zakładki.
Niepotwierdzone: 112 miejsc na stronę (źródło ~2018), oznaczenie lokalizacji `d` (stary interfejs),
komendy przenoszenia/łączenia w depozycie, możliwość dzielenia stosu w depozycie.

**Od 0.17.0** okno 🧰 Depozyt robi to samo bez konsoli: „Zbadaj depozyt” (`depoStudy()`: liczby przedmiotów we wszystkich
lokacjach a–z, próbka, rozkład x/y/st, powtórzone stosy, klucze `Engine` z „dep”, klasy i HTML okna depozytu) oraz
„Nagrywaj” (`depoRec()`: komendy `_g` + zmiany loc/x/y/st/ilości wszystkich przedmiotów co 0,4 s). Oba tylko czytają.
Prośba użytkownika (10.2026): łączyć identyczne stosy na otwartej stronie depozytu; jeśli w depozycie się nie da –
przenosić je przez 1. torbę (komunikat, ile wolnych miejsc potrzeba), łączyć do limitu i odkładać po kolei do depozytu.
Implementować dopiero po wyniku „Kopiuj wynik” z gry. Starsze fragmenty konsoli (zapasowo):

```js
// 1) Gdzie leżą przedmioty depozytu i jak wygląda strona
(() => {
  const E = window.Engine, res = {};
  ['g','d','s','n','t','a','c','e','b','l','p','m','k','r','u'].forEach(loc => {
    try { const l = E.items.fetchLocationItems(loc), a = Array.isArray(l) ? l : Object.values(l || {}); res[loc] = a.length; } catch { res[loc] = 'błąd'; }
  });
  console.log('Przedmioty wg loc:', JSON.stringify(res));
  try {
    const l = E.items.fetchLocationItems('d'), a = Array.isArray(l) ? l : Object.values(l || {});
    console.log('Próbka depo:', JSON.stringify(a.slice(0, 6).map(i => ({ id: i.id, name: i.name, x: i.x, y: i.y, st: i.st, loc: i.loc, stat: i.stat }))));
    const ys = {}; a.forEach(i => { ys[i.y] = (ys[i.y] || 0) + 1; });
    console.log('Rozkład y:', JSON.stringify(ys));
  } catch {}
  console.log('Okna depozytu:', [...document.querySelectorAll('[class*="depo" i]')].slice(0, 30).map(n => n.tagName + '.' + String(n.className).slice(0, 120)));
})();
```

```js
// 2) Nagrywanie komend przy ręcznych akcjach w depozycie (na bezwartościowych przedmiotach)
(() => {
  if (window.__rec) return console.log('już włączone');
  window.__rec = [];
  const log = (k, v) => { const s = k + ' ' + String(v).slice(0, 300); window.__rec.push(s); console.log('[rec]', s); };
  const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) { log('XHR ' + this.__u, b || ''); return xs.apply(this, arguments); };
  const of = window.fetch;
  if (of) window.fetch = function (u, o) { log('FETCH ' + ((u && u.url) || u), (o && o.body) || ''); return of.apply(this, arguments); };
  const og = window._g;
  if (typeof og === 'function') window._g = function (...a) { log('_g', a[0]); return og.apply(this, a); };
  console.log('Nagrywanie włączone. Po akcjach wpisz: copy(window.__rec.filter(x => /depo|moveitem|item/i.test(x)).join("\\n"))');
})();
```

Wyniki wklejone przez użytkownika: przed użyciem usuń z nich wszystko, co wygląda na dane logowania lub klucze sesji.

## Przycisk Mindaw w pasku przycisków gry (prośba użytkownika, 21.10.2026)

Użytkownik chce przycisk dodatku w pasku przycisków gry (jak questy, mapa), przesuwany jak przyciski gry (inny róg itp.).
Brak publicznego opisu API (wyszukiwanie 21.10.2026 nic nie dało; wyszukiwanie kodu GitHub zablokowane w sesji).
0.21.1: Ustawienia → „Przycisk w pasku gry – badanie” (`uiStudy()`, tylko odczyt: klucze `Engine` z widget/button/…,
elementy z „widget” w klasie, ich położenie i rodzice, localStorage z widget/pos/layout, ostatnie komendy). Użytkownik
robi badanie przed i po przesunięciu przycisku gry. **Implementować dopiero po wyniku z gry.**

## Odłożone pomysły (wrócić, gdy użytkownik zapyta o pomysły)

- Kompaktowanie luk w torbie; zebranie jednego typu przedmiotów w jednej torbie.
- Auto-łączenie po zdobyciu przedmiotu (tylko jako opcja do włączenia).
- Podświetlanie przedmiotu na siatce po kliknięciu wyniku szukania.
- Filtr po typie przedmiotu (`itemTypeName`), ulubione/ochrona przed łączeniem, statystyki toreb,
  szukanie po poziomie wymaganym.

## Uwaga o zasadach gry

Skrypt nie jest dodatkiem z oficjalnego panelu gry. Regulamin Margonem zakazuje automatyzacji bez zgody
operatora; użytkownik zdecydował, że rozwijamy projekt mimo to. Trzymaj się punktu 4 (tempo, kontrola,
brak działań bez kliknięcia użytkownika).
