// ==UserScript==
// @name         Margonem Bag Tools
// @namespace    margonem-bag-tools
// @version      0.16.0
// @description  Torba: szukanie, łączenie stosów, obserwowanie przedmiotów, dziennik zdobyczy (Margonem NI)
// @match        https://www.margonem.pl/*
// @match        https://*.margonem.pl/*
// @run-at       document-idle
// @grant        none
// @homepageURL  https://github.com/majndaw/margonem-mindaw-addons
// ==/UserScript==

(() => {
  'use strict';
  const VER = '0.16.0';
  // nowa wersja przejmuje GUI po starej (stare okno i style są usuwane)
  const prev = document.getElementById('mbt-root');
  if (prev) { if (prev.dataset.v === VER) return; prev.remove(); }
  document.querySelectorAll('style').forEach(s => { if (s.dataset.mbt || (s.textContent || '').includes('#mbt-root')) s.remove(); });

  /* ---------- ustawienia ---------- */
  const KEY = 'mbt-settings-v6';
  const COLORS = ['#00e676', '#1e88e5', '#c62828', '#d2782f', '#8e30e0', '#ec4fb8', '#aab2b8'];
  const THEMES = {
    ciemny: { n: 'Ciemny', bg: '9,15,16', ctl: '#162021', inp: '#101819', bd: '#2f3d3e' },
    czarny: { n: 'Czarny', bg: '0,0,0', ctl: '#0e0e0e', inp: '#080808', bd: '#2b2b2b' },
    grafit: { n: 'Grafit', bg: '24,26,30', ctl: '#252a31', inp: '#1b1f24', bd: '#3b424b' },
    granat: { n: 'Granat', bg: '10,16,34', ctl: '#14203f', inp: '#0d1630', bd: '#2c3c6e' },
  };
  const def = {
    sv: 2, alpha: 70, scale: 80, accent: 0, theme: 'ciemny', compact: false, font: 14, dock: false,
    showCount: true, verified: false, lootToast: true, lootLoose: false,
    watch: [], watchShow: true, watchCrit: 50, watchRemind: 0,
    pos: { dock: [20, 100], torba: [162, 100], set: [733, 100], loot: [300, 140], help: [350, 120], watch: [1125, 100] },
    open: { torba: false, set: false, loot: false, help: false, watch: false }, min: {}, fold: { 'h-log': true },
    history: [], rar: [], last: '',
    keys: { toggle: ['Alt', 'KeyT'], merge: ['Alt', 'KeyQ'], find: ['Alt', 'KeyF'] },
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  const S = Object.assign({}, def, saved);
  if ((saved.sv || 0) < 2) { S.scale = def.scale; S.sv = 2; }       // nowy, mniejszy domyślny rozmiar
  for (const k of ['pos', 'open', 'keys', 'min', 'fold']) S[k] = Object.assign({}, def[k], S[k] || {});
  if (!Array.isArray(S.history)) S.history = [];
  if (!Array.isArray(S.rar)) S.rar = [];
  S.watch = (Array.isArray(S.watch) ? S.watch : []).filter(w => w && typeof w.name === 'string');
  if (!THEMES[S.theme]) S.theme = 'ciemny';
  // opcje usunięte w 0.15.0 (pozycja jest zawsze zapamiętywana, dock wraca w stanie sprzed odświeżenia)
  ['round', 'shadow', 'remember', 'onTop', 'minIcon', 'openStart', 'notify', 'sound', 'counter', 'hideAfter'].forEach(k => { delete S[k]; });
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  };

  /* ---------- definicje okien (każde nowe okno dostaje kropki do przesuwania) ---------- */
  const sec = (id, title, inner) =>
    `<div class="sec" data-sec="${id}"><h4 data-fold="${id}"><span>${title}</span><i class="chev">▾</i></h4><div class="sc">${inner}</div></div>`;
  // własny przełącznik zamiast pola wyboru: gra anuluje domyślne działanie kliknięć, przez co kwadraty „migały” i wracały
  const chk = (opt, label) => `<button type="button" class="tg" data-tg="${opt}"><i></i><span>${label}</span></button>`;

  const WINS = [
    {
      id: 'torba', icon: '👜', title: 'Torba', w: 555,
      html:
        sec('merge', 'Łączenie przedmiotów',
          `<button class="b main" id="mbt-merge" title="Łączy identyczne stosy w otwartej torbie do limitu stosu">⛓ &nbsp;Połącz identyczne</button>
           <div class="hint" id="mbt-bagnote">–</div>`) +
        sec('search', 'Szukaj przedmiotu',
          `<input class="s" id="mbt-search" placeholder="Wpisz nazwę przedmiotu..." title="Polskie znaki nie są wymagane. Kilka słów = wszystkie muszą pasować.">
           <div class="chips" id="mbt-hist"></div>
           <div class="chips" id="mbt-rar"></div>
           <div class="r"><button class="b" id="mbt-find" title="Szuka we wszystkich torbach">Szukaj</button>
             <button class="b" id="mbt-clear" title="Czyści pole, filtry i wynik">Wyczyść</button></div>
           ${chk('showCount', 'Pokaż liczbę sztuk')}`) +
        sec('watch', 'Obserwowane przedmioty',
          `<div class="r"><input class="s" id="mbt-wname" placeholder="Nazwa przedmiotu do obserwowania..." title="Wpisz fragment nazwy i kliknij Szukaj"><button class="b" id="mbt-wfind" style="flex:none">Szukaj</button></div>
           <div class="r"><button class="b" data-wtarget="1" title="Kliknij ten przycisk, a potem przedmiot w torbie w grze">🎯 Wskaż przedmiot w grze</button></div>
           <div class="chips" id="mbt-wpick"></div>
           <div id="mbt-wlist"></div>
           ${chk('watchShow', 'Pokaż małe okienko obserwowanych')}
           <div class="r"><span>Czerwony alert, gdy ilość spadnie do (% progu)</span><input class="s n" type="number" id="mbt-wcrit" min="1" max="99"></div>
           <div class="r"><span>Przypominaj co (s), 0 = nie</span><input class="s n" type="number" id="mbt-wremind" min="0" max="3600"></div>
           <div class="r"><button class="b" data-wtest="1" title="Pokazuje przykładowe napisy na środku ekranu">Pokaż test napisów</button></div>`) +
        sec('sort', 'Sortowanie (otwarta torba)',
          `<div class="r"><button class="b" data-sort="name" title="Alfabetycznie">A↓Z Po nazwie</button><button class="b" data-sort="type" title="Według rodzaju przedmiotu">Po typie</button><button class="b" data-sort="qual" title="Od najrzadszych">★ Po jakości</button></div>
           <div class="note">Przestawia przedmioty tylko w otwartej torbie, po jednym, i sprawdza każdy krok. Potrzebne jest 1 wolne miejsce w torbie. Kliknięcie dowolnego przycisku w trakcie zatrzymuje sortowanie.</div>`) +
        sec('extra', 'Dodatkowe funkcje',
          `<div class="r"><button class="b" id="mbt-dups" title="Pokazuje powtarzające się przedmioty w otwartej torbie">⧉ Pokaż duplikaty</button>
             <button class="b" id="mbt-diag" title="Informacje techniczne do zgłaszania problemów">🔍 Diagnostyka</button></div>`) +
        `<div class="out" id="mbt-out"></div>`,
    },
    {
      id: 'loot', icon: '🎁', title: 'Zdobycze', w: 420,
      html:
        sec('loot', 'Dropy: heroiki, legendy, smocze runy',
          `<div class="note">Liczy tylko przedmioty z potworów (e2, kolosy, tytani, herosi itp.) i ze skrzynek – nie z handlu, aukcji ani depozytu. Licznik „Dziś” liczy od 00:00. Dane są wspólne dla postaci na tym świecie.</div>
           <div class="chips" id="mbt-lootsum"></div>
           <div class="logbox" id="mbt-lootlog"></div>
           ${chk('lootToast', 'Pokazuj napis na środku ekranu po dropie')}
           ${chk('lootLoose', 'Tryb luźny: licz też, gdy nie da się ustalić źródła')}
           <div class="r"><button class="b" id="mbt-lootclear">Wyczyść dziennik</button></div>`),
    },
    {
      id: 'set', icon: '⚙', title: 'Ustawienia', w: 470,
      html:
        sec('look', 'Wygląd okna',
          `<div class="r"><span>Przezroczystość okna</span></div>
           <div class="r"><input type="range" id="mbt-alpha" min="35" max="100"><b id="mbt-alpha-l" style="flex:none;width:45px"></b></div>
           <div class="r"><span style="flex:none">Skala interfejsu</span><input type="range" id="mbt-scale" min="40" max="130"><b id="mbt-scale-l" style="flex:none;width:45px"></b></div>
           <div class="r"><span style="flex:none">Rozmiar czcionki</span><input type="range" id="mbt-font" min="11" max="18"><b id="mbt-font-l" style="flex:none;width:45px"></b></div>
           <div class="r"><span style="flex:none">Kolor akcentów</span><div class="sw" id="mbt-sw"></div></div>
           <div class="r"><span style="flex:none">Motyw</span>${Object.entries(THEMES).map(([k, v]) => `<button class="b" data-theme="${k}">${v.n}</button>`).join('')}</div>
           ${chk('compact', 'Tryb kompaktowy (mniejsze odstępy)')}
           <div class="r"><span style="flex:none">Układ okien</span></div>
           <div class="r"><button class="b" data-layout="reset" title="Przywraca domyślne pozycje">Reset</button>
             <button class="b" data-layout="row" title="Okna jedno obok drugiego, od docka">Obok siebie</button></div>`) +
        sec('keys', 'Skróty klawiszowe',
          `<div id="mbt-keys"></div>
           <div class="note">Kliknij skrót i naciśnij 1, 2 lub 3 klawisze naraz. Esc – anuluj. Skrótów przeglądarki (np. Ctrl+W) nie da się przejąć.</div>
           <div class="note" id="mbt-keynote"></div>
           <div class="r"><button class="b" id="mbt-keysreset">Przywróć domyślne skróty</button></div>`) +
        sec('backup', 'Kopia ustawień',
          `<div class="r"><button class="b" id="mbt-exp" title="Kopiuje ustawienia jako tekst">Eksportuj do schowka</button><button class="b" id="mbt-imp" title="Wczytuje ustawienia z pola poniżej">Importuj z pola</button></div>
           <textarea class="s" id="mbt-io" rows="4" placeholder="Tu pojawi się wyeksportowany tekst. Do importu wklej tu kopię."></textarea>
           <div class="note" id="mbt-ionote"></div>`),
    },
    {
      id: 'help', icon: '📖', title: 'Funkcje', w: 480,
      html: `<div class="help">` +
        sec('h-start', 'Podstawy obsługi',
          `<ul>
            <li><b>Dock</b> (pionowy pasek z ikonami) otwiera okna: Torba, Zdobycze, Ustawienia, Funkcje i małe okienko Obserwowane. Depozyt jest w przygotowaniu.</li>
            <li><b>Kropki</b> w rogu okna (siatka 3×3) służą do przesuwania – tylko one. Każde okno przesuwasz osobno, a dock i ikonę ▣ też.</li>
            <li><b>–</b> zwija okno do paska tytułu, <b>×</b> zamyka. Kliknięcie w nagłówek sekcji zwija ją (stan jest zapamiętywany).</li>
            <li>Kliknięte okno wychodzi na wierzch. Przyciski „Reset” i „Obok siebie” (układa otwarte okna, a gdy brakuje miejsca – kaskadą) w Ustawieniach szybko układają okna. Okno nie wyjdzie za krawędź ekranu. Pozycje okien są zawsze zapamiętywane.</li>
            <li>Po zamknięciu docka zostaje małe <b>logo plecaka</b> – kliknij je, żeby wrócić. Po odświeżeniu gry dock jest otwarty albo zamknięty tak, jak go zostawiłeś.</li>
            <li>Numer wersji widać przy tytule okna Torba. Nowa wersja skryptu sama zastępuje starą (stare okno jest usuwane); ustawienia zostają.</li>
            <li><b>Ładowanie z GitHuba:</b> w Tampermonkey jest tylko mały skrypt-ładowacz, który przy każdym wejściu do gry wczytuje najnowszą wersję z GitHub Pages (majndaw.github.io/margonem-mindaw-addons). Zmiana w repozytorium działa po odświeżeniu gry, zwykle po kilku minutach od zapisania.</li>
          </ul>`) +
        sec('h-merge', 'Łączenie identycznych stosów',
          `<ul>
            <li>Przycisk <b>Połącz identyczne</b> (lub Alt+Q) działa <b>tylko w otwartej torbie</b> – tej, którą masz aktualnie otwartą w grze. Pod przyciskiem widzisz, którą torbę skrypt wykrył.</li>
            <li>Łączy te same przedmioty o takich samych statystykach. Największy stos napełnia do limitu, a reszta zostaje w ostatnim stosie. Przykład: stosy 7, 4, 7 przy limicie 15 dadzą 15 i 3; stosy 9 i 9 przy limicie 10 dadzą 10 i 8.</li>
            <li>Po każdym kroku skrypt sprawdza, czy stos faktycznie urósł. Jeśli pierwsze łączenie nie zadziała, przerywa i nic dalej nie robi.</li>
            <li>Wynik pokazuje, co z czego powstało (np. „7, 7, 4 → 15, 3”). Skrypt <b>nigdy nie usuwa, nie sprzedaje i nie wyrzuca</b> przedmiotów.</li>
          </ul>`) +
        sec('h-sort', 'Sortowanie torby',
          `<ul>
            <li>Przyciski <b>Po nazwie</b>, <b>Po typie</b> i <b>Po jakości</b> (okno Torba) układają przedmioty <b>tylko w otwartej torbie</b>, od lewego górnego rogu, bez luk. Jakość: od artefaktów i legend do pospolitych.</li>
            <li>Skrypt przenosi przedmioty po jednym, wyłącznie na wolne miejsca, i po każdym kroku sprawdza, czy przedmiot trafił na miejsce. Przy pierwszym niepowodzeniu przerywa. Potrzebne jest co najmniej <b>1 wolne miejsce</b> w torbie.</li>
            <li>Kliknięcie dowolnego przycisku sortowania w trakcie – zatrzymuje. Nic nie jest łączone, usuwane ani wyrzucane.</li>
          </ul>`) +
        sec('h-search', 'Szukanie przedmiotów',
          `<ul>
            <li><b>Szukaj</b> (lub Alt+F, potem Enter) przeszukuje <b>wszystkie torby</b> i pokazuje, gdzie leży przedmiot, np. „Torba 1 (4 szt.) i Torba 2 (2 szt.)”.</li>
            <li>Polskie znaki nie są potrzebne („zwoj” znajdzie „Zwój”). Kilka słów oznacza, że wszystkie muszą pasować.</li>
            <li>Pod polem są <b>ostatnie hasła</b> (klik = szukaj ponownie) oraz <b>przyciski rzadkości</b> – pojawiają się dla rzadkości, które masz w plecaku. Można szukać samą rzadkością, bez nazwy.</li>
            <li>Przełącznik <b>Pokaż liczbę sztuk</b> dopisuje do wyników łączną ilość w każdej torbie. Ostatni wynik szukania jest zapamiętywany i wraca po odświeżeniu gry.</li>
            <li><b>Pokaż duplikaty</b> wypisuje przedmioty, które w otwartej torbie leżą w kilku stosach. <b>Wyczyść</b> kasuje pole, filtry i wynik.</li>
          </ul>`) +
        sec('h-watch', 'Obserwowane przedmioty',
          `<ul>
            <li>Dodajesz przedmiot na 3 sposoby: wpisując nazwę (Szukaj → klik w wynik), przyciskiem <b>🎯 Wskaż w grze</b> (klikasz przedmiot w torbie – nie zostanie użyty) albo <b>przeciągając</b> go z torby na ramkę w małym okienku „Obserwowane”. Dodać można tylko przedmioty z torby (nie założone).</li>
            <li>Przedmiot upuszczony na <b>dowolne okno dodatku</b> wraca na swoje miejsce w torbie (gra dostaje „puszczenie” w miejscu, skąd go wzięto) – nie powinno się już pojawiać pytanie o wyrzucenie lub zniszczenie. Gdyby jednak się pojawiło, <b>anuluj</b> je i wklej wynik Diagnostyki.</li>
            <li><b>✕</b> przy przedmiocie w małym okienku (albo w oknie Torba) przestaje go obserwować – przedmiot w torbie zostaje nietknięty.</li>
            <li>Małe okienko pokazuje grafikę przedmiotu, jego nazwę i <b>łączną ilość ze wszystkich toreb</b> (suma sztuk, nie liczba stosów).</li>
            <li>Dla każdego przedmiotu ustawiasz <b>próg</b> (domyślnie 50). Gdy ilość spadnie poniżej progu, na środku ekranu pojawia się <b style="color:#ffd400">żółty napis</b>. Gdy spadnie do wybranego procentu progu (domyślnie 50%), napis jest <b style="color:#ff3b30">czerwony</b>.</li>
            <li>Możesz ustawić przypomnienie co N sekund (0 = tylko raz). Przycisk <b>Pokaż test napisów</b> pokazuje oba napisy bez czekania.</li>
            <li>Przedmioty rozpoznawane są po nazwie. Okienko otwierasz i zamykasz przyciskiem <b>👁 Obserwowane</b> w docku (albo przełącznikiem w oknie Torba), zamkniesz je też ×.</li>
          </ul>`) +
        sec('h-loot', 'Zdobycze (dziennik dropów)',
          `<ul>
            <li>Zapisuje <b>heroiki, legendy i smocze runy</b>, które wypadły z potworów (e2, kolosy, tytani, herosi itp.) lub ze skrzynek. Przedmioty z handlu, aukcji, depozytu, sklepu i poczty są pomijane.</li>
            <li>Licznik <b>„Dziś”</b> liczy od 00:00. Poniżej jest podsumowanie ostatnich 7 dni i lista ostatnich dropów z nazwą postaci.</li>
            <li>Źródło przedmiotu ustalane jest z otwartego okna łupu, otwarcia skrzynki i obserwowanych komend gry. <b>Tryb ścisły</b> (domyślny) liczy tylko potwierdzone dropy; <b>tryb luźny</b> liczy też te o nieustalonym źródle.</li>
            <li>Dane są wspólne dla postaci na jednym świecie (na innych światach dziennik jest osobny). Opcjonalnie pokazuje napis na środku ekranu po dropie.</li>
          </ul>`) +
        sec('h-keys', 'Skróty klawiszowe',
          `<ul>
            <li>Domyślnie: <b>Alt+T</b> – otwórz/zamknij dock, <b>Alt+Q</b> – połącz identyczne, <b>Alt+F</b> – szukaj.</li>
            <li>W Ustawieniach kliknij skrót i naciśnij 1, 2 lub 3 klawisze naraz – zapisze się po puszczeniu. Esc anuluje, ✕ usuwa. Skrót zajęty przez inną akcję zostaje jej odebrany.</li>
            <li>Skróty bez Alt/Ctrl nie działają, gdy piszesz w polu tekstowym. Skrótów przeglądarki (np. Ctrl+W) nie da się przejąć.</li>
          </ul>`) +
        sec('h-look', 'Wygląd i ustawienia',
          `<ul>
            <li><b>Skala interfejsu</b> 40–130% (domyślnie 80%), <b>rozmiar czcionki</b>, <b>przezroczystość</b>, 7 kolorów akcentu, 4 motywy tła i tryb kompaktowy.</li>
            <li>Skala i rozmiar czcionki zmieniają się <b>po puszczeniu suwaka</b> (w trakcie widać tylko liczbę) – dzięki temu suwak nie ucieka spod kursora.</li>
            <li>Wysokość okna dopasowuje się do miejsca na ekranie – gdy treść się nie mieści, przewiń ją kółkiem myszy.</li>
          </ul>`) +
        sec('h-backup', 'Kopia ustawień',
          `<ul>
            <li><b>Eksportuj do schowka</b> zamienia ustawienia (okna, skróty, obserwowane, historię) w tekst. <b>Importuj z pola</b> wczytuje taki tekst – przydatne przy nowej przeglądarce lub po reinstalacji.</li>
            <li>Dziennik zdobyczy nie jest częścią kopii ustawień.</li>
          </ul>`) +
        sec('h-diag', 'Diagnostyka',
          `<ul>
            <li>Przycisk <b>🔍 Diagnostyka</b> (okno Torba) wypisuje informacje techniczne: wersję, układ toreb, wykrytą otwartą torbę, rzadkości, dostępność grafiki, sygnały dziennika zdobyczy oraz co gra zrobiła po ostatnim upuszczeniu przedmiotu na okno dodatku (komendy i nowe okienka przez 3 s).</li>
            <li>Jeśli coś nie działa, wklej ten wynik – na jego podstawie da się poprawić rozpoznawanie.</li>
          </ul>`) +
        sec('h-soon', 'Jeszcze niedostępne',
          `<ul>
            <li><b>Depozyt</b> i <b>sortowanie</b> są w planach – pojawią się, gdy będą działać (nieaktywne przyciski zostały usunięte).</li>
            <li>Zasada projektu: skrypt nie usuwa, nie sprzedaje i nie wyrzuca przedmiotów.</li>
          </ul>`) +
        sec('h-unsure', 'Co nie zostało potwierdzone w grze',
          `<ul>
            <li>Wykrywanie otwartej torby, częściowe łączenie stosów (gdy cały stos się nie mieści) i nazwy rzadkości w grze.</li>
            <li>Przeciąganie przedmiotu na ramkę, pobieranie grafiki przedmiotu oraz rozpoznawanie źródła dropów (okno łupu, skrzynki).</li>
            <li>Sortowanie: czy komenda przeniesienia na wolne miejsce działa w grze tak samo jak przy łączeniu stosów; kolejność „jakości” (artefakt, legendarny, ulepszony, heroiczny, unikatowy, pospolity) i to, że każdy przedmiot zajmuje 1 pole.</li>
            <li>Czy gra po upuszczeniu przedmiotu na okno dodatku na pewno odkłada go na miejsce (bez pytania o wyrzucenie) – sprawdzone tylko na stronie testowej.</li>
            <li>Jeśli któraś z tych rzeczy nie działa, użyj Diagnostyki i opisz, co się dzieje.</li>
          </ul>`) +
        sec('h-log', 'Historia zmian',
          `<ul>
            <li><b>0.16.0</b> – działające <b>sortowanie</b> otwartej torby (po nazwie, typie, jakości); kwadraty zaznaczania zamienione na przełączniki (gra psuła zwykłe pola wyboru); 👁 Obserwowane i 🧰 Depozyt (w przygotowaniu) w docku; logo plecaka zamiast ▣.</li>
            <li><b>0.15.0</b> – przedmiot upuszczony na okno dodatku wraca na swoje miejsce (bez pytania o wyrzucenie); okna nie wychodzą za prawą krawędź ekranu („Obok siebie” układa tylko otwarte okna); usunięte niedziałające i zbędne opcje: sortowanie i „Usuń zaznaczone” (nieaktywne), Depozyt w docku, sekcje „Pozycja i zachowanie” i „Inne”, rogi/cień, „Do prawej”; pozycje okien i stan docka zapamiętywane zawsze.</li>
            <li><b>0.14.0</b> – poprawki: suwaki skali i czcionki już nie skaczą, dolne opcje okien zawsze da się przewinąć i kliknąć, wyłączenie „Zawsze na wierzchu” działa; przeciąganie na ramkę dodaje właściwy przedmiot (wcześniej zawsze ten sam z ekwipunku); ✕ w małym okienku obserwowanych; Diagnostyka zapisuje reakcję gry na upuszczenie przedmiotu na okno.</li>
            <li><b>0.13.2</b> – wczytywanie przez skrypt-ładowacz z GitHub Pages (repozytorium majndaw/margonem-mindaw-addons).</li>
            <li><b>0.13.1</b> – okno Funkcje uzupełnione (pamięć wyniku szukania, liczba sztuk, zastępowanie starej wersji) i dodana Historia zmian.</li>
            <li><b>0.13.0</b> – nowe okno Funkcje z opisem wszystkich funkcji.</li>
            <li><b>0.12.0</b> – obserwowanie przedmiotu przez przeciągnięcie lub wskazanie w grze; dziennik zdobyczy tylko z dropów (heroiki, legendy, smocze runy), licznik od 00:00.</li>
            <li><b>0.11.0</b> – obserwowane przedmioty z żółtym i czerwonym napisem, dziennik zdobyczy, kopia ustawień, motywy, rozmiar czcionki, tryb kompaktowy, skala 40–130% (domyślnie 80%).</li>
            <li><b>0.10.0</b> – osobne kropki do przesuwania każdego okna, szukanie bez polskich znaków z historią i filtrem rzadkości, własne skróty klawiszowe, zwijane sekcje i podpowiedzi.</li>
            <li><b>0.9.x</b> – łączenie jednym kliknięciem do limitu stosu (z resztą w ostatnim stosie), przesuwanie kropkami, wykrywanie otwartej torby z okna gry, numer wersji w tytule.</li>
          </ul>`) +
        `</div>`,
    },
    { id: 'watch', icon: '👁', title: 'Obserwowane', w: 230, mini: true, html: '<div id="mbt-watchrows"></div><div class="wslot" data-wslot title="Przeciągnij przedmiot z torby w tę ramkę"><span>＋</span><small>przeciągnij tu przedmiot z torby</small></div><button class="b" data-wtarget="1" style="width:100%;margin-top:6px" title="Kliknij, a potem kliknij przedmiot w torbie">🎯 Wskaż w grze</button>' },
  ];
  const WIN_IDS = WINS.map(w => w.id);
  // logo: plecak z klamrą (kolor akcentu)
  const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6V5a3 3 0 0 1 6 0v1"/><rect x="4" y="6" width="16" height="15" rx="3.5"/><path d="M4 11.5h16"/><rect x="10" y="9.8" width="4" height="3.6" rx="1" fill="currentColor"/><path d="M8 16.5h8" opacity=".55"/></svg>';
  const gripHTML = id => `<span class="grip" data-grip="${id}" title="Przeciągnij, aby przenieść">${'<i></i>'.repeat(9)}</span>`;

  /* ---------- style ---------- */
  const css = document.createElement('style');
  css.dataset.mbt = '1';
  css.textContent = `
  #mbt-root{--ac:#00e676;--a:.7;--r:14px;--sc:1;--fs:14px;--bg:9,15,16;--ctl:#162021;--inp:#101819;--bd:#2f3d3e;
    font:var(--fs)/1.4 Arial,sans-serif;color:#edf5f1;user-select:none}
  #mbt-root *{box-sizing:border-box}
  #mbt-root .win{position:fixed;z-index:2147480000;display:none;transform:scale(var(--sc));transform-origin:top left;
    background:rgba(var(--bg),var(--a));border:1px solid var(--ac);border-radius:var(--r);overflow:hidden;backdrop-filter:blur(8px)}
  #mbt-root.shadow .win{box-shadow:0 8px 30px #000a}
  #mbt-root .win.show{display:block}
  #mbt-root .win.min .body{display:none}
  #mbt-root .win.min .head{border-bottom:0}
  #mbt-root .head{display:flex;align-items:center;gap:10px;padding:10px 16px 10px 10px;font-size:1.43em;font-weight:bold;border-bottom:1px solid #ffffff18}
  #mbt-root .head .t{flex:1}
  #mbt-root .head small{font-size:.5em;font-weight:normal;opacity:.5;margin-left:6px}
  #mbt-root .ib{background:none;border:0;color:#cfd9d6;font-size:1.57em;cursor:pointer;padding:0 6px;line-height:1}
  #mbt-root .ib:hover{color:var(--ac)}
  #mbt-root .body{padding:4px 18px 18px;max-height:calc(100vh - 140px);overflow:auto}
  #mbt-root .sec+.sec{border-top:1px solid #ffffff18;margin-top:12px}
  #mbt-root h4{display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px;font-size:1.14em;cursor:pointer}
  #mbt-root h4:hover{color:var(--ac)}
  #mbt-root .chev{font-style:normal;transition:transform .15s}
  #mbt-root .sec.fold .chev{transform:rotate(-90deg)}
  #mbt-root .sec.fold .sc{display:none}
  #mbt-root .sec.fold h4{margin-bottom:4px}
  #mbt-root .hint,#mbt-root .note{margin-top:10px;font-size:.86em;color:#aab8b4}
  #mbt-root .hint{padding:9px 12px;border:1px solid var(--bd);border-radius:9px;font-size:.93em;background:var(--inp)}
  #mbt-root button.b{background:var(--ctl);color:#e9f2ef;border:1px solid var(--bd);border-radius:9px;padding:11px;
    cursor:pointer;font:inherit;transition:.15s}
  #mbt-root button.b:hover:not(:disabled){border-color:var(--ac)}
  #mbt-root button.b.on{border-color:var(--ac);color:var(--ac)}
  #mbt-root button.b:disabled{opacity:.45;cursor:not-allowed}
  #mbt-root button.main{width:100%;font-size:1.21em;font-weight:bold;color:#fff;
    background:linear-gradient(color-mix(in srgb,var(--ac) 85%,#fff),color-mix(in srgb,var(--ac) 55%,#000));
    border-color:var(--ac);padding:13px}
  #mbt-root .r{display:flex;gap:10px;margin-top:10px;align-items:center}
  #mbt-root .r>*{flex:1}
  #mbt-root .r>.n{flex:none;width:72px}
  #mbt-root input.s,#mbt-root textarea.s{width:100%;padding:12px;background:var(--inp);color:#fff;border:1px solid var(--bd);border-radius:9px;outline:none;font:inherit}
  #mbt-root textarea.s{margin-top:10px;resize:vertical;user-select:text;font-size:.86em}
  #mbt-root input.s:focus,#mbt-root textarea.s:focus{border-color:var(--ac)}
  #mbt-root select{width:100%;padding:12px;background:var(--inp);color:#fff;border:1px solid var(--bd);border-radius:9px;font:inherit}
  #mbt-root .tg{display:flex;align-items:center;gap:10px;width:100%;margin:4px 0;padding:6px 2px;background:none;border:0;
    color:inherit;font:inherit;text-align:left;cursor:pointer}
  #mbt-root .tg i{flex:none;position:relative;width:38px;height:22px;border-radius:999px;background:var(--inp);border:1px solid var(--bd);transition:.15s}
  #mbt-root .tg i::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#8b9894;transition:.15s}
  #mbt-root .tg.on i{background:color-mix(in srgb,var(--ac) 40%,var(--inp));border-color:var(--ac)}
  #mbt-root .tg.on i::after{left:19px;background:var(--ac)}
  #mbt-root .tg:hover span{color:var(--ac)}
  #mbt-root input[type=range]{flex:1;accent-color:var(--ac)}
  #mbt-root .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  #mbt-root .chips:empty{display:none}
  #mbt-root .chip{background:var(--ctl);border:1px solid var(--bd);color:#cfd9d6;border-radius:999px;padding:4px 11px;font:inherit;font-size:.86em;cursor:pointer}
  #mbt-root button.chip:hover{border-color:var(--ac)}
  #mbt-root .chip.on{border-color:var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 16%,var(--inp))}
  #mbt-root .chip.x{opacity:.65}
  #mbt-root .out,#mbt-root .logbox{margin-top:12px;padding:10px;border:1px solid var(--bd);border-radius:9px;color:#b9c7c2;
    font-size:.86em;white-space:pre-wrap;max-height:240px;overflow:auto;user-select:text}
  #mbt-root .out{display:none}
  #mbt-root .logbox:empty{display:none}
  #mbt-root .wl{display:flex;align-items:center;gap:8px;margin-top:8px}
  #mbt-root .wl .wn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mbt-root .wl .n{width:66px;padding:6px}
  #mbt-root .win.mini .head{padding:4px 8px 4px 4px;font-size:1em}
  #mbt-root .win.mini .body{padding:6px 10px 8px;max-height:none}
  #mbt-root .wr{display:flex;align-items:center;gap:8px;margin:4px 0}
  #mbt-root .wr canvas{width:28px;height:28px;flex:none;image-rendering:pixelated;background:var(--inp);border:1px solid var(--bd);border-radius:6px}
  #mbt-root .wr .wn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mbt-root .wr b{font-size:1.1em}
  #mbt-root .wr small{opacity:.6}
  #mbt-root .wr .wx{font-size:1em;padding:0 2px;opacity:.45}
  #mbt-root .wr .wx:hover{opacity:1;color:#ff3b30}
  #mbt-root .wr.l1 b{color:#ffd400}
  #mbt-root .wr.l2 b{color:#ff3b30}
  #mbt-root .wslot{margin-top:6px;min-height:46px;border:2px dashed var(--bd);border-radius:8px;display:flex;align-items:center;justify-content:center;
    gap:8px;color:#9aa8a4;text-align:center;padding:6px;transition:.12s}
  #mbt-root .wslot span{font-size:1.6em;line-height:1}
  #mbt-root .wslot small{font-size:.8em}
  #mbt-root .wslot.hot{border-color:var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 12%,transparent)}
  html.mbt-pick .item[class*="item-id-"]{cursor:crosshair!important}
  #mbt-root .help ul{margin:6px 0 6px 18px;padding:0}
  #mbt-root .help li{margin:5px 0;font-size:.93em;line-height:1.45;color:#cfd9d6;user-select:text}
  #mbt-root .help b{color:var(--ac);font-weight:600}
  #mbt-root .dock{position:fixed;z-index:2147483100;width:122px;padding:10px;display:none;flex-direction:column;gap:8px;
    background:rgba(var(--bg),var(--a));border:1px solid var(--ac);border-radius:var(--r);transform:scale(var(--sc));transform-origin:top left;text-align:center}
  #mbt-root .dock.show{display:flex}
  #mbt-root .dh{display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid #ffffff18;color:#cfd9d6}
  #mbt-root .grip{display:inline-grid;grid-template-columns:repeat(3,5px);gap:3px;padding:8px;cursor:move;touch-action:none;border-radius:8px;flex:none}
  #mbt-root .grip i{width:5px;height:5px;border-radius:50%;background:#cfd9d6}
  #mbt-root .grip:hover i{background:var(--ac)}
  #mbt-root .di{background:none;border:1px solid transparent;border-radius:10px;color:#cfd9d6;padding:8px 4px;cursor:pointer;font:inherit}
  #mbt-root .di.on{border-color:var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}
  #mbt-root .di .ic{font-size:2.4em;display:block;line-height:1.2}
  #mbt-root .launcher{position:fixed;z-index:2147483100;height:50px;padding:0 6px 0 2px;color:var(--ac);display:none;align-items:center;gap:2px;
    background:rgba(9,15,16,.94);border:1px solid var(--ac);border-radius:13px}
  #mbt-root .launcher.show{display:flex}
  #mbt-root .launcher .ib{font-size:1.7em;color:var(--ac)}
  #mbt-root .launcher .logo{display:flex;align-items:center;padding:0 4px}
  #mbt-root .launcher .logo svg{width:30px;height:30px;display:block}
  #mbt-root .launcher .logo:hover svg{filter:drop-shadow(0 0 4px var(--ac))}
  #mbt-root .di.soon{opacity:.6}
  #mbt-root .di small{display:block;font-size:.7em;opacity:.8}
  #mbt-root .sw{display:flex;gap:8px;flex:1}
  #mbt-root .sw i{width:26px;height:26px;border-radius:8px;cursor:pointer;border:2px solid transparent}
  #mbt-root .sw i.on{border-color:#fff}
  #mbt-root .kb{display:flex;align-items:center;gap:8px;margin:8px 0}
  #mbt-root .kb span{flex:1}
  #mbt-root .kbbtn{min-width:150px;padding:8px 14px}
  #mbt-root .kbbtn.rec{border-color:var(--ac);color:var(--ac)}
  #mbt-root.compact .body{padding:2px 12px 12px}
  #mbt-root.compact .head{padding:6px 12px 6px 8px}
  #mbt-root.compact button.b{padding:6px 9px}
  #mbt-root.compact button.main{padding:9px}
  #mbt-root.compact input.s,#mbt-root.compact select{padding:7px}
  #mbt-root.compact .r{margin-top:6px}
  #mbt-root.compact h4{margin:8px 0 5px}
  #mbt-root.compact .tg{margin:1px 0;padding:4px 2px}
  #mbt-root #mbt-toasts{position:fixed;left:50%;top:30%;transform:translateX(-50%);z-index:2147483200;pointer-events:none;
    display:flex;flex-direction:column;align-items:center;gap:8px;width:max-content;max-width:90vw}
  #mbt-root .toast{font-size:28px;font-weight:bold;text-align:center;text-shadow:0 2px 8px #000,0 0 4px #000;animation:mbtfade 4s forwards}
  @keyframes mbtfade{0%{opacity:0;transform:scale(.92)}8%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0}}
  `;
  document.documentElement.appendChild(css);

  /* ---------- HTML ---------- */
  const root = document.createElement('div');
  root.id = 'mbt-root';
  root.dataset.v = VER;
  root.innerHTML = `
  <div id="mbt-toasts"></div>
  <div class="launcher" id="mbt-launcher" title="Bag Tools v${VER}">${gripHTML('dock')}<button class="ib logo" data-act="openDock" title="Otwórz Bag Tools">${LOGO}</button></div>

  <div class="dock" id="mbt-dock">
    <div class="dh">${gripHTML('dock')}<button class="ib" data-act="closeAll" title="Zamknij wszystko">×</button></div>
    ${WINS.filter(w => w.dock !== false).map(w => `<button class="di" data-win="${w.id}" title="${w.title}"><span class="ic">${w.icon}</span>${w.title}</button>`).join('')}
    <button class="di soon" data-soon="Depozyt" title="W przygotowaniu"><span class="ic">🧰</span>Depozyt<small>wkrótce</small></button>
  </div>

  ${WINS.map(w => `
  <section class="win${w.mini ? ' mini' : ''}" id="mbt-w-${w.id}" style="width:${w.w}px">
    <header class="head">${gripHTML(w.id)}<span>${w.icon}</span><span class="t">${w.title}${w.mini ? '' : `<small>v${VER}</small>`}</span>
      ${w.mini ? '' : `<button class="ib" data-min="${w.id}" title="Zwiń / rozwiń">–</button>`}<button class="ib" data-close="${w.id}" title="Zamknij">×</button></header>
    <div class="body">${w.html}</div>
  </section>`).join('')}`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const el = { dock: $('#mbt-dock'), icon: $('#mbt-launcher') };
  WIN_IDS.forEach(id => { el[id] = $('#mbt-w-' + id); });
  const out = $('#mbt-out');
  let dockOpen = !!S.dock;
  let busy = false;
  let Z = 2147480000;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- wygląd i pozycje ---------- */
  $('#mbt-sw').innerHTML = COLORS.map((c, i) => `<i data-c="${i}" style="background:${c}"></i>`).join('');

  const winW = id => (id === 'dock' ? 122 : WINS.find(w => w.id === id).w) * S.scale / 100;
  function place() {
    // całe okno w poziomie zawsze na ekranie (inaczej przyciski wypadały za prawą krawędź)
    for (const id of ['dock', ...WIN_IDS]) {
      const p = S.pos[id] || def.pos[id];
      el[id].style.left = clamp(p[0], 0, Math.max(0, innerWidth - winW(id))) + 'px';
      el[id].style.top = clamp(p[1], 0, Math.max(0, innerHeight - 50)) + 'px';
    }
    el.icon.style.left = el.dock.style.left; el.icon.style.top = el.dock.style.top;
    // wysokość treści liczona od miejsca okna i skali – dół okna zawsze mieści się na ekranie (da się przewinąć)
    const sc = S.scale / 100;
    for (const id of WIN_IDS) {
      const head = el[id].querySelector('.head').offsetHeight || 56;
      el[id].querySelector('.body').style.maxHeight = Math.max(100, (innerHeight - parseFloat(el[id].style.top) - 12) / sc - head) + 'px';
    }
  }
  function paintToggles() { $$('[data-tg]').forEach(b => b.classList.toggle('on', !!S[b.dataset.tg])); }
  function applyFold() { $$('.sec').forEach(s => s.classList.toggle('fold', !!S.fold[s.dataset.sec])); }
  function apply() {
    const th = THEMES[S.theme] || THEMES.ciemny;
    root.style.setProperty('--ac', COLORS[S.accent]);
    root.style.setProperty('--a', S.alpha / 100);
    root.style.setProperty('--sc', S.scale / 100);
    root.style.setProperty('--r', '14px');
    root.style.setProperty('--fs', S.font + 'px');
    root.style.setProperty('--bg', th.bg); root.style.setProperty('--ctl', th.ctl);
    root.style.setProperty('--inp', th.inp); root.style.setProperty('--bd', th.bd);
    root.classList.add('shadow');
    root.classList.toggle('compact', S.compact);
    $('#mbt-alpha').value = S.alpha; $('#mbt-alpha-l').textContent = S.alpha + '%';
    $('#mbt-scale').value = S.scale; $('#mbt-scale-l').textContent = S.scale + '%';
    $('#mbt-font').value = S.font; $('#mbt-font-l').textContent = S.font + 'px';
    $$('#mbt-sw i').forEach((i, n) => i.classList.toggle('on', n === S.accent));
    $$('[data-theme]').forEach(b => b.classList.toggle('on', b.dataset.theme === S.theme));
    paintToggles();
    $('#mbt-wcrit').value = S.watchCrit; $('#mbt-wremind').value = S.watchRemind;
    applyFold(); place();
  }
  function view() {
    S.open.watch = !!S.watchShow;
    WIN_IDS.forEach(id => {
      el[id].classList.toggle('show', !!S.open[id]);
      el[id].classList.toggle('min', !!S.min[id]);
    });
    el.dock.classList.toggle('show', dockOpen);
    el.icon.classList.toggle('show', !dockOpen);
    S.dock = dockOpen;
    $$('[data-win]').forEach(b => b.classList.toggle('on', !!S.open[b.dataset.win]));
    paintToggles();
    place();
    if (S.open.torba) { const sn = snap(); updateNote(sn); renderRar(sn); }
    save();
  }
  function arrange(kind) {
    const sc = S.scale / 100, [dx, dy] = S.pos.dock, list = WINS.filter(w => w.dock !== false);
    if (kind === 'reset') S.pos = JSON.parse(JSON.stringify(def.pos));
    else if (kind === 'row') {
      // tylko otwarte okna; gdy brakuje miejsca, kolejne idą od początku, przesunięte w dół (kaskada)
      const x0 = dx + 142 * sc;
      let x = x0, y = dy;
      list.filter(w => S.open[w.id]).forEach(w => {
        if (x > x0 && x + w.w * sc > innerWidth - 8) { x = x0 + (y - dy + 40) / 2; y += 40; }
        S.pos[w.id] = [x, y]; x += w.w * sc + 16;
      });
    }
    place(); save();
  }

  /* ---------- zdarzenia UI ---------- */
  root.addEventListener('click', e => {
    const t = e.target;
    if (rec && !t.closest('[data-kb]')) stopRec();
    const w = t.closest('[data-win]');
    if (w && w.dataset.win === 'watch') { S.watchShow = !S.watchShow; view(); bgTick(); }
    else if (w) { S.open[w.dataset.win] = !S.open[w.dataset.win]; view(); }
    const tg = t.closest('[data-tg]');
    if (tg) {
      const o = tg.dataset.tg;
      S[o] = !S[o];
      if (o === 'watchShow') { view(); bgTick(); } else { apply(); save(); }
    }
    if (t.dataset.close) {
      S.open[t.dataset.close] = false;
      if (t.dataset.close === 'watch') S.watchShow = false;
      view();
    }
    if (t.dataset.min) { S.min[t.dataset.min] = !S.min[t.dataset.min]; view(); }
    const act = (t.closest('[data-act]') || {}).dataset || {};   // closest: klik trafia też w rysunek logo
    if (act.act === 'closeAll') { dockOpen = false; WIN_IDS.forEach(id => { S.open[id] = false; }); view(); }
    if (act.act === 'openDock') { dockOpen = true; view(); }
    if (t.dataset.c) { S.accent = +t.dataset.c; apply(); save(); }
    const th = t.closest('[data-theme]');
    if (th) { S.theme = th.dataset.theme; apply(); save(); }
    const f = t.closest('[data-fold]');
    if (f) { S.fold[f.dataset.fold] = !S.fold[f.dataset.fold]; applyFold(); save(); }
    const lay = t.closest('[data-layout]');
    if (lay) arrange(lay.dataset.layout);
    const rr = t.closest('[data-rar]');
    if (rr) {
      const r = rr.dataset.rar;
      S.rar = S.rar.includes(r) ? S.rar.filter(x => x !== r) : [...S.rar, r];
      rarKey = ''; renderRar(snap()); save();
    }
    const hh = t.closest('[data-hist]');
    if (hh) { $('#mbt-search').value = hh.dataset.hist; find(); }
    if (t.dataset.histclear) { S.history = []; renderHist(); save(); }
    const kb = t.closest('[data-kb]');
    if (kb) startRec(kb.dataset.kb);
    if (t.dataset.kbclear) { S.keys[t.dataset.kbclear] = []; save(); renderKeys(); }
    const wa = t.closest('[data-wadd]');
    if (wa) wAdd(wa.dataset.wadd);
    if (t.dataset.wdel !== undefined) wDel(+t.dataset.wdel);
    if (t.dataset.wtest) {
      toast('⚠ Mało: Przykładowa mikstura — 42 szt. (próg 50)', YEL);
      toast('‼ Bardzo mało: Przykładowa mikstura — 20 szt. (próg 50)', RED);
    }
    if (t.closest('[data-wtarget]')) setPick(!pick);
    const so = t.closest('[data-sort]');
    if (so) sortBag(so.dataset.sort);
    if (t.closest('[data-soon]')) toast('🧰 Depozyt – w przygotowaniu', YEL);
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'mbt-wcrit') { S.watchCrit = clamp(Math.floor(+t.value) || 50, 1, 99); t.value = S.watchCrit; save(); }
    if (t.id === 'mbt-wremind') { S.watchRemind = clamp(Math.floor(+t.value) || 0, 0, 3600); t.value = S.watchRemind; save(); }
    if (t.dataset.wwarn !== undefined) {
      const w = S.watch[+t.dataset.wwarn];
      if (w) { w.warn = Math.max(1, Math.floor(+t.value) || 1); t.value = w.warn; delete wState[w.name]; save(); bgTick(); }
    }
  });
  $('#mbt-alpha').oninput = e => { S.alpha = +e.target.value; apply(); save(); };
  // skala i czcionka zmieniają rozmiar okna – w trakcie przesuwania tylko podgląd liczby, zmiana po puszczeniu
  // (inaczej suwak „ucieka” spod kursora i wartość skacze)
  $('#mbt-scale').oninput = e => { $('#mbt-scale-l').textContent = e.target.value + '%'; };
  $('#mbt-scale').onchange = e => { S.scale = +e.target.value; apply(); save(); };
  $('#mbt-font').oninput = e => { $('#mbt-font-l').textContent = e.target.value + 'px'; };
  $('#mbt-font').onchange = e => { S.font = +e.target.value; apply(); save(); };
  addEventListener('resize', place);

  // kliknięte okno wychodzi na wierzch
  root.addEventListener('pointerdown', e => {
    const w = e.target.closest('.win');
    if (!w) return;
    if (Z > 2147482900) { Z = 2147480000; $$('.win').forEach(x => { x.style.zIndex = Z; }); }
    w.style.zIndex = ++Z;
  });

  /* przeciąganie: kropki każdego okna (i docka) */
  let drag = null;
  root.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-grip]');
    if (!h || e.button !== 0) return;
    const id = h.dataset.grip;
    drag = { h, id, pid: e.pointerId, x: e.clientX, y: e.clientY, l: S.pos[id][0], t: S.pos[id][1] };
    try { h.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  root.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    S.pos[drag.id] = [
      clamp(drag.l + e.clientX - drag.x, 0, Math.max(0, innerWidth - winW(drag.id))),
      clamp(drag.t + e.clientY - drag.y, 0, Math.max(0, innerHeight - 50)),
    ];
    place();
  });
  const endDrag = () => {
    if (!drag) return;
    try { drag.h.releasePointerCapture(drag.pid); } catch {}
    save(); drag = null;
  };
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  // kliknięcia w nasze okna nie mają dotykać gry; pisanie w polach nie idzie do gry
  ['mousedown', 'mouseup', 'dblclick', 'contextmenu', 'wheel'].forEach(t => root.addEventListener(t, e => e.stopPropagation()));
  ['keydown', 'keyup', 'keypress'].forEach(t => root.addEventListener(t, e => { if (typing(e.target)) e.stopPropagation(); }));

  /* ---------- dane gry ---------- */
  const COLS = 7, BAG_STRIDE = 6; // każda torba zaczyna się co 6 rzędów (42 miejsca)
  const RAR = { common: 'Pospolity', unique: 'Unikat', heroic: 'Heroiczny', upgraded: 'Ulepszony', legendary: 'Legendarny', artefact: 'Artefakt', none: 'Inne' };
  const RAR_ORDER = Object.keys(RAR);
  const stats = it => (it && it._cachedStats) || {};
  const fetchRaw = () => {
    const E = window.Engine;
    try {
      if (E && E.items && typeof E.items.fetchLocationItems === 'function') {
        const l = E.items.fetchLocationItems('g');
        return Array.isArray(l) ? l : Object.values(l || {});
      }
    } catch {}
    return [];
  };
  const amountOf = it => {
    try {
      const s = stats(it);
      if (s.amount != null) return +s.amount || 1;
      if (typeof it.getAmount === 'function') return +it.getAmount() || 1;
      const m = /(?:^|;)amount=(\d+)/.exec(it.stat || '');
      return m ? +m[1] : 1;
    } catch { return 1; }
  };
  const stackable = it => {
    try {
      if (typeof it.issetAmountStat === 'function') return !!it.issetAmountStat();
      return stats(it).amount != null;
    } catch { return false; }
  };
  const rarOf = it => {
    const r = stats(it).rarity || (/(?:^|;)rarity=([a-z_]+)/.exec(it.stat || '') || [])[1];
    return r ? String(r).toLowerCase() : 'none';
  };
  const nameOf = it => { try { return it.name || (typeof it.getName === 'function' && it.getName()) || ''; } catch { return ''; } };
  const statNum = (it, key, raw) => {
    const s = stats(it);
    if (s[key] != null && +s[key] > 0) return +s[key];
    const m = new RegExp('(?:^|;)' + key + '=(\\d+)').exec(raw || '');
    return m ? +m[1] : 0;
  };
  const readItems = () => fetchRaw().map(it => ({
    id: String(it.id), name: nameOf(it), tpl: it.tpl, st: Number(it.st), x: Number(it.x), y: Number(it.y),
    amount: amountOf(it), stackable: stackable(it), stat: String(it.stat || ''), rar: rarOf(it),
    cl: Number(it.cl) || 0, cap: statNum(it, 'capacity', it.stat) || Infinity, bagcap: statNum(it, 'bag', it.stat), ref: it,
  }));

  // układ toreb: st 20-22 = torby 1-3; rzędy: torba k zaczyna się od k*6
  function layout(items) {
    return items.filter(i => i.st >= 20 && i.st <= 22).sort((a, b) => a.st - b.st).map((b, idx) => {
      const cap = b.bagcap || 42, from = idx * BAG_STRIDE;
      return { idx, name: b.name, cap, from, to: from + Math.ceil(cap / COLS) - 1 };
    });
  }
  function snap() {
    const items = readItems(), L = layout(items);
    items.forEach(i => { i.bag = i.st === 0 ? L.findIndex(b => i.y >= b.from && i.y <= b.to) : -2; });
    return { items, L };
  }

  /* ---------- wykrywanie otwartej torby ---------- */
  const ACT = /(^|[-_\s])(active|selected|current|chosen|on|open)([-_\s]|$)/i;
  const cls = n => String((n.className && n.className.baseVal !== undefined) ? n.className.baseVal : n.className || '');
  function visibleIds() {
    const ids = new Set();
    document.querySelectorAll('.item[class*="item-id-"]').forEach(n => {
      if (root.contains(n) || !n.isConnected) return;
      const r = n.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const m = /item-id-(\d+)/.exec(cls(n));
      if (m) ids.add(m[1]);
    });
    return ids;
  }
  function detectBag(items, L) {
    // 1) przedmioty widoczne w oknie gry
    const ids = visibleIds(), cnt = {};
    items.forEach(i => { if (i.bag >= 0 && ids.has(i.id)) cnt[i.bag] = (cnt[i.bag] || 0) + 1; });
    const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (best) return { k: +best[0], how: 'z okna gry' };
    // 2) aktywna zakładka w nawigacji toreb
    const nav = document.querySelector('.bags-navigation');
    if (nav) {
      for (const n of nav.querySelectorAll('*')) {
        if (!ACT.test(cls(n))) continue;
        const holder = n.matches('[class*="bag-"]') ? n : n.closest('[class*="bag-"]');
        const m = holder && /(?:^|\s)bag-(\d+)(?:\s|$)/.exec(cls(holder));
        if (m && +m[1] - 1 < L.length) return { k: +m[1] - 1, how: 'z zakładki' };
      }
    }
    return null;
  }
  function updateNote(sn = snap()) {
    const { items, L } = sn;
    if (!L.length) return void ($('#mbt-bagnote').textContent = 'Nie widzę toreb – uruchom grę z postacią.');
    const d = detectBag(items, L);
    $('#mbt-bagnote').textContent = d
      ? `Otwarta torba: ${d.k + 1} (${d.how}). Przedmiotów w niej: ${items.filter(i => i.bag === d.k).length}.`
      : 'Nie wykryto otwartej torby – otwórz torbę w grze (szukanie działa we wszystkich torbach).';
  }
  setInterval(() => { if (S.open.torba && !busy) { const sn = snap(); updateNote(sn); renderRar(sn); } }, 1000);

  const say = t => { out.style.display = 'block'; out.textContent = t; };
  const join = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' i ' + a[a.length - 1];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // napis na środku ekranu
  const YEL = '#ffd400', RED = '#ff3b30', OK = '#7dffb2';
  function toast(text, color) {
    const box = $('#mbt-toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast'; d.style.color = color; d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.remove(), 4200);
  }

  /* ---------- szukanie: historia, rzadkość, bez polskich znaków ---------- */
  let rarKey = '';
  function renderRar(sn = snap()) {
    const present = [...new Set(sn.items.filter(i => i.st === 0).map(i => i.rar))]
      .sort((a, b) => (RAR_ORDER.indexOf(a) + 1 || 99) - (RAR_ORDER.indexOf(b) + 1 || 99));
    const key = present.join(',') + '|' + S.rar.join(',');
    if (key === rarKey) return;
    rarKey = key;
    $('#mbt-rar').innerHTML = present.length > 1
      ? present.map(r => `<button class="chip${S.rar.includes(r) ? ' on' : ''}" data-rar="${esc(r)}" title="Filtr rzadkości">${esc(RAR[r] || r)}</button>`).join('')
      : '';
  }
  function renderHist() {
    $('#mbt-hist').innerHTML = S.history.length
      ? S.history.map(h => `<button class="chip" data-hist="${esc(h)}" title="Szukaj ponownie">${esc(h)}</button>`).join('') +
        '<button class="chip x" data-histclear="1" title="Wyczyść historię">✕ historia</button>'
      : '';
  }
  function addHist(q) {
    S.history = [q, ...S.history.filter(h => norm(h) !== norm(q))].slice(0, 8);
    renderHist(); save();
  }

  function find() {
    const raw = $('#mbt-search').value.trim(), terms = norm(raw).split(/\s+/).filter(Boolean);
    const { items, L } = snap();
    if (!L.length) return say('Nie widzę toreb ani przedmiotów. Uruchom grę z postacią.');
    if (!terms.length && !S.rar.length) return say('Wpisz nazwę przedmiotu albo wybierz rzadkość.');
    const hits = items.filter(i => i.st === 0 && (!S.rar.length || S.rar.includes(i.rar)) &&
      (n => terms.every(t => n.includes(t)))(norm(i.name)));
    if (raw) addHist(raw);
    if (!hits.length) return say('Nie znaleziono pasującego przedmiotu w żadnej torbie.');
    const by = {};
    hits.forEach(i => {
      const o = (by[i.name] = by[i.name] || { rar: i.rar, bags: {} });
      o.bags[i.bag] = (o.bags[i.bag] || 0) + i.amount;
    });
    const names = Object.keys(by), total = hits.reduce((n, i) => n + i.amount, 0);
    const lines = names.slice(0, 60).map(name => {
      const o = by[name];
      const parts = Object.keys(o.bags).map(Number).sort((a, b) => a - b).map(k =>
        (k < 0 ? 'poza torbami' : `Torba ${k + 1}`) + (S.showCount ? ` (${o.bags[k]} szt.)` : ''));
      const tag = o.rar !== 'common' && o.rar !== 'none' ? ` [${RAR[o.rar] || o.rar}]` : '';
      return `• ${name}${tag} — ${join(parts)}`;
    });
    if (names.length > 60) lines.push(`…i ${names.length - 60} więcej`);
    const text = `Znaleziono ${names.length} poz.` + (S.showCount ? `, razem ${total} szt.` : '') + '\n' + lines.join('\n');
    say(text);
    S.last = text.slice(0, 2000); save();
  }

  function dups() {
    const { items, L } = snap(), d0 = detectBag(items, L);
    if (!d0) return say('Nie wykryto otwartej torby.');
    const by = {};
    items.filter(i => i.bag === d0.k).forEach(i => (by[i.name] = by[i.name] || []).push(i));
    const d = Object.entries(by).filter(([, a]) => a.length > 1);
    say(d.length
      ? `Torba ${d0.k + 1} – duplikaty:\n` + d.map(([n, a]) => `• ${n}: ${a.length} stosy, razem ${a.reduce((s, i) => s + i.amount, 0)} szt.`).join('\n')
      : `Torba ${d0.k + 1}: brak duplikatów.`);
  }

  /* ---------- łączenie stosów (tylko otwarta torba) ---------- */
  const keyOf = i => i.tpl + '|' + i.stat.replace(/(^|;)amount=\d+/g, '').replace(/^;/, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const send = cmd => new Promise(res => {
    try { window._g(cmd, r => res(r)); } catch { res(null); }
    setTimeout(() => res('timeout'), 4000);
  });
  const byId = id => readItems().find(i => i.id === id);
  async function waitGrow(dstId, before, ms = 2500) {
    for (let t = 0; t < ms; t += 150) {
      await sleep(150);
      const d = byId(dstId);
      if (d && d.amount > before) return d;
    }
    return byId(dstId);
  }

  // plan: największy niepełny stos dobiera od najmniejszych, reszta zostaje w ostatnim stosie
  function buildPlan(items, k) {
    const groups = {};
    items.filter(i => i.bag === k && i.stackable).forEach(i => (groups[keyOf(i)] = groups[keyOf(i)] || []).push(i));
    const plan = [], summary = [];
    Object.entries(groups).filter(([, g]) => g.length > 1).forEach(([key, g]) => {
      const st = g.map(i => ({ id: i.id, name: i.name, amount: i.amount, cap: i.cap }));
      const before = st.map(s => s.amount).sort((a, b) => b - a), n0 = plan.length;
      for (let guard = 0; guard < 200; guard++) {
        const open = st.filter(s => s.amount > 0 && s.amount < s.cap).sort((a, b) => b.amount - a.amount);
        if (open.length < 2) break;
        const dst = open[0], src = open[open.length - 1];
        const room = dst.cap - dst.amount, move = Math.min(src.amount, room);
        plan.push({ key, name: dst.name, srcId: src.id, dstId: dst.id, full: src.amount <= room });
        dst.amount += move; src.amount -= move;
      }
      if (plan.length > n0) summary.push({ key, name: g[0].name, before });
    });
    return { plan, summary };
  }

  async function merge() {
    if (busy) return say('Łączenie już trwa…');
    const s0 = snap(), d0 = detectBag(s0.items, s0.L);
    if (!d0) return say('Nie wykryto otwartej torby. Otwórz torbę w grze (kliknij jej zakładkę) i spróbuj ponownie.');
    const { plan, summary } = buildPlan(s0.items, d0.k);
    if (!plan.length) return say(`Torba ${d0.k + 1}: nie ma czego łączyć.`);
    busy = true;
    say(`Torba ${d0.k + 1}: łączę… (${plan.length} kroków)`);
    let done = 0; const log = [], dead = new Set();
    try {
      for (const s of plan) {
        if (dead.has(s.key)) continue;
        const dst0 = byId(s.dstId), src0 = byId(s.srcId);
        if (!dst0 || !src0) { log.push(`„${s.name}”: ekwipunek się zmienił – pomijam.`); dead.add(s.key); continue; }
        if (dst0.amount >= dst0.cap) { dead.add(s.key); continue; }
        await send(`moveitem&st=0&id=${s.srcId}&x=${dst0.x}&y=${dst0.y}`);
        const d1 = await waitGrow(s.dstId, dst0.amount);
        if (!(d1 && d1.amount > dst0.amount)) {
          if (!S.verified && done === 0 && s.full) {
            log.push('Pierwsze łączenie nie zadziałało (stos nie urósł) – przerywam. Wklej mi wynik Diagnostyki.');
            break;
          }
          log.push(`„${s.name}”: gra nie połączyła stosów${s.full ? '' : ' częściowo'} – pomijam ten przedmiot.`);
          dead.add(s.key); continue;
        }
        done++;
        if (!S.verified) { S.verified = true; save(); }
        await sleep(200);
      }
    } finally { busy = false; }
    const now = snap().items.filter(i => i.bag === d0.k);
    const lines = summary.map(g => {
      const after = now.filter(i => keyOf(i) === g.key).map(i => i.amount).sort((a, b) => b - a);
      return `• ${g.name}: ${g.before.join(', ')} → ${after.join(', ')}`;
    });
    say(`Torba ${d0.k + 1}: wykonano ${done} z ${plan.length} kroków\n` + lines.join('\n') + (log.length ? '\n\n' + log.join('\n') : ''));
    updateNote();
  }

  /* ---------- sortowanie otwartej torby (tylko przeniesienia na wolne miejsca) ---------- */
  const QUAL = ['artefact', 'legendary', 'upgraded', 'heroic', 'unique', 'common', 'none'];
  const SORTS = {
    name: { n: 'po nazwie', f: (a, b) => a.name.localeCompare(b.name, 'pl') },
    type: { n: 'po typie', f: (a, b) => a.cl - b.cl || a.name.localeCompare(b.name, 'pl') },
    qual: { n: 'po jakości', f: (a, b) => ((QUAL.indexOf(a.rar) + 1 || 99) - (QUAL.indexOf(b.rar) + 1 || 99)) || a.name.localeCompare(b.name, 'pl') },
  };
  // plan: miejsce j dostaje j-ty przedmiot; zajmujący je obcy przedmiot idzie najpierw na wolne miejsce dalej w torbie
  function sortPlan(items, b, mode) {
    const cells = [];
    for (let j = 0; j < b.cap; j++) cells.push([j % COLS, b.from + Math.floor(j / COLS)]);
    const its = items.filter(i => i.bag === b.idx), at = new Array(b.cap).fill(null), where = {};
    for (const i of its) {
      const j = cells.findIndex(c => c[0] === i.x && c[1] === i.y);
      if (j < 0 || at[j] !== null) return { err: 'nietypowy układ torby – nie sortuję.' };
      at[j] = i.id; where[i.id] = j;
    }
    if (its.length >= b.cap) return { err: 'torba jest pełna – do sortowania potrzebne jest co najmniej 1 wolne miejsce.' };
    const order = [...its].sort((a, c) => SORTS[mode].f(a, c) || c.amount - a.amount || where[a.id] - where[c.id]).map(i => i.id);
    const goal = {}; order.forEach((id, j) => { goal[id] = j; });
    const moves = [];
    const mv = (id, j) => { at[where[id]] = null; at[j] = id; where[id] = j; moves.push({ id, x: cells[j][0], y: cells[j][1] }); };
    order.forEach((id, j) => {
      if (at[j] === id) return;
      if (at[j] !== null) {
        const o = at[j], g = goal[o];
        mv(o, g > j && at[g] === null ? g : at.findIndex((v, k) => k > j && v === null));
      }
      mv(id, j);
    });
    return { moves };
  }
  let sorting = false, stopSort = false;
  async function waitPos(id, x, y, amount, ms = 2500) {
    for (let t = 0; t < ms; t += 150) {
      await sleep(150);
      const d = byId(id);
      if (d && d.x === x && d.y === y) return d.amount === amount;
    }
    return false;
  }
  async function sortBag(mode) {
    if (busy) { if (sorting) { stopSort = true; say('Zatrzymuję sortowanie…'); } else say('Trwa inna akcja…'); return; }
    const s0 = snap(), d0 = detectBag(s0.items, s0.L);
    if (!d0) return say('Nie wykryto otwartej torby. Otwórz torbę w grze i spróbuj ponownie.');
    const k = d0.k, r = sortPlan(s0.items, s0.L[k], mode);
    if (r.err) return say(`Torba ${k + 1}: ${r.err}`);
    if (!r.moves.length) return say(`Torba ${k + 1}: już posortowana ${SORTS[mode].n}.`);
    busy = sorting = true; stopSort = false;
    let done = 0, msg = '';
    try {
      for (const m of r.moves) {
        if (stopSort) { msg = 'Zatrzymano na Twoje kliknięcie.'; break; }
        const cur = readItems(), it = cur.find(i => i.id === m.id);
        if (!it) { msg = 'Przedmiot zniknął z torby – przerywam.'; break; }
        if (cur.some(i => i.st === 0 && i.x === m.x && i.y === m.y)) { msg = 'Docelowe miejsce jest zajęte (ekwipunek się zmienił) – przerywam.'; break; }
        say(`Torba ${k + 1}: sortuję ${SORTS[mode].n}… krok ${done + 1} z ${r.moves.length}\n(kliknij dowolny przycisk sortowania, żeby zatrzymać)`);
        await send(`moveitem&st=0&id=${m.id}&x=${m.x}&y=${m.y}`);
        if (!(await waitPos(m.id, m.x, m.y, it.amount))) {
          msg = `Gra nie przeniosła „${it.name}” – przerywam.` + (done ? '' : ' Wklej mi wynik Diagnostyki.');
          break;
        }
        done++;
        await sleep(300);
      }
    } finally { busy = sorting = false; }
    say(`Torba ${k + 1}: sortowanie ${SORTS[mode].n} – wykonano ${done} z ${r.moves.length} przeniesień.` + (msg ? '\n' + msg : ''));
    updateNote();
  }

  /* ---------- obserwowane przedmioty ---------- */
  const wState = {}, iconImgs = {}, iconTried = {};
  const wLevel = (n, w) => n >= w.warn ? 0 : (n <= Math.floor(w.warn * S.watchCrit / 100) ? 2 : 1);

  function renderWList() {
    $('#mbt-wlist').innerHTML = S.watch.length
      ? S.watch.map((w, i) => `<div class="wl"><span class="wn" title="${esc(w.name)}">${esc(w.name)}</span><span>alert &lt;</span><input class="s n" type="number" min="1" data-wwarn="${i}" value="${w.warn}"><button class="ib" data-wdel="${i}" title="Przestań obserwować">✕</button></div>`).join('')
      : '<div class="note">Brak obserwowanych przedmiotów.</div>';
  }
  function wFind() {
    const terms = norm($('#mbt-wname').value).split(/\s+/).filter(Boolean);
    if (!terms.length) return;
    const names = [...new Set(snap().items.filter(i => i.st === 0 && terms.every(t => norm(i.name).includes(t))).map(i => i.name))]
      .filter(n => !S.watch.some(w => w.name === n)).slice(0, 12);
    $('#mbt-wpick').innerHTML = names.length
      ? names.map(n => `<button class="chip" data-wadd="${esc(n)}" title="Dodaj do obserwowanych">＋ ${esc(n)}</button>`).join('')
      : '<span class="note">Nie znaleziono w plecaku (przedmiot musi tam być, żeby go dodać).</span>';
  }
  function wAdd(name) {
    if (S.watch.some(w => w.name === name) || S.watch.length >= 20) return;
    S.watch.push({ name, warn: 50 });
    S.watchShow = true;
    $('#mbt-wpick').innerHTML = ''; $('#mbt-wname').value = '';
    renderWList(); view(); bgTick();
  }
  function wDel(i) {
    const w = S.watch.splice(i, 1)[0];
    if (w) delete wState[w.name];
    renderWList(); view(); bgTick();
  }
  // dodanie obserwowanego przedmiotu na podstawie elementu przedmiotu z gry (przeciągnięcie lub kliknięcie)
  function addFromItem(id, domEl) {
    const it = snap().items.find(i => i.id === String(id));
    if (!it || !it.name) return toast('Nie rozpoznano przedmiotu', RED);
    if (it.st !== 0) return toast('Obserwować można tylko przedmioty z torby', YEL);
    if (S.watch.some(w => w.name === it.name)) return toast('Już obserwowany: ' + it.name, YEL);
    if (S.watch.length >= 20) return toast('Limit 20 obserwowanych przedmiotów', RED);
    const w = { name: it.name, warn: 50 };
    try {                                   // grafika z elementu w grze
      const c = domEl && domEl.querySelector && domEl.querySelector('canvas');
      if (c && c.width > 0) {
        const t = document.createElement('canvas'); t.width = t.height = 28;
        const x = t.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(c, 0, 0, c.width, c.height, 0, 0, 28, 28);
        w.icon = t.toDataURL('image/png');
      }
    } catch {}
    S.watch.push(w); S.watchShow = true;
    renderWList(); view(); bgTick();
    toast('👁 Obserwuję: ' + it.name, OK);
  }
  let pick = false, pickTimer = 0, press = null;
  function setPick(on) {
    pick = on; clearTimeout(pickTimer);
    document.documentElement.classList.toggle('mbt-pick', on);
    $$('[data-wtarget]').forEach(b => { b.textContent = on ? '… kliknij przedmiot w torbie (Esc)' : '🎯 Wskaż w grze'; b.classList.toggle('on', on); });
    if (on) pickTimer = setTimeout(() => setPick(false), 20000);
  }
  // tryb wskazywania: klik w przedmiot w grze jest przechwycony (przedmiot NIE jest używany)
  const pickHandler = e => {
    if (!pick) return;
    const n = e.target && e.target.closest && e.target.closest('.item[class*="item-id-"]');
    if (!n || root.contains(n)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'click') {
      const m = /item-id-(\d+)/.exec(cls(n));
      setPick(false);
      if (m) addFromItem(m[1], n);
    }
  };
  ['mousedown', 'mouseup', 'click', 'dblclick', 'pointerdown', 'pointerup', 'contextmenu'].forEach(t => document.addEventListener(t, pickHandler, true));
  // przeciąganie przedmiotu z torby na ramkę w okienku: zapamiętujemy przedmiot, który został wciśnięty myszą
  // (tylko obserwacja – zdarzenia trafiają do gry bez zmian); ruch o ponad 6 px = przeciąganie
  const at = (e, sel) => document.elementsFromPoint(e.clientX, e.clientY).some(n => n.closest && n.closest(sel));
  document.addEventListener('mousedown', e => {
    if (replay) return;
    press = null;
    if (e.button !== 0 || pick) return;
    const n = e.target && e.target.closest && e.target.closest('.item[class*="item-id-"]');
    const m = n && !root.contains(n) && /item-id-(\d+)/.exec(cls(n));
    if (m) press = { id: m[1], el: n, x: e.clientX, y: e.clientY, drag: false };
  }, true);
  document.addEventListener('mousemove', e => {
    if (!press || replay) return;
    if (!press.drag && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 6) press.drag = true;
    if (press.drag) { const hot = at(e, '[data-wslot]'); $$('.wslot').forEach(s => s.classList.toggle('hot', hot)); }
  }, true);
  // puszczenie przedmiotu nad oknem dodatku: gra nie dostaje tego puszczenia, tylko puszczenie w miejscu, skąd przedmiot
  // wzięto – przedmiot wraca na swoje miejsce zamiast trafić „na ziemię” (pytanie o wyrzucenie/zniszczenie)
  let replay = false;
  const fire = (type, x, y) => {
    const C = type.startsWith('pointer') && window.PointerEvent ? PointerEvent : MouseEvent;
    (document.elementFromPoint(x, y) || document.body).dispatchEvent(new C(type, {
      bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: type.endsWith('up') ? 0 : 1, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    }));
  };
  const release = e => {
    if (replay || e.button !== 0) return;
    const p = press;
    if (!p || !p.drag) { if (e.type === 'mouseup') press = null; return; }
    $$('.wslot').forEach(s => s.classList.remove('hot'));
    const onUs = p.done || at(e, '#mbt-root .win,#mbt-root .dock,#mbt-root .launcher');
    if (e.type === 'mouseup') press = null;
    if (!onUs) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (p.done) return;                                     // pointerup już obsłużony, to jego mouseup
    p.done = true;
    noteDrop(p);
    if (at(e, '[data-wslot]')) addFromItem(p.id, p.el);
    replay = true;
    try { ['pointermove', 'mousemove', 'pointerup', 'mouseup'].forEach(t => fire(t, p.x, p.y)); } catch {}
    replay = false;
    setTimeout(() => { if (press === p) press = null; }, 1000);
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('mouseup', release, true);
  // co gra robi po upuszczeniu przedmiotu na okno dodatku (do Diagnostyki: komendy i nowe okienka przez 3 s)
  let drop = null, dropObs = null;
  function noteDrop(p) {
    const it = readItems().find(i => i.id === p.id);
    drop = { t: Date.now(), name: it ? it.name : '#' + p.id, cmds: [], wins: [], ui: '' };
    try {
      const j = window.jQuery || window.$, ui = j && j.ui, dd = ui && ui.ddmanager;
      drop.ui = ui ? `jQuery UI ${ui.version || '?'}` + (dd && dd.droppables ? `, strefy upuszczania: ${Object.values(dd.droppables).reduce((n, a) => n + (a.length || 0), 0)}` : '') : 'brak jQuery UI';
    } catch {}
    try {
      if (dropObs) dropObs.disconnect();
      const d = drop;
      dropObs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && !root.contains(n) && d.wins.length < 8 && cls(n)) d.wins.push(n.tagName + '.' + cls(n).slice(0, 70));
      })));
      dropObs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { if (dropObs) dropObs.disconnect(); dropObs = null; }, 3000);
    } catch {}
  }
  const dropCmd = c => { if (drop && Date.now() - drop.t < 3000 && drop.cmds.length < 8) drop.cmds.push(c.slice(0, 80)); };

  // grafika przedmiotu: kanwa ikony z gry (jeśli dostępna), potem zapisana kopia
  function iconSrc(ref) {
    try {
      const j = ref && ref.$canvasIcon, c = j && (j[0] || j);
      if (c && c.getContext && c.width > 0) return c;
      const s = ref && ref.sprite;
      if (s && (s.naturalWidth || s.width)) return s;
    } catch {}
    return null;
  }
  function paintIcons(refs) {
    $$('#mbt-watchrows canvas').forEach(cv => {
      const w = S.watch[+cv.dataset.wi];
      if (!w) return;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 28, 28); ctx.imageSmoothingEnabled = false;
      const src = iconSrc(refs[w.name]);
      try {
        if (src) {
          ctx.drawImage(src, 0, 0, src.naturalWidth || src.width, src.naturalHeight || src.height, 0, 0, 28, 28);
          if (!w.icon && !iconTried[w.name]) { iconTried[w.name] = 1; try { w.icon = cv.toDataURL('image/png'); save(); } catch {} }
          return;
        }
        if (w.icon) {
          let im = iconImgs[w.name];
          if (!im || im.src !== w.icon) { im = iconImgs[w.name] = new Image(); im.src = w.icon; }
          if (im.complete && im.naturalWidth) { ctx.drawImage(im, 0, 0, 28, 28); return; }
        }
      } catch {}
      ctx.font = '18px Arial'; ctx.fillText('🎁', 4, 21);
    });
  }
  let rowsHTML = '';
  function watchTick(sn) {
    if (!S.watch.length) { if (S.open.watch) $('#mbt-watchrows').innerHTML = rowsHTML = ''; return; }
    const cnt = {}, refs = {}, now = Date.now();
    sn.items.forEach(i => {
      if (i.st !== 0) return;
      cnt[i.name] = (cnt[i.name] || 0) + i.amount;
      if (!refs[i.name]) refs[i.name] = i.ref;
    });
    if (S.open.watch) {
      const html = S.watch.map((w, i) => {
        const n = cnt[w.name] || 0;
        return `<div class="wr l${wLevel(n, w)}" title="${esc(w.name)}"><canvas width="28" height="28" data-wi="${i}"></canvas><span class="wn">${esc(w.name)}</span><b>${n}</b><small>/${w.warn}</small><button class="ib wx" data-wdel="${i}" title="Przestań obserwować">✕</button></div>`;
      }).join('');
      // przebudowa tylko przy zmianie – inaczej kliknięcia w ✕ ginęły przy odświeżaniu co 2 s
      if (html !== rowsHTML) { $('#mbt-watchrows').innerHTML = rowsHTML = html; }
      paintIcons(refs);
    }
    S.watch.forEach(w => {
      const n = cnt[w.name] || 0, l = wLevel(n, w), st = wState[w.name] || (wState[w.name] = { l: 0, t: 0 });
      if (l > 0 && (l > st.l || (S.watchRemind > 0 && now - st.t >= S.watchRemind * 1000))) {
        toast(l === 2 ? `‼ Bardzo mało: ${w.name} — ${n} szt. (próg ${w.warn})` : `⚠ Mało: ${w.name} — ${n} szt. (próg ${w.warn})`, l === 2 ? RED : YEL);
        st.t = now;
      }
      st.l = l;
    });
  }

  /* ---------- dziennik zdobyczy: dropy z potworów i skrzynek (heroiki, legendy, smocze runy) ---------- */
  const LKEY = 'mbt-loot-v1', LOOT_RARS = ['heroic', 'legendary'];
  const LCOL = { heroic: '#ff9d00', legendary: '#ff5ee0', rune: '#ffd166' };
  const LNAME = { heroic: 'Heroiczny', legendary: 'Legendarny', rune: 'Smocze Runy' };
  const isRune = name => /smocz\w*\s+run/.test(norm(name));
  let LOOT = {};
  try { LOOT = JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch {}
  if (!Array.isArray(LOOT.log)) LOOT.log = [];
  const nick = () => {
    try {
      const E = window.Engine;
      return (E && E.hero && ((E.hero.d && E.hero.d.nick) || E.hero.nick)) || (window.hero && window.hero.nick) || '?';
    } catch { return '?'; }
  };
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dd = t => new Date(t).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  function renderLoot() {
    const t0 = dayStart(Date.now()), days = {}, who = {};
    LOOT.log.forEach(e => {
      if (!(e.rar in LNAME)) return;
      const n = e.n || 1, d = dayStart(e.t), o = days[d] || (days[d] = { heroic: 0, legendary: 0, rune: 0 });
      o[e.rar] += n;
      if (d === t0 && e.rar !== 'rune') who[e.who] = (who[e.who] || 0) + n;
    });
    const td = days[t0] || { heroic: 0, legendary: 0, rune: 0 };
    $('#mbt-lootsum').innerHTML =
      `<span class="chip on">Dziś od 00:00 · Heroiczne: ${td.heroic}</span><span class="chip on">Legendarne: ${td.legendary}</span><span class="chip on">Smocze Runy: ${td.rune}</span>` +
      Object.entries(who).map(([w, n]) => `<span class="chip">${esc(w)}: ${n}</span>`).join('');
    const hm = t => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const dl = Object.keys(days).map(Number).sort((a, b) => b - a).slice(0, 7)
      .map(d => `${dd(d)}${d === t0 ? ' (dziś)' : ''} — heroiczne ${days[d].heroic} · legendarne ${days[d].legendary} · runy ${days[d].rune}`);
    const last = LOOT.log.filter(e => e.rar in LNAME).slice(-60).reverse()
      .map(e => `${dd(e.t)} ${hm(e.t)} · ${e.who} · ${e.rar === 'rune' ? 'Smocze Runy ×' + (e.n || 1) : '[' + LNAME[e.rar] + '] ' + e.name}`);
    $('#mbt-lootlog').textContent = (dl.length ? 'Dni:\n' + dl.join('\n') + '\n\nOstatnie dropy:\n' : '') + last.join('\n');
  }
  function addLoot(name, rar, n) {
    try { const cur = JSON.parse(localStorage.getItem(LKEY) || '{}'); if (Array.isArray(cur.log)) LOOT.log = cur.log; } catch {}
    LOOT.log.push({ t: Date.now(), who: nick(), name, rar, n });
    LOOT.log = LOOT.log.slice(-1500);
    try { localStorage.setItem(LKEY, JSON.stringify(LOOT)); } catch {}
    renderLoot();
    if (S.lootToast) toast(rar === 'rune' ? `🎁 Smocze Runy ×${n}` : `🎁 ${LNAME[rar]}: ${name}`, LCOL[rar] || YEL);
  }

  // sygnały źródła przedmiotu: okno łupu / skrzynka (liczymy) vs depozyt, handel, aukcje, sklep, poczta (pomijamy)
  const sig = { loot: 0, excl: 0, chest: 0 }, cmds = [];
  let sigInfo = { loot: [], excl: [] }, hooked = false;
  const LOOT_RE = /loot/i, EXCL_RE = /depo|trade|auction|aukc|shop|mail|bank/i;
  function sigTick() {
    try {
      const now = Date.now(), L = new Set(), X = new Set();
      document.querySelectorAll('[class*="loot" i],[class*="depo" i],[class*="trade" i],[class*="auction" i],[class*="aukc" i],[class*="shop" i],[class*="mail" i],[class*="bank" i]').forEach(n => {
        if (root.contains(n)) return;
        const r = n.getBoundingClientRect();
        if (r.width * r.height < 3000) return;
        const c = cls(n);
        if (EXCL_RE.test(c)) { sig.excl = now; X.add(c.slice(0, 60)); }
        else if (LOOT_RE.test(c)) { sig.loot = now; L.add(c.slice(0, 60)); }
      });
      sigInfo = { loot: [...L].slice(0, 6), excl: [...X].slice(0, 6) };
    } catch {}
  }
  setInterval(sigTick, 500);
  const lootbox = it => {
    try {
      const r = it.ref;
      return !!(r.issetLootboxStat && r.issetLootboxStat()) || !!(r.issetLootbox2Stat && r.issetLootbox2Stat()) || /skrzyn|kufer/.test(norm(it.name));
    } catch { return false; }
  };
  function noteCmd(c) {
    if (/^moveitem&st=0/.test(c)) return;                       // nasze łączenie stosów
    const now = Date.now();
    cmds.push({ t: now, c: c.slice(0, 60) }); if (cmds.length > 12) cmds.shift();
    if (/^loot/.test(c)) sig.loot = now;
    else if (/^(depo|trade|auction|shop|mail|bank)/i.test(c)) sig.excl = now;
    else {
      const m = /^moveitem&st=1&id=(\d+)/.exec(c);              // użycie przedmiotu – skrzynka?
      if (m) { const it = readItems().find(i => i.id === m[1]); if (it && lootbox(it)) sig.chest = now; }
    }
  }
  function hookG() {                                            // tylko obserwacja komend wysyłanych do serwera
    try {
      const orig = window._g;
      if (typeof orig !== 'function') return;
      if (orig.__mbt) { hooked = true; return; }
      const wrap = function (...a) {
        try { if (typeof a[0] === 'string') { noteCmd(a[0]); dropCmd(a[0]); } } catch {}
        return orig.apply(this, a);
      };
      wrap.__mbt = 1;
      Object.keys(orig).forEach(k => { try { wrap[k] = orig[k]; } catch {} });
      window._g = wrap; hooked = true;
    } catch {}
  }
  function srcKind(now) {
    const r = k => sig[k] && now - sig[k] < 10000;
    const good = Math.max(sig.loot, sig.chest);
    if (r('excl') && (!(r('loot') || r('chest')) || sig.excl > good)) return 'skip';
    if (r('loot') || r('chest')) return 'drop';
    return 'unknown';
  }
  const countIt = now => { const k = srcKind(now); return k === 'drop' || (k === 'unknown' && S.lootLoose); };

  let lootSeen = null, lootCount = -1, lootStable = 0, runeLast = 0, lastDay = dayStart(Date.now());
  const lootTry = {};
  function lootTick(sn) {
    const now = Date.now(), n = sn.items.length;
    if (dayStart(now) !== lastDay) { lastDay = dayStart(now); renderLoot(); }   // zmiana dnia o 00:00
    const runes = sn.items.filter(i => i.st === 0 && isRune(i.name)).reduce((s, i) => s + i.amount, 0);
    if (!lootSeen) {                       // punkt odniesienia dopiero, gdy ekwipunek przestanie się doładowywać
      lootStable = n === lootCount ? lootStable + 1 : 0; lootCount = n;
      if (n > 0 && lootStable >= 3) { lootSeen = new Set(sn.items.map(i => i.id)); runeLast = runes; }
      return;
    }
    if (runes > runeLast && countIt(now)) addLoot('Smocze Runy', 'rune', runes - runeLast);
    runeLast = runes;                      // spadek (wymiana na SŁ) tylko przesuwa punkt odniesienia
    sn.items.forEach(i => {
      if (lootSeen.has(i.id)) return;
      if (!i.stat && (lootTry[i.id] = (lootTry[i.id] || 0) + 1) < 4) return;   // poczekaj na statystyki
      lootSeen.add(i.id);
      if (LOOT_RARS.includes(i.rar) && !isRune(i.name) && countIt(now)) addLoot(i.name, i.rar, 1);
    });
  }

  function bgTick() {
    try {
      const sn = snap();
      if (!sn.L.length) return;
      watchTick(sn); lootTick(sn);
    } catch {}
  }
  setInterval(bgTick, 2000);

  /* ---------- diagnostyka ---------- */
  function diag() {
    const { items, L } = snap(), d = detectBag(items, L);
    const nav = document.querySelector('.bags-navigation');
    const navCls = nav ? [...nav.querySelectorAll('*')].slice(0, 14).map(n => n.tagName + '.' + cls(n).slice(0, 110)) : ['(brak .bags-navigation)'];
    const bp = items.filter(i => i.st === 0);
    const stk = bp.find(i => i.stackable);
    const rars = {}; bp.forEach(i => { rars[i.rar] = (rars[i.rar] || 0) + 1; });
    const ic = bp.find(i => iconSrc(i.ref));
    const ago = t => t ? Math.round((Date.now() - t) / 1000) + ' s temu' : 'nigdy';
    say([
      `Wersja skryptu: ${VER} | postać: ${nick()}`,
      `_g: ${typeof window._g} | przedmiotów: ${items.length} | w plecaku: ${bp.length} | poza torbami: ${bp.filter(i => i.bag < 0).length}`,
      'Torby: ' + (L.map(b => `#${b.idx + 1} ${b.name} cap=${b.cap} rzędy ${b.from}-${b.to} szt.=${items.filter(i => i.bag === b.idx).length}`).join(' | ') || 'brak'),
      'Rzadkości w plecaku: ' + (Object.entries(rars).map(([k, v]) => `${k}:${v}`).join(' ') || '-'),
      `Grafika przedmiotów dostępna: ${ic ? 'tak (' + ic.name + ')' : 'NIE'}`,
      `Dziennik zdobyczy: punkt odniesienia ${lootSeen ? 'ustawiony (' + lootSeen.size + ' przedm.)' : 'jeszcze nie'}, wpisów: ${LOOT.log.length}, tryb ${S.lootLoose ? 'luźny' : 'ścisły'}`,
      `Sygnały źródła: łup ${ago(sig.loot)}, skrzynka ${ago(sig.chest)}, wykluczające ${ago(sig.excl)} | _g zahaczone: ${hooked ? 'tak' : 'nie'}`,
      `Okna łupu: ${sigInfo.loot.join(' ; ') || '-'} | okna wykluczające: ${sigInfo.excl.join(' ; ') || '-'}`,
      `Ostatnie komendy: ${cmds.slice(-8).map(c => c.c).join(' | ') || '-'}`,
      `Widoczne węzły przedmiotów w DOM: ${visibleIds().size}`,
      drop ? `Ostatnie upuszczenie na okno dodatku (${ago(drop.t)}): ${drop.name} | ${drop.ui || '-'} | komendy gry: ${drop.cmds.join(' ; ') || 'brak'} | nowe elementy: ${drop.wins.join(' ; ') || 'brak'}`
        : 'Ostatnie upuszczenie na okno dodatku: jeszcze nie było',
      `Wykryta otwarta torba: ${d ? (d.k + 1) + ' (' + d.how + ')' : 'NIE WYKRYTO'}`,
      stk ? `Przykład stosu: ${stk.name} tpl=${stk.tpl} szt.=${stk.amount} cap=${stk.cap}` : 'Brak stosów w plecaku',
      'Nawigacja toreb (klasy):', ...navCls,
      'HTML nawigacji:', nav ? nav.outerHTML.slice(0, 900) : '-',
    ].join('\n'));
  }

  $('#mbt-find').onclick = find;
  $('#mbt-clear').onclick = () => {
    $('#mbt-search').value = ''; S.rar = []; S.last = ''; rarKey = ''; renderRar(); out.style.display = 'none'; save();
  };
  $('#mbt-search').addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
  $('#mbt-wname').addEventListener('keydown', e => { if (e.key === 'Enter') wFind(); });
  $('#mbt-wfind').onclick = wFind;
  $('#mbt-dups').onclick = dups;
  $('#mbt-diag').onclick = diag;
  $('#mbt-merge').onclick = merge;
  $('#mbt-lootclear').onclick = () => {
    if (!confirm('Wyczyścić dziennik zdobyczy?')) return;
    LOOT.log = []; try { localStorage.setItem(LKEY, JSON.stringify(LOOT)); } catch {}
    renderLoot();
  };

  /* ---------- kopia ustawień (eksport / import) ---------- */
  const EXPORT_SKIP = ['last', 'verified', 'sv'];
  $('#mbt-exp').onclick = async () => {
    const o = {};
    Object.keys(def).filter(k => !EXPORT_SKIP.includes(k)).forEach(k => { o[k] = S[k]; });
    const txt = JSON.stringify({ mbt: VER, settings: o }), io = $('#mbt-io');
    io.value = txt;
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch {}
    if (!ok) { io.select(); try { ok = document.execCommand('copy'); } catch {} }
    $('#mbt-ionote').textContent = ok ? 'Skopiowano do schowka.' : 'Skopiuj tekst z pola ręcznie (Ctrl+C).';
  };
  $('#mbt-imp').onclick = () => {
    try {
      const o = JSON.parse($('#mbt-io').value.trim());
      if (!o || typeof o !== 'object' || !o.settings || typeof o.settings !== 'object') throw 0;
      importSettings(o.settings);
      $('#mbt-ionote').textContent = 'Zaimportowano ustawienia.';
    } catch { $('#mbt-ionote').textContent = 'Niepoprawny tekst kopii.'; }
  };
  function importSettings(o) {
    const num = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? clamp(v, a, b) : d; };
    S.alpha = num(o.alpha, 35, 100, S.alpha); S.scale = num(o.scale, 40, 130, S.scale); S.font = num(o.font, 11, 18, S.font);
    S.accent = Math.floor(num(o.accent, 0, COLORS.length - 1, S.accent));
    if (THEMES[o.theme]) S.theme = o.theme;
    ['compact', 'showCount', 'lootToast', 'lootLoose', 'watchShow']
      .forEach(k => { if (typeof o[k] === 'boolean') S[k] = o[k]; });
    S.watchCrit = Math.floor(num(o.watchCrit, 1, 99, S.watchCrit)); S.watchRemind = Math.floor(num(o.watchRemind, 0, 3600, S.watchRemind));
    if (o.pos && typeof o.pos === 'object') {
      for (const k of Object.keys(def.pos)) { const p = o.pos[k]; if (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) S.pos[k] = [p[0], p[1]]; }
    }
    if (o.keys && typeof o.keys === 'object') {
      for (const a of ACTIONS) { const b = o.keys[a.id]; if (Array.isArray(b) && b.length <= 3 && b.every(x => typeof x === 'string' && x.length < 30)) S.keys[a.id] = b; }
    }
    if (Array.isArray(o.history)) S.history = o.history.filter(x => typeof x === 'string').slice(0, 8);
    if (Array.isArray(o.watch)) {
      S.watch = o.watch.filter(w => w && typeof w.name === 'string' && w.name.length < 120).slice(0, 20).map(w => ({
        name: w.name, warn: Math.max(1, Math.floor(+w.warn) || 50),
        icon: /^data:image\/(png|gif|webp);base64,[A-Za-z0-9+/=]{0,20000}$/.test(w.icon || '') ? w.icon : undefined,
      }));
    }
    save(); apply(); view(); renderKeys(); renderHist(); renderWList(); bgTick();
  }

  /* ---------- własne skróty klawiszowe (1–3 klawisze naraz) ---------- */
  const ACTIONS = [
    { id: 'toggle', label: 'Otwórz/zamknij okno', run() { dockOpen = !dockOpen; if (!dockOpen) WIN_IDS.forEach(id => { S.open[id] = false; }); view(); } },
    { id: 'merge', label: 'Połącz identyczne (torba)', run() { S.open.torba = dockOpen = true; view(); merge(); } },
    { id: 'find', label: 'Szukaj przedmiotu', run() { S.open.torba = dockOpen = true; S.fold.search = false; applyFold(); view(); $('#mbt-search').focus(); } },
  ];
  const tok = c => /^Alt/.test(c) ? 'Alt' : /^Control/.test(c) ? 'Ctrl' : /^Shift/.test(c) ? 'Shift' : /^(Meta|OS)/.test(c) ? 'Meta' : c;
  const NAMES = { Space: 'Spacja', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=' };
  const label = t => NAMES[t] || (/^Key/.test(t) ? t.slice(3) : /^Digit/.test(t) ? t.slice(5) : /^Numpad/.test(t) ? 'Num ' + t.slice(6) : t);
  const fmt = a => a.map(label).join(' + ').toUpperCase();
  const isMod = t => t === 'Alt' || t === 'Ctrl' || t === 'Meta';
  function typing(t) { return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }

  let rec = null;
  const down = new Set();
  function renderKeys() {
    $('#mbt-keys').innerHTML = ACTIONS.map(a => {
      const on = rec && rec.id === a.id, k = S.keys[a.id] || [];
      const txt = on ? (rec.seq.length ? fmt(rec.seq) + ' …' : 'Naciśnij klawisze…') : (k.length ? fmt(k) : '—');
      return `<div class="kb"><span>${a.label}</span><button class="b kbbtn${on ? ' rec' : ''}" data-kb="${a.id}" title="Kliknij i naciśnij 1–3 klawisze naraz">${txt}</button><button class="ib" data-kbclear="${a.id}" title="Usuń skrót">✕</button></div>`;
    }).join('');
  }
  function startRec(id) { rec = { id, seq: [], held: new Set() }; $('#mbt-keynote').textContent = ''; renderKeys(); }
  function stopRec() { rec = null; renderKeys(); }
  function finishRec() {
    const seq = rec.seq.slice(), id = rec.id, set = new Set(seq);
    let note = '';
    ACTIONS.forEach(a => {
      const b = S.keys[a.id] || [];
      if (a.id !== id && b.length === set.size && b.every(x => set.has(x))) { S.keys[a.id] = []; note = `Skrót zabrany akcji „${a.label}”.`; }
    });
    S.keys[id] = seq; rec = null; save(); renderKeys();
    $('#mbt-keynote').textContent = note;
  }
  $('#mbt-keysreset').onclick = () => { S.keys = JSON.parse(JSON.stringify(def.keys)); save(); $('#mbt-keynote').textContent = ''; renderKeys(); };
  document.addEventListener('mousedown', e => { if (rec && !root.contains(e.target)) stopRec(); }, true);

  window.addEventListener('keydown', e => {
    if (!e.code) return;
    const t = tok(e.code);
    if (pick && e.code === 'Escape') { setPick(false); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (rec) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape' && !rec.seq.length) return stopRec();
      rec.held.add(t);
      if (!rec.seq.includes(t) && rec.seq.length < 3) { rec.seq.push(t); renderKeys(); }
      return;
    }
    // synchronizacja modyfikatorów (na wypadek zgubionego keyup)
    [['Alt', e.altKey], ['Ctrl', e.ctrlKey], ['Shift', e.shiftKey], ['Meta', e.metaKey]].forEach(([m, on]) => { if (!on) down.delete(m); });
    down.add(t);
    let best = null;
    for (const a of ACTIONS) {
      const b = S.keys[a.id];
      if (!b || !b.length || !b.includes(t) || !b.every(x => down.has(x))) continue;
      if (typing(e.target) && !b.some(isMod)) continue;
      if (!best || b.length > S.keys[best.id].length) best = a;
    }
    if (best) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) best.run();
    }
  }, true);
  window.addEventListener('keyup', e => {
    if (!e.code) return;
    const t = tok(e.code);
    if (rec) {
      e.preventDefault(); e.stopImmediatePropagation();
      rec.held.delete(t);
      if (!rec.held.size && rec.seq.length) finishRec();
      return;
    }
    down.delete(t);
  }, true);
  window.addEventListener('blur', () => down.clear());

  /* ---------- start ---------- */
  renderKeys(); renderHist(); renderWList(); renderLoot();
  hookG(); setInterval(hookG, 10000);
  apply(); view();
  if (S.last) say('Ostatni wynik szukania:\n' + S.last);
})();
