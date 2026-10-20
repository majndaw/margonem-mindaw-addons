# Margonem Bag Tools – kontekst projektu dla Claude Code

Userscript (Tampermonkey) do gry **Margonem**, tylko **nowy interfejs (NI)**.
Plik skryptu: `margonem-bag-tools.user.js` (jeden plik, bez zależności).
Aktualna wersja: **0.15.0** (20.10.2026).

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
   Nie dodawać nieaktywnych przycisków „Wkrótce” ani opcji bez widocznego efektu (prośba użytkownika, 0.15.0).
2. **Każda zmiana w skrypcie = aktualizacja okna „Funkcje”** (okno `help` w tablicy `WINS`):
   - popraw lub dopisz opis w odpowiedniej sekcji (`h-start`, `h-merge`, `h-search`, `h-watch`, `h-loot`,
     `h-keys`, `h-look`, `h-backup`, `h-diag`, `h-soon`, `h-unsure`),
   - dopisz wpis na górze sekcji **Historia zmian** (`h-log`),
   - podbij wersję w **dwóch** miejscach: `// @version` w nagłówku i `const VER`.
3. **Informacje o grze sprawdzaj pod kątem aktualności** – gra często się zmienia, stare wpisy z forum bywają
   nieaktualne. Podawaj, z jakiego okresu jest źródło. Dane z diagnostyki użytkownika (aktualna gra) mają
   pierwszeństwo przed starymi źródłami. Jeśli coś jest niepotwierdzone, napisz to wprost (i dopisz do `h-unsure`).
4. **Akcje wysyłające komendy do serwera** (np. łączenie stosów): spokojne tempo (odstępy 200–600 ms),
   sprawdzenie efektu po każdym kroku, przerwanie przy pierwszym niepowodzeniu, zakres ograniczony
   (otwarta torba / otwarta strona depozytu). Nic nie dzieje się bez kliknięcia lub skrótu użytkownika.
5. **Nowe okna dodawaj przez tablicę `WINS`** – wtedy automatycznie dostają kropki do przesuwania (siatka 3×3),
   przycisk w docku, zwijanie „–”, zamykanie „×” i własną zapamiętaną pozycję. Okna przesuwa się **tylko** kropkami.
6. Po zmianach sprawdź składnię (`node --check margonem-bag-tools.user.js`), a logikę (np. planowanie łączenia)
   testuj w małych skryptach Node na sztucznych danych. W grze testuje użytkownik.

## Architektura skryptu (w kolejności w pliku)

- **Przejmowanie starej wersji:** jeśli istnieje `#mbt-root` z inną wersją, jest usuwany razem ze stylami.
- **Ustawienia:** obiekt `def` (domyślne) i `S` (aktualne), zapis w `localStorage` pod kluczem `mbt-settings-v6`.
  `sv` = wersja schematu ustawień (migracje). Dziennik zdobyczy osobno: `mbt-loot-v1`.
- **`WINS`:** definicje okien: `torba`, `loot` (Zdobycze), `set` (Ustawienia), `help` (Funkcje), `watch`
  (małe okienko obserwowanych, `mini: true`, `dock: false`). Pomocnicze: `sec()` (zwijana sekcja), `chk()`.
- **CSS:** zmienne `--ac` (akcent), `--a` (przezroczystość), `--sc` (skala), `--fs` (czcionka), motywy
  (`--bg`, `--ctl`, `--inp`, `--bd`), klasa `.compact`.
- **`place()` / `apply()` / `view()` / `arrange()`:** pozycje, wygląd, widoczność, układy okien.
- **Dane gry:** `readItems()` → `Engine.items.fetchLocationItems('g')`; `snap()` zwraca przedmioty z numerem torby.
- **Torby:** `layout()`, `detectBag()` (najpierw widoczne węzły `.item.item-id-*`, potem aktywna zakładka w `.bags-navigation`).
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

## Niepotwierdzone (wymaga testu w grze)

- Komenda łączenia `moveitem&st=0…` i częściowe łączenie (gdy cały stos się nie mieści).
- Wykrywanie otwartej torby, nazwy rzadkości (`heroic`, `legendary`…), klasa przeciąganego przedmiotu
  (`ui-draggable-dragging`), dostępność grafiki przedmiotu, sygnały źródła dropów (okno łupu, skrzynki, komendy).
- Upuszczenie przedmiotu na okno dodatku wywoływało w grze pytanie o wyrzucenie/zniszczenie (zgłoszenie użytkownika,
  10.2026, także po 0.14.0). W 0.15.0 puszczenie jest przekierowane na miejsce startu (`release()`) – działa na stronie
  testowej, w grze niepotwierdzone. Sprawdzić linijkę „Ostatnie upuszczenie” w Diagnostyce.

## Następny etap: depozyt (tylko łączenie stosów na OTWARTEJ stronie)

Ustalone (źródła z 2025, sprawdzone 10.2026): do 16 zakładek; po otwarciu depozytu gra ładuje zakładki 1–8,
a 9–16 dopiero po kliknięciu którejś z nich; wbudowana wyszukiwarka widzi tylko załadowane zakładki.
Niepotwierdzone: 112 miejsc na stronę (źródło ~2018), oznaczenie lokalizacji `d` (stary interfejs),
komendy przenoszenia/łączenia w depozycie, możliwość dzielenia stosu w depozycie.

Przed implementacją potrzebne są wyniki dwóch fragmentów konsoli od użytkownika (przy otwartym depozycie):

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

## Odłożone pomysły (wrócić, gdy użytkownik zapyta o pomysły)

- Kompaktowanie luk w torbie; zebranie jednego typu przedmiotów w jednej torbie.
- Sortowanie po nazwie / typie / jakości (nieaktywne przyciski usunięte w 0.15.0 – dodać dopiero działające).
- Auto-łączenie po zdobyciu przedmiotu (tylko jako opcja do włączenia).
- Podświetlanie przedmiotu na siatce po kliknięciu wyniku szukania.
- Filtr po typie przedmiotu (`itemTypeName`), ulubione/ochrona przed łączeniem, statystyki toreb,
  szukanie po poziomie wymaganym.

## Uwaga o zasadach gry

Skrypt nie jest dodatkiem z oficjalnego panelu gry. Regulamin Margonem zakazuje automatyzacji bez zgody
operatora; użytkownik zdecydował, że rozwijamy projekt mimo to. Trzymaj się punktu 4 (tempo, kontrola,
brak działań bez kliknięcia użytkownika).
