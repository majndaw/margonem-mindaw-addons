// ==UserScript==
// @name         Margonem Bag Tools
// @namespace    margonem-bag-tools
// @version      0.21.0
// @description  Torba: szukanie, łączenie stosów, obserwowanie przedmiotów, dziennik zdobyczy (Margonem NI)
// @match        https://www.margonem.pl/*
// @match        https://*.margonem.pl/*
// @run-at       document-idle
// @grant        none
// @homepageURL  https://github.com/majndaw/margonem-mindaw-addons
// ==/UserScript==

(() => {
  'use strict';
  const VER = '0.21.0';
  // nowa wersja przejmuje GUI po starej (stare okno i style są usuwane)
  const prev = document.getElementById('mbt-root');
  if (prev) { if (prev.dataset.v === VER) return; prev.remove(); }
  document.querySelectorAll('style').forEach(s => { if (s.dataset.mbt || (s.textContent || '').includes('#mbt-root')) s.remove(); });

  /* ---------- ustawienia ---------- */
  const KEY = 'mbt-settings-v6';
  const COLORS = ['#2fd27a', '#3b82f6', '#e5484d', '#f08c3a', '#9b5cf0', '#ec4fb8', '#9aa4aa'];
  const THEMES = {
    ciemny: { n: 'Ciemny', bg: '14,19,21', card: '#151c1f', card2: '#1a2226', inp: '#0e1416', bd: '#263136', bd2: '#2f3c42', rail: '#11171a' },
    czarny: { n: 'Czarny', bg: '6,6,7', card: '#101112', card2: '#161718', inp: '#0a0a0b', bd: '#232426', bd2: '#2e3033', rail: '#0b0b0c' },
    grafit: { n: 'Grafit', bg: '26,28,32', card: '#23262b', card2: '#2a2e34', inp: '#1b1e22', bd: '#353a41', bd2: '#424851', rail: '#202327' },
    granat: { n: 'Granat', bg: '12,18,36', card: '#141d36', card2: '#1a2442', inp: '#0d1428', bd: '#26335a', bd2: '#32416e', rail: '#0f1630' },
  };
  const def = {
    sv: 3, alpha: 94, scale: 80, accent: 0, theme: 'ciemny', compact: false, font: 14, dock: false,
    showCount: true, verified: false, lootToast: true, lootLoose: false, hideOthers: false,
    watch: [], watchShow: true, watchCrit: 50, watchRemind: 0,
    pos: { dock: [20, 100], main: [20, 100], watch: [1125, 100] },
    open: { watch: false }, min: {}, fold: { 'h-log': true, depostudy: true },
    history: [], rar: [], lastFind: null, tab: 'torba', sortMode: 'qual',
    keys: { toggle: ['Alt', 'KeyT'], merge: ['Alt', 'KeyQ'], find: ['Alt', 'KeyF'] },
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  const S = Object.assign({}, def, saved);
  if ((saved.sv || 0) < 2) { S.scale = def.scale; S.sv = 2; }       // nowy, mniejszy domyślny rozmiar
  if ((saved.sv || 0) < 3) { S.alpha = Math.max(S.alpha, 90); S.sv = 3; }   // 0.21.0: nowy wygląd – mniej przezroczysty
  if (!['qual', 'name', 'type'].includes(S.sortMode)) S.sortMode = 'qual';
  for (const k of ['pos', 'open', 'keys', 'min', 'fold']) S[k] = Object.assign({}, def[k], S[k] || {});
  if (!Array.isArray(S.history)) S.history = [];
  if (!Array.isArray(S.rar)) S.rar = [];
  S.watch = (Array.isArray(S.watch) ? S.watch : []).filter(w => w && typeof w.name === 'string');
  if (!THEMES[S.theme]) S.theme = 'ciemny';
  // opcje usunięte w 0.15.0 (pozycja jest zawsze zapamiętywana, dock wraca w stanie sprzed odświeżenia)
  ['round', 'shadow', 'remember', 'onTop', 'minIcon', 'openStart', 'notify', 'sound', 'counter', 'hideAfter', 'last'].forEach(k => { delete S[k]; });
  ['torba', 'set', 'loot', 'help', 'depo'].forEach(k => { delete S.pos[k]; delete S.open[k]; });   // okna sprzed 0.21.0
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  };

  /* ---------- ikony, karty i zakładki głównego okna ---------- */
  // karta z tytułem (klik w tytuł zwija – stan w S.fold)
  const sec = (id, title, inner) =>
    `<div class="sec" data-sec="${id}"><h4 data-fold="${id}"><span>${title}</span><i class="chev">▾</i></h4><div class="sc">${inner}</div></div>`;
  // własny przełącznik zamiast pola wyboru: gra anuluje domyślne działanie kliknięć, przez co kwadraty „migały” i wracały
  const chk = (opt, label) => `<button type="button" class="tg" data-tg="${opt}"><i></i><span>${label}</span></button>`;
  const ICONS = {
    bag: '<path d="M9 7V6a3 3 0 0 1 6 0v1"/><rect x="4" y="7" width="16" height="14" rx="3"/><path d="M4 12h16"/>',
    depo: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01"/>',
    merge: '<path d="M6 3v6a6 6 0 0 0 6 6 6 6 0 0 1 6 6M18 3v6a6 6 0 0 1-3.5 5.5"/><path d="M15 6l3-3 3 3"/>',
    sort: '<path d="M3 6h13M3 12h9M3 18h5M18 8v12M15 17l3 3 3-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    load: '<path d="M12 3a9 9 0 1 0 9 9"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    min: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24">${ICONS[n]}</svg>`;
  // logo Mindaw: geometryczne „M” w sześciokątnej tarczy z kryształem (kolor akcentu)
  const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1.6 21 6.8v10.4l-9 5.2-9-5.2V6.8z" fill="currentColor" fill-opacity=".14" stroke-width="1.5"/><path d="M7 16.8V8.6l5 5.6 5-5.6v8.2" stroke-width="2.3"/><path d="M12 4.3l1.3 1.3L12 6.9l-1.3-1.3z" fill="currentColor" stroke-width="1"/></svg>';
  const gripHTML = id => `<span class="grip" data-grip="${id}" title="Przeciągnij, aby przenieść">${'<i></i>'.repeat(9)}</span>`;
  const wtBtn = (cls, lbl) => `<button class="${cls}" data-wtarget="1" data-lbl="${lbl}" title="Kliknij, a potem kliknij przedmiot w torbie (nie zostanie użyty)">${ic('target')}<span class="wtl">${lbl}</span></button>`;

  // zakładki głównego okna (pasek ikon po lewej); nowe funkcje dodawaj jako zakładkę
  const TABS = [
    {
      id: 'torba', icon: 'bag', title: 'Torba',
      html:
        `<div class="h"><b>Torba</b><span id="mbt-bagnote">–</span></div>
         <div class="card stat" id="mbt-bagstat"></div>
         <div class="row">
           <button class="btn pri grow" id="mbt-merge" title="Łączy identyczne stosy w otwartej torbie do limitu stosu">${ic('merge')}Połącz identyczne<kbd id="mbt-kmerge"></kbd></button>
           <div class="split"><button class="btn" id="mbt-sortbtn" title="Sortuje otwartą torbę (ponowny klik zatrzymuje)">${ic('sort')}<span id="mbt-sortlbl"></span></button><button class="btn caret" id="mbt-sortcaret" title="Wybierz sposób sortowania">▾</button>
             <div class="menu" id="mbt-sortmenu"><button data-sortmode="qual">Po jakości</button><button data-sortmode="name">Po nazwie</button><button data-sortmode="type">Po typie</button></div></div>
         </div>` +
        sec('search', 'Szukaj we wszystkich torbach',
          `<div class="inp">${ic('search')}<input id="mbt-search" placeholder="Wpisz nazwę przedmiotu… (Enter)" title="Polskie znaki nie są wymagane. Kilka słów = wszystkie muszą pasować."><button class="ibtn" id="mbt-clear" title="Wyczyść pole, filtry i wynik">${ic('x')}</button></div>
           <div class="chips" id="mbt-rar"></div>
           <div class="chips" id="mbt-hist"></div>
           <div class="row">${chk('showCount', 'Pokaż liczbę sztuk')}<button class="btn sm" id="mbt-find">Szukaj</button></div>`) +
        sec('extra', 'Narzędzia',
          `<div class="row"><button class="btn grow" id="mbt-dups" title="Pokazuje powtarzające się przedmioty w otwartej torbie">${ic('copy')}Duplikaty</button>
             <button class="btn grow" id="mbt-diag" title="Informacje techniczne do zgłaszania problemów">${ic('info')}Diagnostyka</button></div>`) +
        `<div class="out" id="mbt-out"></div>`,
    },
    {
      id: 'depo', icon: 'depo', title: 'Depozyt',
      html:
        `<div class="h"><b>Depozyt</b><span id="mbt-depohead">–</span></div>
         <div class="row">
           <button class="btn pri grow" id="mbt-depomerge" title="Łączy identyczne stosy na otwartej stronie depozytu przez torbę">${ic('merge')}<span>Połącz identyczne</span></button>
           <button class="btn grow" data-dsort="qual" title="Od najrzadszych: artefakt, legendarny, ulepszony, heroiczny, unikatowy, pospolity">${ic('sort')}<span>Sortuj po jakości</span></button>
         </div>
         <div class="card" id="mbt-depoplan"></div>
         <div class="out" id="mbt-depores"></div>
         <div class="note">${ic('info')}<span>Działa tylko na <b>otwartej stronie</b>. Łączenie: stosy idą do torby, łączą się do limitu i wracają na swoje miejsca. Sortowanie: po jednym, tylko na wolne pola (potrzebne 1 wolne miejsce). Każdy krok jest sprawdzany, ponowny klik zatrzymuje.</span></div>` +
        sec('depostudy', 'Badanie depozytu (dla autora)',
          `<div class="note">${ic('info')}<span>Te przyciski <b>nie wysyłają żadnych komend</b> – tylko czytają i zapisują, co się dzieje. Przydają się, gdy coś w depozycie nie działa.</span></div>
           <ol class="howto">
             <li>Otwórz depozyt w grze i kliknij <b>Zbadaj depozyt</b>.</li>
             <li>Kliknij <b>Nagrywaj</b> i zrób ręcznie, na tanich przedmiotach: przenieś przedmiot na wolne miejsce, z depozytu do torby i z powrotem, przełącz stronę. Potem <b>Zatrzymaj</b>.</li>
             <li>Kliknij <b>Kopiuj wynik</b> i wklej go autorowi.</li>
           </ol>
           <div class="row"><button class="btn grow" id="mbt-depostudy">${ic('search')}Zbadaj depozyt</button><button class="btn grow" id="mbt-deporec">⏺ Nagrywaj</button><button class="btn grow" id="mbt-depocopy">${ic('copy')}Kopiuj wynik</button></div>
           <div class="note" id="mbt-deponote"></div>
           <div class="out" id="mbt-depoout"></div>`),
    },
    {
      id: 'watch', icon: 'eye', title: 'Obserwowane',
      html:
        `<div class="h"><b>Obserwowane</b><span>alert, gdy zapas spadnie poniżej progu</span></div>` +
        sec('wadd', 'Dodaj przedmiot',
          `<div class="row"><div class="inp grow">${ic('search')}<input id="mbt-wname" placeholder="Nazwa przedmiotu… (Enter)" title="Wpisz fragment nazwy i kliknij Szukaj"></div><button class="btn" id="mbt-wfind">Szukaj</button></div>
           ${wtBtn('btn', 'Wskaż przedmiot w grze')}
           <div class="chips" id="mbt-wpick"></div>
           <div class="note">${ic('info')}<span>Możesz też przeciągnąć przedmiot z torby na ramkę w małym okienku Obserwowane.</span></div>`) +
        sec('wlist', 'Lista i progi alertu', `<div id="mbt-wlist"></div>`) +
        sec('wopt', 'Opcje',
          `${chk('watchShow', 'Pokaż małe okienko Obserwowane')}
           <div class="sr"><span class="lb">Czerwony alert przy (% progu)</span><input class="num" type="number" id="mbt-wcrit" min="1" max="99"></div>
           <div class="sr"><span class="lb">Przypominaj co (s), 0 = nie</span><input class="num" type="number" id="mbt-wremind" min="0" max="3600"></div>
           <button class="btn" data-wtest="1" title="Pokazuje przykładowe napisy na środku ekranu">Pokaż test napisów</button>`),
    },
    {
      id: 'loot', icon: 'gift', title: 'Zdobycze',
      html:
        `<div class="h"><b>Zdobycze</b><span>heroiki, legendy, smocze runy</span></div>
         <div class="chips" id="mbt-lootsum"></div>` +
        sec('lootlog', 'Dziennik', `<div class="logbox" id="mbt-lootlog"></div>`) +
        sec('loot', 'Opcje',
          `${chk('lootToast', 'Napis na środku ekranu po dropie')}
           ${chk('lootLoose', 'Tryb luźny: licz też, gdy nie da się ustalić źródła')}
           <div class="note">${ic('info')}<span>Liczy tylko przedmioty z potworów (e2, kolosy, tytani, herosi itp.) i ze skrzynek – nie z handlu, aukcji ani depozytu. „Dziś” liczy od 00:00. Dane są wspólne dla postaci na tym świecie.</span></div>
           <button class="btn" id="mbt-lootclear">Wyczyść dziennik</button>`),
    },
    {
      id: 'set', icon: 'gear', title: 'Ustawienia',
      html:
        `<div class="h"><b>Ustawienia</b></div>` +
        sec('look', 'Wygląd',
          `<div class="sr"><span class="lb">Kolor akcentu</span><div class="sw" id="mbt-sw"></div></div>
           <div class="sr"><span class="lb">Motyw</span><div class="seg">${Object.entries(THEMES).map(([k, v]) => `<button data-theme="${k}">${v.n}</button>`).join('')}</div></div>
           <div class="sr"><span class="lb">Skala</span><input type="range" id="mbt-scale" min="40" max="130"><span class="val" id="mbt-scale-l"></span></div>
           <div class="sr"><span class="lb">Czcionka</span><input type="range" id="mbt-font" min="11" max="18"><span class="val" id="mbt-font-l"></span></div>
           <div class="sr"><span class="lb">Przezroczystość</span><input type="range" id="mbt-alpha" min="35" max="100"><span class="val" id="mbt-alpha-l"></span></div>
           <div class="sr">${chk('compact', 'Tryb kompaktowy (mniejsze odstępy)')}</div>
           <div class="sr"><span class="lb">Położenie okien</span><button class="btn sm" data-layout="reset" title="Przywraca domyślne pozycje okien">Reset układu</button></div>`) +
        sec('keys', 'Skróty klawiszowe',
          `<div id="mbt-keys"></div>
           <div class="note">${ic('info')}<span>Kliknij skrót i naciśnij 1, 2 lub 3 klawisze naraz. Esc – anuluj. Skrótów przeglądarki (np. Ctrl+W) nie da się przejąć.</span></div>
           <div class="note" id="mbt-keynote"></div>
           <button class="btn" id="mbt-keysreset">Przywróć domyślne skróty</button>`) +
        sec('backup', 'Kopia ustawień',
          `<div class="row"><button class="btn grow" id="mbt-exp" title="Kopiuje ustawienia jako tekst">Eksportuj do schowka</button><button class="btn grow" id="mbt-imp" title="Wczytuje ustawienia z pola poniżej">Importuj z pola</button></div>
           <textarea class="s" id="mbt-io" rows="3" placeholder="Tu pojawi się wyeksportowany tekst. Do importu wklej tu kopię."></textarea>
           <div class="note" id="mbt-ionote"></div>`),
    },
    {
      id: 'help', icon: 'help', title: 'Pomoc',
      html: `<div class="h"><b>Pomoc</b><span>opis wszystkich funkcji</span></div><div class="help">` +
        sec('h-start', 'Podstawy obsługi',
          `<ul>
            <li>Wszystko jest w <b>jednym oknie</b>. Pasek ikon po lewej przełącza zakładki: Torba, Depozyt, Obserwowane, Zdobycze, a pod kreską Ustawienia i Pomoc. Ikona z ludźmi włącza/wyłącza ukrywanie graczy. Czerwona kropka przy oku = któryś obserwowany przedmiot się kończy.</li>
            <li><b>Kropki</b> w lewym górnym rogu (siatka 3×3) służą do przesuwania – tylko one. Główne okno, małe okienko Obserwowane i ikonę M przesuwasz osobno.</li>
            <li><b>–</b> zwija okno do paska tytułu, <b>×</b> zamyka – zostaje mała ikona <b>M Mindaw</b>, kliknij ją, żeby wrócić. Kliknięcie w tytuł karty zwija ją (stan jest zapamiętywany).</li>
            <li>Gdy coś się nie uda, na dole okna pojawia się <b>czerwony pasek błędu</b> z opisem; znika po × albo przy następnej udanej akcji. „Reset układu” w Ustawieniach przywraca pozycje okien. Okno nie wyjdzie za krawędź ekranu.</li>
            <li>Numer wersji widać przy nazwie okna. Nowa wersja skryptu sama zastępuje starą (stare okno jest usuwane); ustawienia zostają.</li>
            <li><b>Ładowanie z GitHuba:</b> w Tampermonkey jest tylko mały skrypt-ładowacz, który przy każdym wejściu do gry wczytuje najnowszą wersję z GitHub Pages (majndaw.github.io/margonem-mindaw-addons). Zmiana w repozytorium działa po odświeżeniu gry, zwykle po kilku minutach od zapisania.</li>
          </ul>`) +
        sec('h-merge', 'Łączenie identycznych stosów',
          `<ul>
            <li>Przycisk <b>Połącz identyczne</b> (zakładka Torba, lub Alt+Q) działa <b>tylko w otwartej torbie</b> – tej, którą masz aktualnie otwartą w grze. Na górze zakładki widzisz wykrytą torbę, zajęte miejsca i liczbę przedmiotów do połączenia.</li>
            <li>Łączy te same przedmioty o takich samych statystykach. Największy stos napełnia do limitu, a reszta zostaje w ostatnim stosie. Przykład: stosy 7, 4, 7 przy limicie 15 dadzą 15 i 3; stosy 9 i 9 przy limicie 10 dadzą 10 i 8.</li>
            <li>Po każdym kroku skrypt sprawdza, czy stos faktycznie urósł. Jeśli pierwsze łączenie nie zadziała, przerywa i nic dalej nie robi.</li>
            <li>Wynik pokazuje, co z czego powstało (np. „7, 7, 4 → 15, 3”). Skrypt <b>nigdy nie usuwa, nie sprzedaje i nie wyrzuca</b> przedmiotów.</li>
          </ul>`) +
        sec('h-sort', 'Sortowanie torby',
          `<ul>
            <li>Przycisk <b>Sortuj</b> (zakładka Torba; strzałka ▾ obok wybiera: po jakości, nazwie lub typie) układa przedmioty <b>tylko w otwartej torbie</b>, od lewego górnego rogu, bez luk. Jakość: od artefaktów i legend do pospolitych.</li>
            <li>Skrypt przenosi przedmioty po jednym, wyłącznie na wolne miejsca, i po każdym kroku sprawdza, czy przedmiot trafił na miejsce. Przy pierwszym niepowodzeniu przerywa. Potrzebne jest co najmniej <b>1 wolne miejsce</b> w torbie.</li>
            <li>W trakcie przycisk zmienia się na <b>Zatrzymaj</b>. Nic nie jest łączone, usuwane ani wyrzucane.</li>
          </ul>`) +
        sec('h-depo', 'Depozyt',
          `<ul>
            <li><b>Połącz identyczne</b> (zakładka Depozyt) łączy takie same stosy <b>na otwartej stronie</b> depozytu – tylko te przedmioty, które widać na ekranie.</li>
            <li>W depozycie gra nie łączy stosów, więc skrypt dla każdego przedmiotu po kolei: bierze jego niepełne stosy do torby, łączy je do limitu i odkłada na ich dawne miejsca w depozycie. Pełne stosy zostają nietknięte.</li>
            <li>Potrzeba tylu wolnych miejsc w torbach, ile stosów ma najliczniejszy przedmiot – jeśli brakuje, skrypt mówi ile i nic nie robi. Branie i odkładanie w depozycie jest darmowe.</li>
            <li>Każdy krok jest sprawdzany. Przy błędzie skrypt przerywa i odkłada stosy z powrotem do depozytu; jeśli coś zostanie w torbie, wypisze co. W trakcie przycisk zmienia się na <b>Zatrzymaj</b> (zatrzymuje po bieżącym przedmiocie). Karta nad wynikiem pokazuje, ile przedmiotów jest do połączenia i ile wolnych miejsc w torbach potrzeba.</li>
            <li><b>Sortowanie depozytu</b> – przycisk <b>Sortuj po jakości</b> układa otwartą stronę depozytu od najrzadszych (artefakt, legendarny, ulepszony, heroiczny, unikatowy, pospolity), a w obrębie jakości po nazwie. Przedmioty są przenoszone w obrębie depozytu, po jednym, każdy krok sprawdzany; potrzebne 1 wolne miejsce na stronie.</li>
            <li>Sekcja <b>Badanie depozytu</b> (Zbadaj, Nagrywaj, Kopiuj) tylko czyta i zapisuje – przydaje się, gdy coś nie działa.</li>
          </ul>`) +
        sec('h-search', 'Szukanie przedmiotów',
          `<ul>
            <li><b>Szukaj</b> (zakładka Torba, lub Alt+F, potem Enter) przeszukuje <b>wszystkie torby</b> i pokazuje listę: nazwa, rzadkość i gdzie leży, np. „T1 ×4 · T2 ×2”.</li>
            <li>Polskie znaki nie są potrzebne („zwoj” znajdzie „Zwój”). Kilka słów oznacza, że wszystkie muszą pasować.</li>
            <li>Pod polem są <b>ostatnie hasła</b> (klik = szukaj ponownie) oraz <b>przyciski rzadkości</b> – pojawiają się dla rzadkości, które masz w plecaku. Można szukać samą rzadkością, bez nazwy.</li>
            <li>Przełącznik <b>Pokaż liczbę sztuk</b> dopisuje do wyników łączną ilość w każdej torbie. Ostatni wynik szukania jest zapamiętywany i wraca po odświeżeniu gry.</li>
            <li><b>Duplikaty</b> wypisuje przedmioty, które w otwartej torbie leżą w kilku stosach. <b>×</b> w polu szukania kasuje pole, filtry i wynik.</li>
          </ul>`) +
        sec('h-watch', 'Obserwowane przedmioty',
          `<ul>
            <li>Dodajesz przedmiot na 3 sposoby: wpisując nazwę (Szukaj → klik w wynik), przyciskiem <b>Wskaż w grze</b> (klikasz przedmiot w torbie – nie zostanie użyty) albo <b>przeciągając</b> go z torby na ramkę w małym okienku „Obserwowane”. Dodać można tylko przedmioty z torby (nie założone).</li>
            <li>Przedmiot upuszczony na <b>dowolne okno dodatku</b> wraca na swoje miejsce w torbie (gra dostaje „puszczenie” w miejscu, skąd go wzięto) – nie powinno się już pojawiać pytanie o wyrzucenie lub zniszczenie. Gdyby jednak się pojawiło, <b>anuluj</b> je i wklej wynik Diagnostyki.</li>
            <li><b>×</b> przy przedmiocie w małym okienku (albo w zakładce Obserwowane) przestaje go obserwować – przedmiot w torbie zostaje nietknięty.</li>
            <li>Małe okienko pokazuje grafikę przedmiotu, jego nazwę, <b>łączną ilość ze wszystkich toreb</b> (suma sztuk) i pasek zapasu względem progu: zielony, żółty, czerwony.</li>
            <li>Dla każdego przedmiotu ustawiasz <b>próg</b> (domyślnie 50). Gdy ilość spadnie poniżej progu, na środku ekranu pojawia się <b style="color:#ffd400">żółty napis</b>. Gdy spadnie do wybranego procentu progu (domyślnie 50%), napis jest <b style="color:#ff3b30">czerwony</b>.</li>
            <li>Możesz ustawić przypomnienie co N sekund (0 = tylko raz). Przycisk <b>Pokaż test napisów</b> pokazuje oba napisy bez czekania.</li>
            <li>Przedmioty rozpoznawane są po nazwie. Małe okienko włączasz przełącznikiem w zakładce Obserwowane, zamykasz ×. Progi i opcje są w zakładce Obserwowane.</li>
          </ul>`) +
        sec('h-loot', 'Zdobycze (dziennik dropów)',
          `<ul>
            <li>Zapisuje <b>heroiki, legendy i smocze runy</b>, które wypadły z potworów (e2, kolosy, tytani, herosi itp.) lub ze skrzynek. Przedmioty z handlu, aukcji, depozytu, sklepu i poczty są pomijane.</li>
            <li>Licznik <b>„Dziś”</b> liczy od 00:00. Poniżej jest podsumowanie ostatnich 7 dni i lista ostatnich dropów z nazwą postaci.</li>
            <li>Źródło przedmiotu ustalane jest z otwartego okna łupu, otwarcia skrzynki i obserwowanych komend gry. <b>Tryb ścisły</b> (domyślny) liczy tylko potwierdzone dropy; <b>tryb luźny</b> liczy też te o nieustalonym źródle.</li>
            <li>Dane są wspólne dla postaci na jednym świecie (na innych światach dziennik jest osobny). Opcjonalnie pokazuje napis na środku ekranu po dropie.</li>
          </ul>`) +
        sec('h-others', 'Ukrywanie graczy',
          `<ul>
            <li>Ikona <b>ludzi</b> na pasku po lewej (nad Ustawieniami) włącza i wyłącza ukrywanie innych graczy na mapie – podświetlona = ukryci. Ustawienie jest zapamiętywane.</li>
            <li>Działa jak skrypt „usuwacz innych”: dane o innych graczach przysłane przez serwer są pomijane – tylko u Ciebie, nic nie jest wysyłane do gry.</li>
            <li>Gracze już widoczni znikną (albo po wyłączeniu – pojawią się) po <b>zmianie mapy lub odświeżeniu</b> gry.</li>
          </ul>`) +
        sec('h-keys', 'Skróty klawiszowe',
          `<ul>
            <li>Domyślnie: <b>Alt+T</b> – otwórz/zamknij okno, <b>Alt+Q</b> – połącz identyczne, <b>Alt+F</b> – szukaj.</li>
            <li>W Ustawieniach kliknij skrót i naciśnij 1, 2 lub 3 klawisze naraz – zapisze się po puszczeniu. Esc anuluje, ✕ usuwa. Skrót zajęty przez inną akcję zostaje jej odebrany.</li>
            <li>Skróty bez Alt/Ctrl nie działają, gdy piszesz w polu tekstowym. Skrótów przeglądarki (np. Ctrl+W) nie da się przejąć.</li>
          </ul>`) +
        sec('h-look', 'Wygląd i ustawienia',
          `<ul>
            <li><b>Skala interfejsu</b> 40–130% (domyślnie 80%), <b>rozmiar czcionki</b>, <b>przezroczystość</b>, 7 kolorów akcentu, 4 motywy tła i tryb kompaktowy – w zakładce Ustawienia.</li>
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
            <li>Przycisk <b>Diagnostyka</b> (zakładka Torba, karta Narzędzia) wypisuje informacje techniczne: wersję, układ toreb, wykrytą otwartą torbę, rzadkości, dostępność grafiki, sygnały dziennika zdobyczy oraz co gra zrobiła po ostatnim upuszczeniu przedmiotu na okno dodatku (komendy i nowe okienka przez 3 s).</li>
            <li>Jeśli coś nie działa, wklej ten wynik – na jego podstawie da się poprawić rozpoznawanie.</li>
          </ul>`) +
        sec('h-soon', 'Jeszcze niedostępne',
          `<ul>
            <li>Sortowanie i łączenie w depozycie działa na razie tylko na <b>otwartej stronie</b>, nie na wszystkich naraz.</li>
            <li>Zasada projektu: skrypt nie usuwa, nie sprzedaje i nie wyrzuca przedmiotów.</li>
          </ul>`) +
        sec('h-unsure', 'Co nie zostało potwierdzone w grze',
          `<ul>
            <li>Wykrywanie otwartej torby, częściowe łączenie stosów (gdy cały stos się nie mieści) i nazwy rzadkości w grze.</li>
            <li>Przeciąganie przedmiotu na ramkę, pobieranie grafiki przedmiotu oraz rozpoznawanie źródła dropów (okno łupu, skrzynki).</li>
            <li>Depozyt: komendy depo&amp;get/put i łączenie w torbie sprawdzone tylko na stronie testowej (komendy z nagrania gry 20.10.2026); zachowanie przy kilku stronach depozytu – nieznane (skrypt działa tylko na przedmiotach widocznych na ekranie).</li>
            <li>Ukrywanie graczy: czy gracze widoczni w chwili włączenia znikają od razu, czy dopiero po zmianie mapy (skrypt zakłada to drugie).</li>
            <li>Sortowanie depozytu: 8 rzędów na stronie (wynika z licznika wolnych miejsc 89 + 23 przedmioty = 112) i numeracja pól na kolejnych stronach – niepotwierdzone; przy nietypowym układzie skrypt odmawia sortowania.</li>
            <li>Sortowanie: czy komenda przeniesienia na wolne miejsce działa w grze tak samo jak przy łączeniu stosów; kolejność „jakości” (artefakt, legendarny, ulepszony, heroiczny, unikatowy, pospolity) i to, że każdy przedmiot zajmuje 1 pole.</li>
            <li>Czy gra po upuszczeniu przedmiotu na okno dodatku na pewno odkłada go na miejsce (bez pytania o wyrzucenie) – sprawdzone tylko na stronie testowej.</li>
            <li>Jeśli któraś z tych rzeczy nie działa, użyj Diagnostyki i opisz, co się dzieje.</li>
          </ul>`) +
        sec('h-log', 'Historia zmian',
          `<ul>
            <li><b>0.21.0</b> – <b>nowy wygląd</b>: jedno okno z paskiem zakładek (Torba, Depozyt, Obserwowane, Zdobycze, Ustawienia, Pomoc), ikony zamiast emoji, karty, czerwony pasek błędu na dole tylko przy błędzie, lista wyników szukania, postęp łączenia w depozycie, nowe małe okienko Obserwowane z paskami zapasu, nowe napisy na ekranie i ikona M po zamknięciu.</li>
            <li><b>0.20.0</b> – <b>👥 Gracze</b> w docku: ukrywanie innych graczy (jak „usuwacz innych”); w depozycie zostało tylko sortowanie po jakości.</li>
            <li><b>0.19.0</b> – <b>sortowanie depozytu</b> (otwarta strona): po nazwie, typie i jakości, jak w torbie.</li>
            <li><b>0.18.0</b> – <b>łączenie identycznych stosów w depozycie</b> na otwartej stronie (przez torbę: weź → połącz → odłóż na miejsce, każdy krok sprawdzany); badanie depozytu przeniesione do zwijanej sekcji.</li>
            <li><b>0.17.0</b> – okno 🧰 Depozyt z narzędziami do zbadania depozytu (Zbadaj, Nagrywaj, Kopiuj wynik) – przygotowanie do łączenia stosów w depozycie.</li>
            <li><b>0.16.1</b> – logo „M” Mindaw zamiast plecaka; szybsze sortowanie i łączenie: skrypt nie czeka już do 4 s na odpowiedź gry, tylko co 50 ms sprawdza, czy przedmiot się przeniósł; przerwa między krokami 200 ms; wynik sortowania pokazuje czas.</li>
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
  ];
  const TAB_IDS = TABS.map(t => t.id);
  const SORT_LBL = { qual: 'jakość', name: 'nazwa', type: 'typ' };
  if (!TAB_IDS.includes(S.tab)) S.tab = 'torba';
  // okna: główne (zakładki) i małe okienko obserwowanych; 'dock' = pozycja ikony po zamknięciu
  const WINS = [{ id: 'main', w: 520 }, { id: 'watch', w: 250, mini: true }];
  const WIN_IDS = WINS.map(w => w.id);
  const railBtn = t => `<button class="ri" data-go="${t.id}" title="${t.title}">${ic(t.icon)}</button>`;

  /* ---------- style ---------- */
  const css = document.createElement('style');
  css.dataset.mbt = '1';
  css.textContent = `
  #mbt-root{--ac:#2fd27a;--a:.94;--sc:1;--fs:13px;--bg:14,19,21;--card:#151c1f;--card2:#1a2226;--inp:#0e1416;--bd:#263136;--bd2:#2f3c42;--rail:#11171a;
    --tx:#e6eef0;--tx2:#9fb0b5;--tx3:#6c7c82;--red:#ff5a52;--yel:#ffc53d;
    font:var(--fs)/1.45 "Segoe UI",Inter,system-ui,-apple-system,Arial,sans-serif;color:var(--tx);user-select:none}
  #mbt-root *{box-sizing:border-box}
  #mbt-root svg.ic{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
  #mbt-root .win{position:fixed;z-index:2147480000;display:none;flex-direction:column;transform:scale(var(--sc));transform-origin:top left;
    background:rgba(var(--bg),var(--a));border:1px solid var(--bd);border-radius:12px;overflow:hidden;backdrop-filter:blur(10px);
    box-shadow:0 18px 50px #0009,0 0 0 1px #ffffff06 inset}
  #mbt-root .win.show{display:flex}
  #mbt-root .top{display:flex;align-items:center;gap:10px;height:44px;flex:none;padding:0 8px 0 4px;border-bottom:1px solid var(--bd);background:linear-gradient(#ffffff08,#ffffff00)}
  #mbt-root .win.min .top{border-bottom:0}
  #mbt-root .win.min .mid,#mbt-root .win.min .err{display:none!important}
  #mbt-root .logo{display:flex;color:var(--ac)}
  #mbt-root .logo svg{width:24px;height:24px}
  #mbt-root .brand{font-weight:600;font-size:1.08em;white-space:nowrap}
  #mbt-root .ver{font-size:.85em;color:var(--tx3);border:1px solid var(--bd);border-radius:999px;padding:0 7px}
  #mbt-root .sp{flex:1}
  #mbt-root .grip{display:inline-grid;grid-template-columns:repeat(3,3px);gap:3px;padding:8px;cursor:move;touch-action:none;border-radius:6px;flex:none}
  #mbt-root .grip i{width:3px;height:3px;border-radius:50%;background:var(--tx3)}
  #mbt-root .grip:hover i{background:var(--ac)}
  #mbt-root .ibtn{width:28px;height:28px;display:grid;place-items:center;border-radius:7px;border:0;background:none;color:var(--tx2);cursor:pointer;padding:0;flex:none}
  #mbt-root .ibtn:hover{background:#ffffff0d;color:var(--tx)}
  #mbt-root .mid{display:grid;grid-template-columns:56px minmax(0,1fr);min-height:0;flex:1}
  #mbt-root .rail{border-right:1px solid var(--bd);padding:8px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--rail)}
  #mbt-root .ri{position:relative;width:40px;height:40px;display:grid;place-items:center;border-radius:9px;color:var(--tx3);cursor:pointer;border:0;background:none;padding:0}
  #mbt-root .ri svg.ic{width:19px;height:19px}
  #mbt-root .ri:hover{color:var(--tx);background:#ffffff0a}
  #mbt-root .ri.on{color:var(--ac);background:color-mix(in srgb,var(--ac) 13%,transparent)}
  #mbt-root .ri[data-go].on::before{content:"";position:absolute;left:-8px;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--ac)}
  #mbt-root .ri.alert::after{content:"";position:absolute;top:7px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px var(--rail)}
  #mbt-root .rsep{height:1px;width:28px;background:var(--bd);margin:4px 0}
  #mbt-root .body{padding:14px 16px;overflow:auto;min-height:0}
  #mbt-root .tab{display:none;flex-direction:column;gap:12px}
  #mbt-root .tab.on{display:flex}
  #mbt-root .h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  #mbt-root .h b{font-size:1.15em;font-weight:600}
  #mbt-root .h span{color:var(--tx3);font-size:.92em}
  #mbt-root .card,#mbt-root .sec{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px}
  #mbt-root .card:empty{display:none}
  #mbt-root .sec h4,#mbt-root .ctitle{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:.85em;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--tx3)}
  #mbt-root .sec h4{cursor:pointer}
  #mbt-root .sec h4 span{flex:1}
  #mbt-root .sec h4:hover{color:var(--tx2)}
  #mbt-root .chev{font-style:normal;transition:transform .15s}
  #mbt-root .sec.fold h4{margin:0}
  #mbt-root .sec.fold .chev{transform:rotate(-90deg)}
  #mbt-root .sec.fold .sc{display:none}
  #mbt-root .sc{display:flex;flex-direction:column;gap:8px}
  #mbt-root .row{display:flex;gap:8px;align-items:center}
  #mbt-root .row>.tg{flex:1}
  #mbt-root .grow{flex:1}
  #mbt-root .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--bd2);
    background:var(--card2);color:var(--tx);font:inherit;font-weight:500;cursor:pointer;white-space:nowrap;transition:border-color .15s}
  #mbt-root .btn:hover{border-color:var(--ac)}
  #mbt-root .btn.on{border-color:var(--ac);color:var(--ac)}
  #mbt-root .btn.pri{background:linear-gradient(var(--ac),color-mix(in srgb,var(--ac) 72%,#000));border-color:transparent;color:#06140c;font-weight:600}
  #mbt-root .btn.pri:hover{filter:brightness(1.08)}
  #mbt-root .btn.stop,#mbt-root .btn.pri.stop{background:var(--card2);border-color:var(--yel);color:var(--yel)}
  #mbt-root .btn.sm{height:28px;padding:0 10px}
  #mbt-root kbd{font-family:inherit;font-size:.82em;line-height:1;color:var(--tx2);border:1px solid var(--bd2);border-bottom-width:2px;border-radius:5px;padding:2px 5px;background:var(--inp)}
  #mbt-root kbd:empty{display:none}
  #mbt-root .btn.pri kbd{background:#0003;border-color:#0003;color:inherit}
  #mbt-root .split{position:relative;display:flex}
  #mbt-root .split>.btn:first-child{border-radius:8px 0 0 8px}
  #mbt-root .split>.caret{border-radius:0 8px 8px 0;border-left:0;padding:0 8px}
  #mbt-root .menu{display:none;position:absolute;right:0;top:38px;z-index:5;min-width:150px;background:var(--card2);border:1px solid var(--bd2);border-radius:9px;padding:4px;box-shadow:0 10px 30px #0008}
  #mbt-root .menu.show{display:block}
  #mbt-root .menu button{display:flex;width:100%;padding:7px 10px;border:0;border-radius:6px;background:none;color:var(--tx);font:inherit;cursor:pointer;text-align:left}
  #mbt-root .menu button:hover{background:#ffffff0d}
  #mbt-root .menu button.on{color:var(--ac)}
  #mbt-root .inp{display:flex;align-items:center;gap:8px;height:34px;padding:0 3px 0 10px;border:1px solid var(--bd2);border-radius:8px;background:var(--inp);color:var(--tx3)}
  #mbt-root .inp:focus-within{border-color:var(--ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 18%,transparent)}
  #mbt-root .inp input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;color:var(--tx);font:inherit;user-select:text}
  #mbt-root input.num{width:68px;height:30px;padding:0 8px;border:1px solid var(--bd2);border-radius:7px;background:var(--inp);color:var(--tx);font:inherit;outline:0}
  #mbt-root input.num:focus{border-color:var(--ac)}
  #mbt-root textarea.s{width:100%;padding:8px 10px;background:var(--inp);color:var(--tx);border:1px solid var(--bd2);border-radius:8px;outline:none;font:inherit;font-size:.9em;resize:vertical;user-select:text}
  #mbt-root .chips{display:flex;flex-wrap:wrap;gap:6px}
  #mbt-root .chips:empty{display:none}
  #mbt-root .chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:99px;border:1px solid var(--bd2);color:var(--tx2);font:inherit;font-size:.9em;background:var(--inp);cursor:pointer}
  #mbt-root .chip:hover{border-color:var(--ac)}
  #mbt-root .chip.on{border-color:var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,transparent)}
  #mbt-root .chip.bad{border-color:var(--red);color:var(--red)}
  #mbt-root .chip.x{opacity:.7}
  #mbt-root .chip .d{width:7px;height:7px;border-radius:50%}
  #mbt-root .tg{display:flex;align-items:center;gap:10px;width:100%;padding:4px 0;background:none;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
  #mbt-root .tg span{flex:1}
  #mbt-root .tg i{order:2;flex:none;position:relative;width:34px;height:20px;border-radius:99px;background:var(--inp);border:1px solid var(--bd2);transition:.15s}
  #mbt-root .tg i::after{content:'';position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:var(--tx3);transition:.15s}
  #mbt-root .tg.on i{background:color-mix(in srgb,var(--ac) 35%,var(--inp));border-color:var(--ac)}
  #mbt-root .tg.on i::after{left:17px;background:var(--ac)}
  #mbt-root .sr{display:flex;align-items:center;gap:12px;padding:6px 0;border-top:1px solid #ffffff08}
  #mbt-root .sr:first-child{border-top:0}
  #mbt-root .sr .lb{flex:1}
  #mbt-root input[type=range]{width:150px;accent-color:var(--ac)}
  #mbt-root .val{width:46px;text-align:right;color:var(--tx2);font-variant-numeric:tabular-nums}
  #mbt-root .sw{display:flex;gap:6px}
  #mbt-root .sw i{width:18px;height:18px;border-radius:5px;cursor:pointer}
  #mbt-root .sw i.on{box-shadow:0 0 0 2px var(--inp),0 0 0 4px #fff}
  #mbt-root .seg{display:flex;background:var(--inp);border:1px solid var(--bd);border-radius:8px;padding:2px;gap:2px}
  #mbt-root .seg button{padding:4px 10px;border-radius:6px;border:0;background:none;color:var(--tx2);font:inherit;font-weight:500;cursor:pointer}
  #mbt-root .seg button.on{background:var(--card2);color:var(--tx);box-shadow:0 0 0 1px var(--bd2)}
  #mbt-root .ctx{display:flex;align-items:center;gap:12px}
  #mbt-root .big{font-size:1.55em;font-weight:600;line-height:1.1}
  #mbt-root .big small{font-size:.6em;color:var(--tx3);font-weight:400}
  #mbt-root .muted{color:var(--tx3);font-size:.9em}
  #mbt-root .tx2{color:var(--tx2)}
  #mbt-root .meter{flex:1;height:6px;border-radius:99px;background:var(--inp);overflow:hidden;border:1px solid var(--bd)}
  #mbt-root .meter i{display:block;height:100%;background:var(--ac);border-radius:99px;transition:width .3s}
  #mbt-root .note{display:flex;gap:8px;align-items:flex-start;font-size:.92em;color:var(--tx3)}
  #mbt-root .note:empty{display:none}
  #mbt-root .note svg.ic{margin-top:2px;color:var(--tx2)}
  #mbt-root .note b{color:var(--tx2)}
  #mbt-root .out{display:none;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;color:var(--tx2);font-size:.92em;white-space:pre-wrap;max-height:280px;overflow:auto;user-select:text}
  #mbt-root .out.rich{white-space:normal}
  #mbt-root .logbox{background:var(--inp);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;color:var(--tx2);font-size:.9em;white-space:pre-wrap;max-height:240px;overflow:auto;user-select:text}
  #mbt-root .logbox:empty::before{content:'Brak zapisanych dropów.';color:var(--tx3)}
  #mbt-root .fh{color:var(--tx3);font-size:.92em;margin-bottom:2px}
  #mbt-root .li{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid #ffffff08}
  #mbt-root .li:first-of-type{border-top:0}
  #mbt-root .nm{flex:1;min-width:0}
  #mbt-root .nm b{font-weight:500;color:var(--tx);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mbt-root .pill{display:inline-block;font-size:.82em;padding:0 7px;border-radius:99px;border:1px solid currentColor;margin-top:2px}
  #mbt-root .loc{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
  #mbt-root .loc span{font-size:.88em;color:var(--tx2);background:var(--inp);border:1px solid var(--bd);border-radius:5px;padding:1px 6px;white-space:nowrap}
  #mbt-root .steps{display:flex;flex-direction:column;gap:6px;margin-top:10px}
  #mbt-root .st{display:flex;align-items:center;gap:8px;color:var(--tx2)}
  #mbt-root .st.ok svg{color:var(--ac)}
  #mbt-root .st.run{color:var(--tx)}
  #mbt-root .st.run svg{color:var(--yel)}
  #mbt-root .st.wait{color:var(--tx3)}
  #mbt-root .st.bad{color:var(--red)}
  #mbt-root .cnt{text-transform:none;letter-spacing:0;font-weight:500;color:var(--tx2)}
  #mbt-root ol.howto{margin:0;padding-left:18px;color:var(--tx2);font-size:.92em}
  #mbt-root ol.howto li{margin:4px 0}
  #mbt-root ol.howto b{color:var(--ac)}
  #mbt-root .err{display:none;align-items:flex-start;gap:10px;padding:10px 6px 10px 12px;border-top:1px solid #ff5a5233;background:linear-gradient(#2a1414,#221111);color:#ffd9d6;font-size:.95em;flex:none}
  #mbt-root .win.haserr .err{display:flex}
  #mbt-root .err>svg.ic{color:var(--red);width:17px;height:17px;margin-top:2px}
  #mbt-root .err>span{flex:1;min-width:0;user-select:text}
  #mbt-root .err b{display:block;color:#fff;font-weight:600}
  #mbt-root .err small{display:block;color:#e9a8a3;font-size:.92em;margin-top:2px}
  #mbt-root .err small:empty{display:none}
  #mbt-root .err .ibtn{color:#ffb3ad}
  #mbt-root .wl{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #ffffff08}
  #mbt-root .wl:first-child{border-top:0}
  #mbt-root .wl .wn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mbt-root .wl .muted{flex:none}
  #mbt-root .win.mini .top{height:36px;gap:8px;font-size:.95em}
  #mbt-root .win.mini .top>svg.ic{color:var(--ac)}
  #mbt-root .win.mini .body{padding:0}
  #mbt-root .wr{display:grid;grid-template-columns:30px minmax(0,1fr) auto auto;grid-template-rows:auto 4px;column-gap:8px;row-gap:5px;padding:8px 6px 8px 10px;border-top:1px solid #ffffff08;align-items:center}
  #mbt-root .wr:first-child{border-top:0}
  #mbt-root .wr canvas{grid-row:1/3;width:30px;height:30px;image-rendering:pixelated;background:var(--inp);border:1px solid var(--bd);border-radius:7px}
  #mbt-root .wr .wn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
  #mbt-root .wr .c{font-variant-numeric:tabular-nums;font-weight:600}
  #mbt-root .wr .c small{color:var(--tx3);font-weight:400}
  #mbt-root .wr .wx{width:22px;height:22px;opacity:.5}
  #mbt-root .wr .wx:hover{opacity:1;color:var(--red)}
  #mbt-root .wr .bar{grid-column:2/5;height:4px;border-radius:99px;background:var(--inp);overflow:hidden;margin-right:4px}
  #mbt-root .wr .bar i{display:block;height:100%;border-radius:99px;background:var(--ac)}
  #mbt-root .wr.l1 .c{color:var(--yel)}
  #mbt-root .wr.l1 .bar i{background:var(--yel)}
  #mbt-root .wr.l2 .c{color:var(--red)}
  #mbt-root .wr.l2 .bar i{background:var(--red)}
  #mbt-root .wslot span{white-space:nowrap}
  #mbt-root .wslot{margin:6px 10px 10px;min-height:38px;border:1.5px dashed var(--bd2);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--tx3);font-size:.92em;padding:4px;transition:.12s}
  #mbt-root .wslot.hot{border-color:var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,transparent)}
  #mbt-root .lnk{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:var(--tx2);font:inherit;cursor:pointer;padding:2px 4px;border-radius:5px}
  #mbt-root .lnk:hover,#mbt-root .lnk.on{color:var(--ac)}
  html.mbt-pick .item[class*="item-id-"]{cursor:crosshair!important}
  #mbt-root .help{display:flex;flex-direction:column;gap:8px}
  #mbt-root .help ul{margin:0;padding-left:18px}
  #mbt-root .help li{margin:4px 0;color:var(--tx2);line-height:1.5;user-select:text}
  #mbt-root .help b{color:var(--ac);font-weight:600}
  #mbt-root .launcher{position:fixed;z-index:2147483100;display:none;align-items:center;gap:4px;height:40px;padding:0 12px 0 2px;transform:scale(var(--sc));transform-origin:top left;
    background:rgba(var(--bg),.95);border:1px solid var(--bd);border-radius:10px;box-shadow:0 10px 26px #0008}
  #mbt-root .launcher.show{display:flex}
  #mbt-root .lbtn{display:flex;align-items:center;gap:7px;border:0;background:none;color:var(--tx);font:inherit;font-weight:600;cursor:pointer;padding:0}
  #mbt-root .lbtn svg{width:22px;height:22px;color:var(--ac)}
  #mbt-root .lbtn:hover svg{filter:drop-shadow(0 0 4px var(--ac))}
  #mbt-root .kb{display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid #ffffff08}
  #mbt-root .kb:first-child{border-top:0}
  #mbt-root .kb span{flex:1}
  #mbt-root .kbbtn{min-width:130px}
  #mbt-root .kbbtn.rec{border-color:var(--ac);color:var(--ac)}
  #mbt-root.compact .body{padding:10px 12px}
  #mbt-root.compact .tab{gap:8px}
  #mbt-root.compact .card,#mbt-root.compact .sec{padding:9px}
  #mbt-root.compact .btn{height:30px}
  #mbt-root.compact .sc{gap:6px}
  #mbt-root #mbt-toasts{position:fixed;left:50%;top:28%;transform:translateX(-50%);z-index:2147483200;pointer-events:none;
    display:flex;flex-direction:column;align-items:center;gap:8px;width:max-content;max-width:90vw}
  #mbt-root .toast{display:flex;align-items:center;gap:10px;padding:11px 16px 11px 12px;background:rgba(18,24,27,.96);border:1px solid #263136;border-left:3px solid var(--tc);
    border-radius:10px;box-shadow:0 12px 30px #0008;font:600 15px/1.35 "Segoe UI",Inter,system-ui,Arial,sans-serif;color:#fff;animation:mbtfade 4s forwards}
  #mbt-root .toast svg.ic{color:var(--tc);width:19px;height:19px}
  @keyframes mbtfade{0%{opacity:0;transform:translateY(-6px)}8%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0}}
  `;
  document.documentElement.appendChild(css);

  /* ---------- HTML ---------- */
  const root = document.createElement('div');
  root.id = 'mbt-root';
  root.dataset.v = VER;
  root.innerHTML = `
  <div id="mbt-toasts"></div>
  <div class="launcher" id="mbt-launcher" title="Mindaw Addons v${VER}">${gripHTML('dock')}<button class="lbtn" data-act="openDock" title="Otwórz">${LOGO}<span>Mindaw</span></button></div>

  <section class="win app" id="mbt-w-main" style="width:520px">
    <header class="top">${gripHTML('main')}<span class="logo">${LOGO}</span><span class="brand">Mindaw Addons</span><span class="ver">v${VER}</span><span class="sp"></span>
      <button class="ibtn" data-min="main" title="Zwiń / rozwiń">${ic('min')}</button><button class="ibtn" data-act="closeAll" title="Zamknij (zostaje ikona M)">${ic('x')}</button></header>
    <div class="mid">
      <nav class="rail">
        ${TABS.filter(t => !['set', 'help'].includes(t.id)).map(railBtn).join('')}
        <button class="ri" data-act="others">${ic('users')}</button>
        <span class="rsep"></span>
        ${TABS.filter(t => ['set', 'help'].includes(t.id)).map(railBtn).join('')}
      </nav>
      <div class="body">${TABS.map(t => `<div class="tab" data-tab="${t.id}">${t.html}</div>`).join('')}</div>
    </div>
    <div class="err">${ic('warn')}<span><b id="mbt-errt"></b><small id="mbt-errd"></small></span><button class="ibtn" data-act="errclose" title="Zamknij">${ic('x')}</button></div>
  </section>

  <section class="win mini" id="mbt-w-watch" style="width:250px">
    <header class="top">${gripHTML('watch')}${ic('eye')}<span class="brand">Obserwowane</span><span class="sp"></span><button class="ibtn" data-close="watch" title="Zamknij">${ic('x')}</button></header>
    <div class="body"><div id="mbt-watchrows"></div>
      <div class="wslot" data-wslot title="Przeciągnij przedmiot z torby w tę ramkę">${ic('plus')}<span>przeciągnij tutaj ·</span>${wtBtn('lnk', 'wskaż')}</div></div>
  </section>`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const el = { icon: $('#mbt-launcher'), main: $('#mbt-w-main'), watch: $('#mbt-w-watch') };
  const out = $('#mbt-out');
  let dockOpen = !!S.dock;
  let busy = false;
  let Z = 2147480000;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- wygląd i pozycje ---------- */
  $('#mbt-sw').innerHTML = COLORS.map((c, i) => `<i data-c="${i}" style="background:${c}"></i>`).join('');

  const winW = id => (id === 'dock' ? 130 : WINS.find(w => w.id === id).w) * S.scale / 100;
  function place() {
    // całe okno w poziomie zawsze na ekranie (inaczej przyciski wypadały za prawą krawędź)
    for (const id of WIN_IDS) {
      const p = S.pos[id] || def.pos[id];
      el[id].style.left = clamp(p[0], 0, Math.max(0, innerWidth - winW(id))) + 'px';
      el[id].style.top = clamp(p[1], 0, Math.max(0, innerHeight - 50)) + 'px';
    }
    const d = S.pos.dock || def.pos.dock;
    el.icon.style.left = clamp(d[0], 0, Math.max(0, innerWidth - winW('dock'))) + 'px';
    el.icon.style.top = clamp(d[1], 0, Math.max(0, innerHeight - 50)) + 'px';
    // wysokość treści liczona od miejsca okna i skali – dół okna zawsze mieści się na ekranie (da się przewinąć)
    const sc = S.scale / 100;
    for (const id of WIN_IDS) {
      const w = el[id], top = w.querySelector('.top').offsetHeight || 44, err = w.querySelector('.err');
      const used = top + (err && w.classList.contains('haserr') ? err.offsetHeight : 0);
      w.querySelector('.body').style.maxHeight = Math.max(100, (innerHeight - parseFloat(w.style.top) - 12) / sc - used) + 'px';
    }
  }
  function paintToggles() { $$('[data-tg]').forEach(b => b.classList.toggle('on', !!S[b.dataset.tg])); }
  function applyFold() { $$('.sec').forEach(s => s.classList.toggle('fold', !!S.fold[s.dataset.sec])); }
  function apply() {
    const th = THEMES[S.theme] || THEMES.ciemny;
    root.style.setProperty('--ac', COLORS[S.accent] || COLORS[0]);
    root.style.setProperty('--a', S.alpha / 100);
    root.style.setProperty('--sc', S.scale / 100);
    root.style.setProperty('--fs', S.font + 'px');
    for (const k of ['bg', 'card', 'card2', 'inp', 'bd', 'bd2', 'rail']) root.style.setProperty('--' + k, th[k]);
    root.classList.toggle('compact', S.compact);
    $('#mbt-alpha').value = S.alpha; $('#mbt-alpha-l').textContent = S.alpha + '%';
    $('#mbt-scale').value = S.scale; $('#mbt-scale-l').textContent = S.scale + '%';
    $('#mbt-font').value = S.font; $('#mbt-font-l').textContent = S.font + ' px';
    $$('#mbt-sw i').forEach((i, n) => i.classList.toggle('on', n === S.accent));
    $$('[data-theme]').forEach(b => b.classList.toggle('on', b.dataset.theme === S.theme));
    paintToggles();
    $('#mbt-wcrit').value = S.watchCrit; $('#mbt-wremind').value = S.watchRemind;
    applyFold(); place();
  }
  function view() {
    S.open.watch = !!S.watchShow;
    el.main.classList.toggle('show', dockOpen);
    el.main.classList.toggle('min', !!S.min.main);
    el.watch.classList.toggle('show', !!S.watchShow);
    el.icon.classList.toggle('show', !dockOpen);
    S.dock = dockOpen;
    $$('[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === S.tab));
    $$('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === S.tab));
    const ob = $('[data-act=others]');
    ob.classList.toggle('on', !!S.hideOthers);
    ob.title = S.hideOthers ? 'Gracze ukryci – kliknij, żeby pokazać' : 'Ukryj innych graczy (tylko u Ciebie)';
    $('#mbt-sortlbl').textContent = 'Sortuj: ' + SORT_LBL[S.sortMode];
    $$('[data-sortmode]').forEach(b => b.classList.toggle('on', b.dataset.sortmode === S.sortMode));
    paintToggles();
    place();
    if (dockOpen && S.tab === 'torba') { const sn = snap(); updateNote(sn); renderRar(sn); }
    if (dockOpen && S.tab === 'depo') depoInfo();
    save();
  }
  function arrange() { S.pos = JSON.parse(JSON.stringify(def.pos)); place(); save(); }

  // pasek błędu na dole głównego okna – tylko gdy coś się nie udało; znika przy następnej udanej akcji lub po ×
  const ERR_RE = /przerywam|nie wykryto|nie widzę|potrzeba \d+ wolnych|nietypowy|jest pełna|nie przeniosła|nie połączyła|nie odłożyła|zostało z depozytu|trwa inna akcja|nie zadziałało|nie rozpoznano/i;
  function errBar(title, detail = '') {
    $('#mbt-errt').textContent = title; $('#mbt-errd').textContent = detail;
    el.main.classList.add('haserr'); place();
  }
  function errHide() { if (el.main.classList.contains('haserr')) { el.main.classList.remove('haserr'); place(); } }
  function errFrom(t) {
    const lines = String(t).split('\n').map(s => s.trim()).filter(Boolean), i = lines.findIndex(l => ERR_RE.test(l));
    if (i < 0) return errHide();
    errBar(lines[i], lines.slice(i + 1).join(' ').slice(0, 300));
  }
  // przyciski w trakcie pracy zmieniają się na „Zatrzymaj”
  function busyUI() {
    const sb = $('#mbt-sortbtn'), dm = $('#mbt-depomerge'), ds = $('[data-dsort]');
    sb.classList.toggle('stop', sorting && S.tab === 'torba');
    $('#mbt-sortlbl').textContent = sorting ? 'Zatrzymaj' : 'Sortuj: ' + SORT_LBL[S.sortMode];
    dm.classList.toggle('stop', depoBusy); dm.querySelector('span').textContent = depoBusy ? 'Zatrzymaj' : 'Połącz identyczne';
    ds.classList.toggle('stop', sorting); ds.querySelector('span').textContent = sorting ? 'Zatrzymaj' : 'Sortuj po jakości';
  }

  /* ---------- zdarzenia UI ---------- */
  root.addEventListener('click', e => {
    const t = e.target;
    if (rec && !t.closest('[data-kb]')) stopRec();
    if (!t.closest('.split')) $('#mbt-sortmenu').classList.remove('show');
    const go = t.closest('[data-go]');
    if (go) { S.tab = go.dataset.go; S.min.main = false; view(); }
    const tg = t.closest('[data-tg]');
    if (tg) {
      const o = tg.dataset.tg;
      S[o] = !S[o];
      if (o === 'watchShow') { view(); bgTick(); } else { apply(); save(); }
    }
    const cl = t.closest('[data-close]');
    if (cl && cl.dataset.close === 'watch') { S.watchShow = false; view(); }
    const mn = t.closest('[data-min]');
    if (mn) { S.min[mn.dataset.min] = !S.min[mn.dataset.min]; view(); }
    const act = (t.closest('[data-act]') || {}).dataset || {};   // closest: klik trafia też w rysunek ikony
    if (act.act === 'closeAll') { dockOpen = false; view(); }
    if (act.act === 'openDock') { dockOpen = true; view(); }
    if (act.act === 'errclose') errHide();
    if (act.act === 'others') {
      S.hideOthers = window.__mbtHideOthers = !S.hideOthers;
      const ok = hookOthers();
      view();
      toast(!ok ? 'Nie udało się podpiąć – odśwież grę' : S.hideOthers
        ? 'Gracze ukryci – znikną po zmianie mapy lub odświeżeniu'
        : 'Gracze widoczni – pojawią się po zmianie mapy lub odświeżeniu', ok ? OK : RED);
    }
    if (t.closest('#mbt-sortcaret')) $('#mbt-sortmenu').classList.toggle('show');
    const sm = t.closest('[data-sortmode]');
    if (sm) { S.sortMode = sm.dataset.sortmode; $('#mbt-sortmenu').classList.remove('show'); view(); }
    if (t.closest('#mbt-sortbtn')) sortBag(S.sortMode);
    if (t.dataset.c) { S.accent = +t.dataset.c; apply(); save(); }
    const th = t.closest('[data-theme]');
    if (th) { S.theme = th.dataset.theme; apply(); save(); }
    const f = t.closest('[data-fold]');
    if (f) { S.fold[f.dataset.fold] = !S.fold[f.dataset.fold]; applyFold(); save(); }
    if (t.closest('[data-layout]')) arrange();
    const rr = t.closest('[data-rar]');
    if (rr) {
      const r = rr.dataset.rar;
      S.rar = S.rar.includes(r) ? S.rar.filter(x => x !== r) : [...S.rar, r];
      rarKey = ''; renderRar(snap()); save();
    }
    const hh = t.closest('[data-hist]');
    if (hh) { $('#mbt-search').value = hh.dataset.hist; find(); }
    if (t.closest('[data-histclear]')) { S.history = []; renderHist(); save(); }
    const kb = t.closest('[data-kb]');
    if (kb) startRec(kb.dataset.kb);
    const kc = t.closest('[data-kbclear]');
    if (kc) { S.keys[kc.dataset.kbclear] = []; save(); renderKeys(); }
    const wa = t.closest('[data-wadd]');
    if (wa) wAdd(wa.dataset.wadd);
    const wd = t.closest('[data-wdel]');
    if (wd) wDel(+wd.dataset.wdel);
    if (t.closest('[data-wtest]')) {
      toast('Mało: Przykładowa mikstura — 42 szt. (próg 50)', YEL);
      toast('Bardzo mało: Przykładowa mikstura — 20 szt. (próg 50)', RED);
    }
    if (t.closest('[data-wtarget]')) setPick(!pick);
    const ds = t.closest('[data-dsort]');
    if (ds) sortDepo(ds.dataset.dsort);
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
  $('#mbt-font').oninput = e => { $('#mbt-font-l').textContent = e.target.value + ' px'; };
  $('#mbt-font').onchange = e => { S.font = +e.target.value; apply(); save(); };
  addEventListener('resize', place);

  // kliknięte okno wychodzi na wierzch
  root.addEventListener('pointerdown', e => {
    const w = e.target.closest('.win');
    if (!w) return;
    if (Z > 2147482900) { Z = 2147480000; $$('.win').forEach(x => { x.style.zIndex = Z; }); }
    w.style.zIndex = ++Z;
  });

  /* przeciąganie: kropki każdego okna (i ikony M) */
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
  const RCOL = { common: '#9fb0b5', unique: '#e6d36a', heroic: '#ffa23a', upgraded: '#7cc4ff', legendary: '#ff6ad5', artefact: '#ff5a52', none: '#6c7c82' };
  const stats = it => (it && it._cachedStats) || {};
  // loc 'g' = ekwipunek i torby, 'd' = depozyt (potwierdzone diagnostyką 10.2026)
  const fetchRaw = (loc = 'g') => {
    const E = window.Engine;
    try {
      if (E && E.items && typeof E.items.fetchLocationItems === 'function') {
        const l = E.items.fetchLocationItems(loc);
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
  const readItems = (loc = 'g') => fetchRaw(loc).map(it => ({
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
  // nagłówek i karta zakładki Torba: wykryta torba, zajęte miejsca, ile przedmiotów jest do połączenia
  let statHTML = '';
  function updateNote(sn = snap()) {
    const { items, L } = sn;
    let note, html;
    if (!L.length) { note = 'nie widzę toreb'; html = '<div class="muted">Uruchom grę z postacią.</div>'; }
    else {
      const d = detectBag(items, L);
      if (!d) { note = 'nie wykryto otwartej torby'; html = '<div class="muted">Otwórz torbę w grze, żeby łączyć i sortować. Szukanie działa we wszystkich torbach.</div>'; }
      else {
        const used = items.filter(i => i.bag === d.k).length, cap = L[d.k].cap, m = buildPlan(items, d.k).summary.length;
        note = `otwarta: Torba ${d.k + 1} · wykryta ${d.how}`;
        html = `<div class="ctx"><div><div class="big">${used}<small> / ${cap}</small></div><div class="muted">zajęte miejsca</div></div>
          <div class="meter"><i style="width:${Math.min(100, Math.round(used / cap * 100))}%"></i></div><div class="tx2">${m ? m + ' do połączenia' : 'nic do łączenia'}</div></div>`;
      }
    }
    $('#mbt-bagnote').textContent = note;
    if (html !== statHTML) $('#mbt-bagstat').innerHTML = statHTML = html;
  }
  setInterval(() => {
    if (!dockOpen || busy) return;
    if (S.tab === 'torba') { const sn = snap(); updateNote(sn); renderRar(sn); }
    if (S.tab === 'depo') depoInfo();
  }, 1000);

  const say = t => { out.style.display = 'block'; out.classList.remove('rich'); out.textContent = t; errFrom(t); };
  const join = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' i ' + a[a.length - 1];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // napis na środku ekranu
  const YEL = '#ffc53d', RED = '#ff5a52', OK = '#2fd27a';
  function toast(text, color) {
    const box = $('#mbt-toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast'; d.style.setProperty('--tc', color);
    d.innerHTML = ic(color === OK ? 'check' : color === YEL || color === RED ? 'warn' : 'info') + `<span>${esc(String(text).replace(/^[⚠‼]\uFE0F?\s*/, ''))}</span>`;
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
      ? present.map(r => `<button class="chip${S.rar.includes(r) ? ' on' : ''}" data-rar="${esc(r)}" title="Filtr rzadkości"><span class="d" style="background:${RCOL[r] || '#9fb0b5'}"></span>${esc(RAR[r] || r)}</button>`).join('')
      : '';
  }
  function renderHist() {
    $('#mbt-hist').innerHTML = S.history.length
      ? S.history.map(h => `<button class="chip" data-hist="${esc(h)}" title="Szukaj ponownie">${esc(h)}</button>`).join('') +
        '<button class="chip x" data-histclear="1" title="Wyczyść historię">× historia</button>'
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
    S.lastFind = {
      head: `Znaleziono ${names.length} poz.` + (S.showCount ? ` · razem ${total} szt.` : ''), more: Math.max(0, names.length - 60),
      rows: names.slice(0, 60).map(name => ({ n: name, r: by[name].rar, b: Object.keys(by[name].bags).map(Number).sort((a, b) => a - b).map(k => [k, by[name].bags[k]]) })),
    };
    renderFind(S.lastFind); save();
  }
  // wyniki szukania jako lista: nazwa, rzadkość, gdzie leży (T1 ×4 …)
  function renderFind(f) {
    if (!f || !Array.isArray(f.rows)) return;
    out.style.display = 'block'; out.classList.add('rich'); errHide();
    out.innerHTML = `<div class="fh">${esc(f.head)}</div>` + f.rows.map(r => {
      const pill = r.r !== 'common' && r.r !== 'none' ? `<span class="pill" style="color:${RCOL[r.r] || '#9fb0b5'}">${esc(RAR[r.r] || r.r)}</span>` : '';
      const loc = r.b.map(([k, c]) => `<span>${k < 0 ? 'poza torbami' : 'T' + (k + 1)}${S.showCount ? ' ×' + c : ''}</span>`).join('');
      return `<div class="li"><span class="nm"><b>${esc(r.n)}</b>${pill}</span><span class="loc">${loc}</span></div>`;
    }).join('') + (f.more ? `<div class="fh">…i ${f.more} więcej</div>` : '');
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
  // komenda do serwera bez czekania na odpowiedź zwrotną (czekanie na nią dawało do 4 s na krok);
  // efekt każdego kroku i tak sprawdzają waitGrow() / waitFor()
  const send = cmd => { try { window._g(cmd); } catch {} };
  const byId = id => readItems().find(i => i.id === id);
  async function waitGrow(dstId, before, ms = 2500) {
    for (let t = 0; t < ms; t += 50) {
      await sleep(50);
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
        send(`moveitem&st=0&id=${s.srcId}&x=${dst0.x}&y=${dst0.y}`);
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
  // b: { idx, from (pierwszy rząd), cap, cols (domyślnie 7 – torba), x0 (pierwsza kolumna, domyślnie 0) }
  function sortPlan(items, b, mode) {
    const cells = [], cols = b.cols || COLS, x0 = b.x0 || 0;
    for (let j = 0; j < b.cap; j++) cells.push([x0 + j % cols, b.from + Math.floor(j / cols)]);
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
  // wykonanie planu sortowania: po jednym przeniesieniu, sprawdzenie miejsca i ilości, przerwanie przy pierwszym błędzie
  // o: { label, moves, mode, cmd(m) → komenda, loc ('g' | 'd'), out(t) }
  async function runSort(o) {
    busy = sorting = true; stopSort = false; busyUI();
    const occ = i => o.loc !== 'g' || i.st === 0, t0 = Date.now();
    let done = 0, msg = '';
    try {
      for (const m of o.moves) {
        if (stopSort) { msg = 'Zatrzymano na Twoje kliknięcie.'; break; }
        const cur = readItems(o.loc), it = cur.find(i => i.id === m.id);
        if (!it) { msg = 'Przedmiot zniknął – przerywam.'; break; }
        if (cur.some(i => occ(i) && i.x === m.x && i.y === m.y)) { msg = 'Docelowe miejsce jest zajęte (coś się zmieniło) – przerywam.'; break; }
        o.out(`${o.label}: sortuję ${SORTS[o.mode].n}… krok ${done + 1} z ${o.moves.length}\n(kliknij dowolny przycisk sortowania, żeby zatrzymać)`);
        send(o.cmd(m));
        const ok = await waitFor(() => { const d = readItems(o.loc).find(i => i.id === m.id); return d && d.x === m.x && d.y === m.y ? d : null; });
        if (!ok || ok.amount !== it.amount) {
          msg = `Gra nie przeniosła „${it.name}” – przerywam.` + (done ? '' : ' Wklej mi wynik Diagnostyki.');
          break;
        }
        done++;
        await sleep(200);
      }
    } finally { busy = sorting = false; busyUI(); }
    o.out(`${o.label}: sortowanie ${SORTS[o.mode].n} – wykonano ${done} z ${o.moves.length} przeniesień (${((Date.now() - t0) / 1000).toFixed(1)} s).` + (msg ? '\n' + msg : ''));
  }
  async function sortBag(mode) {
    if (busy) { if (sorting) { stopSort = true; say('Zatrzymuję sortowanie…'); } else say('Trwa inna akcja…'); return; }
    const s0 = snap(), d0 = detectBag(s0.items, s0.L);
    if (!d0) return say('Nie wykryto otwartej torby. Otwórz torbę w grze i spróbuj ponownie.');
    const k = d0.k, r = sortPlan(s0.items, s0.L[k], mode);
    if (r.err) return say(`Torba ${k + 1}: ${r.err}`);
    if (!r.moves.length) return say(`Torba ${k + 1}: już posortowana ${SORTS[mode].n}.`);
    await runSort({ label: `Torba ${k + 1}`, moves: r.moves, mode, loc: 'g', out: say, cmd: m => `moveitem&st=0&id=${m.id}&x=${m.x}&y=${m.y}` });
    updateNote();
  }
  // strona depozytu: 14 kolumn (potwierdzone), 8 rzędów (112 miejsc – licznik wolnych miejsc w grze + przedmioty = 112)
  const DCOLS = 14, DROWS = 8;
  function depoPage() {
    const vis = visibleIds(), all = readItems('d'), page = all.filter(i => vis.has(i.id));
    if (!page.length) return { err: 'nie widzę przedmiotów na otwartej stronie depozytu.' };
    const x0 = Math.floor(Math.min(...page.map(i => i.x)) / DCOLS) * DCOLS, y0 = Math.floor(Math.min(...page.map(i => i.y)) / DROWS) * DROWS;
    const inside = i => i.x >= x0 && i.x < x0 + DCOLS && i.y >= y0 && i.y < y0 + DROWS;
    // ostrożnie: przedmioty strony muszą mieścić się w jednym prostokącie 14×8, w którym nie leży nic niewidocznego
    if (!page.every(inside) || all.some(i => !vis.has(i.id) && inside(i))) return { err: 'nietypowy układ strony depozytu – nie sortuję. Wklej mi wynik „Zbadaj depozyt”.' };
    return { items: page.map(i => ({ ...i, bag: 0 })), b: { idx: 0, from: y0, x0, cap: DCOLS * DROWS, cols: DCOLS } };
  }
  async function sortDepo(mode) {
    if (busy) { if (sorting) { stopSort = true; dsay('Zatrzymuję sortowanie…'); } else dsay('Trwa inna akcja…'); return; }
    if (!depoOpen()) return dsay('Otwórz depozyt w grze – na stronie, którą chcesz posortować.');
    const pg = depoPage();
    if (pg.err) return dsay('Depozyt: ' + pg.err);
    const r = sortPlan(pg.items, pg.b, mode);
    if (r.err) return dsay('Depozyt: ' + r.err.replace('torb', 'stron'));
    if (!r.moves.length) return dsay(`Depozyt: strona już posortowana ${SORTS[mode].n}.`);
    await runSort({ label: 'Depozyt', moves: r.moves, mode, loc: 'd', out: dsay, cmd: m => `depo&move=${m.id}&x=${m.x}&y=${m.y}` });
  }

  /* ---------- obserwowane przedmioty ---------- */
  const wState = {}, iconImgs = {}, iconTried = {};
  const wLevel = (n, w) => n >= w.warn ? 0 : (n <= Math.floor(w.warn * S.watchCrit / 100) ? 2 : 1);

  function renderWList() {
    $('#mbt-wlist').innerHTML = S.watch.length
      ? S.watch.map((w, i) => `<div class="wl"><span class="wn" title="${esc(w.name)}">${esc(w.name)}</span><span class="muted">alert poniżej</span><input class="num" type="number" min="1" data-wwarn="${i}" value="${w.warn}"><button class="ibtn" data-wdel="${i}" title="Przestań obserwować">${ic('x')}</button></div>`).join('')
      : '<div class="muted">Brak obserwowanych przedmiotów.</div>';
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
    toast('Obserwuję: ' + it.name, OK);
  }
  let pick = false, pickTimer = 0, press = null;
  function setPick(on) {
    pick = on; clearTimeout(pickTimer);
    document.documentElement.classList.toggle('mbt-pick', on);
    $$('[data-wtarget]').forEach(b => { b.querySelector('.wtl').textContent = on ? 'kliknij przedmiot w torbie (Esc)' : b.dataset.lbl; b.classList.toggle('on', on); });
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
    if (!S.watch.length) { $('[data-go=watch]').classList.remove('alert'); if (S.open.watch) $('#mbt-watchrows').innerHTML = rowsHTML = ''; return; }
    const cnt = {}, refs = {}, now = Date.now();
    sn.items.forEach(i => {
      if (i.st !== 0) return;
      cnt[i.name] = (cnt[i.name] || 0) + i.amount;
      if (!refs[i.name]) refs[i.name] = i.ref;
    });
    $('[data-go=watch]').classList.toggle('alert', S.watch.some(w => wLevel(cnt[w.name] || 0, w) > 0));
    if (S.open.watch) {
      const html = S.watch.map((w, i) => {
        const n = cnt[w.name] || 0;
        return `<div class="wr l${wLevel(n, w)}" title="${esc(w.name)}"><canvas width="28" height="28" data-wi="${i}"></canvas><span class="wn">${esc(w.name)}</span><span class="c">${n}<small> / ${w.warn}</small></span><button class="ibtn wx" data-wdel="${i}" title="Przestań obserwować">${ic('x')}</button><span class="bar"><i style="width:${Math.min(100, Math.round(n / w.warn * 100))}%"></i></span></div>`;
      }).join('');
      // przebudowa tylko przy zmianie – inaczej kliknięcia w ✕ ginęły przy odświeżaniu co 2 s
      if (html !== rowsHTML) { $('#mbt-watchrows').innerHTML = rowsHTML = html; }
      paintIcons(refs);
    }
    S.watch.forEach(w => {
      const n = cnt[w.name] || 0, l = wLevel(n, w), st = wState[w.name] || (wState[w.name] = { l: 0, t: 0 });
      if (l > 0 && (l > st.l || (S.watchRemind > 0 && now - st.t >= S.watchRemind * 1000))) {
        toast(l === 2 ? `Bardzo mało: ${w.name} — ${n} szt. (próg ${w.warn})` : `Mało: ${w.name} — ${n} szt. (próg ${w.warn})`, l === 2 ? RED : YEL);
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
    if (S.lootToast) toast(rar === 'rune' ? `Smocze Runy ×${n}` : `${LNAME[rar]}: ${name}`, LCOL[rar] || YEL);
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
        try { if (typeof a[0] === 'string') { noteCmd(a[0]); dropCmd(a[0]); if (drec) recLine('komenda: ' + a[0].slice(0, 200)); } } catch {}
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

  /* ---------- depozyt: badanie (tylko odczyt i nagrywanie – żadnych komend do serwera) ---------- */
  const LOCS = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const fetchLoc = loc => {
    try { const l = window.Engine.items.fetchLocationItems(loc); return Array.isArray(l) ? l : Object.values(l || {}); } catch { return null; }
  };
  const shortIt = it => {
    const keep = String(it.stat || '').split(';').filter(x => /^(amount|capacity|bag|rarity)=/.test(x)).join(';');
    return `#${it.id} „${nameOf(it)}” loc=${it.loc} st=${it.st} x=${it.x} y=${it.y}${keep ? ' ' + keep : ''}`;
  };
  const depoTxt = { study: '', rec: '' };
  const depoShow = () => {
    const o = $('#mbt-depoout'), t = [depoTxt.study, depoTxt.rec].filter(Boolean).join('\n\n');
    o.style.display = t ? 'block' : 'none'; o.textContent = t;
  };
  function depoStudy() {
    const L = [`Badanie depozytu – Bag Tools ${VER}, ${new Date().toLocaleString('pl-PL')}`], counts = {}, locs = [];
    LOCS.forEach(l => { const a = fetchLoc(l); if (a && a.length) { counts[l] = a.length; locs.push(l); } });
    L.push('Przedmioty wg loc: ' + JSON.stringify(counts));
    const vis = visibleIds(), seen = {};
    locs.forEach(l => fetchLoc(l).forEach(it => { if (vis.has(String(it.id))) seen[l] = (seen[l] || 0) + 1; }));
    L.push('Widoczne na ekranie wg loc: ' + JSON.stringify(seen));
    locs.filter(l => l !== 'g').forEach(l => {
      const a = fetchLoc(l), xs = {}, ys = {}, sts = {};
      a.forEach(i => { xs[i.x] = (xs[i.x] || 0) + 1; ys[i.y] = (ys[i.y] || 0) + 1; sts[i.st] = (sts[i.st] || 0) + 1; });
      L.push(`— loc ${l}: ${a.length} przedm. | pola obiektu: ${Object.keys(a[0] || {}).slice(0, 30).join(',')}`);
      a.slice(0, 8).forEach(it => L.push('   ' + shortIt(it)));
      L.push(`   x: ${JSON.stringify(xs)}\n   y: ${JSON.stringify(ys)}\n   st: ${JSON.stringify(sts)}`);
      const by = {};
      a.forEach(i => { const k = i.tpl + '|' + nameOf(i); (by[k] = by[k] || []).push(amountOf(i)); });
      const d = Object.entries(by).filter(([, v]) => v.length > 1).slice(0, 6);
      if (d.length) L.push('   powtórzone: ' + d.map(([k, v]) => k.split('|')[1] + ' [' + v.join(',') + ']').join(' ; '));
    });
    try {
      const E = window.Engine;
      L.push('Engine – klucze z „dep”: ' + (Object.keys(E || {}).filter(k => /dep/i.test(k)).map(k => {
        const v = E[k]; return k + ':' + typeof v + (v && typeof v === 'object' ? '{' + Object.keys(v).slice(0, 40).join(',') + '}' : '');
      }).join(' | ') || '-'));
    } catch {}
    const dws = [...document.querySelectorAll('[class*="depo" i]')].filter(n => !root.contains(n));
    L.push('Elementy „depo” w oknie gry: ' + (dws.slice(0, 25).map(n => n.tagName + '.' + cls(n).slice(0, 80)).join(' ; ') || '-'));
    const dw = dws.find(n => n.getBoundingClientRect().width > 200);
    if (dw) {
      L.push('Aktywne elementy w oknie depozytu: ' + ([...dw.querySelectorAll('*')].filter(n => ACT.test(cls(n))).slice(0, 15)
        .map(n => n.tagName + '.' + cls(n).slice(0, 60) + (n.textContent.trim().length < 20 ? ' „' + n.textContent.trim() + '”' : '')).join(' ; ') || '-'));
      L.push('HTML okna depozytu (początek): ' + dw.outerHTML.replace(/\s+/g, ' ').slice(0, 1500));
    } else L.push('Nie widzę otwartego okna depozytu.');
    depoTxt.study = L.join('\n'); depoShow();
  }
  // nagrywanie: komendy gry (z hookG) i zmiany położenia/ilości przedmiotów we wszystkich lokacjach co 0,4 s
  let drec = null;
  const itemMap = () => {
    const m = {};
    LOCS.forEach(l => (fetchLoc(l) || []).forEach(it => { m[it.id] = { l, n: nameOf(it), x: +it.x, y: +it.y, st: it.st, a: amountOf(it) }; }));
    return m;
  };
  const where = o => `${o.l}(st=${o.st} x=${o.x} y=${o.y})×${o.a}`;
  function recLine(s) {
    if (!drec) return;
    drec.log.push(`+${((Date.now() - drec.t0) / 1000).toFixed(1)}s ${s}`);
    if (drec.log.length > 400) drec.log.shift();
    depoTxt.rec = 'Nagranie:\n' + drec.log.join('\n'); depoShow();
  }
  function recTick() {
    if (!drec) return;
    const now = itemMap(), was = drec.last;
    for (const id in now) {
      const a = now[id], b = was[id];
      if (!b) recLine(`nowy #${id} „${a.n}” ${where(a)}`);
      else if (a.l !== b.l || a.x !== b.x || a.y !== b.y || a.st !== b.st || a.a !== b.a) recLine(`#${id} „${a.n}” ${where(b)} → ${where(a)}`);
    }
    for (const id in was) if (!now[id]) recLine(`zniknął #${id} „${was[id].n}” ${where(was[id])}`);
    drec.last = now;
  }
  function depoRec() {
    if (drec) { clearInterval(drec.iv); recTick(); recLine('stop'); drec = null; }
    else { drec = { t0: Date.now(), log: [], last: itemMap(), iv: setInterval(recTick, 400) }; hookG(); recLine('start'); }
    $('#mbt-deporec').textContent = drec ? '⏹ Zatrzymaj' : '⏺ Nagrywaj';
    $('#mbt-deporec').classList.toggle('on', !!drec);
  }
  async function depoCopy() {
    const t = $('#mbt-depoout').textContent;
    if (!t) return void ($('#mbt-deponote').textContent = 'Najpierw zbadaj depozyt lub nagraj akcje.');
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch {}
    $('#mbt-deponote').textContent = ok ? 'Skopiowano – wklej mi to w rozmowie.' : 'Zaznacz tekst poniżej i skopiuj ręcznie (Ctrl+C).';
  }

  /* ---------- depozyt: łączenie identycznych stosów na otwartej stronie (przez torbę) ----------
     Komendy z nagrania użytkownika (10.2026): depo&get=ID&x&y (depozyt → torba), depo&put=ID&x&y (torba → depozyt).
     W depozycie gra nie łączy stosów, więc łączymy w torbie komendą moveitem i odkładamy na pierwotne miejsca. */
  const dsay = t => { const o = $('#mbt-depores'); o.style.display = 'block'; o.classList.remove('rich'); o.textContent = t; errFrom(t); };
  // postęp łączenia w depozycie: pasek i lista przedmiotów (zrobione / w trakcie / czeka / błąd)
  function depoProg(st, title) {
    const o = $('#mbt-depores'), ok = st.filter(x => x.s === 'ok').length, I = { ok: 'check', run: 'load', bad: 'warn', wait: 'dot' };
    o.style.display = 'block'; o.classList.add('rich');
    o.innerHTML = `<div class="ctitle">${esc(title)}<span class="sp"></span><span class="cnt">${ok} z ${st.length}</span></div>
      <div class="meter"><i style="width:${st.length ? Math.round(ok / st.length * 100) : 0}%"></i></div>
      <div class="steps">${st.map(x => `<div class="st ${x.s}">${ic(I[x.s])}<span class="grow">${esc(x.n)}</span><span>${esc(x.i)}</span></div>`).join('')}</div>`;
  }
  // karta nad wynikiem: otwarta strona, ile przedmiotów do połączenia i ile wolnych miejsc w torbach potrzeba
  let depoHTML = '';
  function depoInfo() {
    let head = 'otwórz depozyt w grze', html = '';
    if (depoOpen()) {
      const vis = visibleIds(), n = readItems('d').filter(i => vis.has(i.id)).length, g = depoGroups();
      head = `otwarta strona · ${n} / ${DCOLS * DROWS}`;
      if (g.length) {
        const need = Math.max(...g.map(x => x.length)), free = freeBagCells().length;
        html = `<div class="ctx"><div><div class="big">${g.length}<small> przedm.</small></div><div class="muted">do połączenia</div></div><span class="sp"></span>
          <span class="chip ${free >= need ? 'on' : 'bad'}">potrzeba ${need} wolnych w torbach · masz ${free}</span></div>`;
      } else html = '<div class="muted">Na tej stronie nie ma czego łączyć.</div>';
    }
    $('#mbt-depohead').textContent = head;
    if (html !== depoHTML) $('#mbt-depoplan').innerHTML = depoHTML = html;
  }
  const depoOpen = () => [...document.querySelectorAll('.depo')].some(n => !root.contains(n) && n.getBoundingClientRect().width > 100);
  // grupy: niepełne, identyczne stosy z limitem, widoczne na otwartej stronie (co najmniej 2)
  function depoGroups() {
    const vis = visibleIds(), by = {};
    readItems('d').filter(i => vis.has(i.id) && i.stackable && Number.isFinite(i.cap) && i.cap > 1 && i.amount < i.cap)
      .forEach(i => (by[keyOf(i)] = by[keyOf(i)] || []).push(i));
    return Object.values(by).filter(g => g.length > 1).sort((a, b) => a[0].name.localeCompare(b[0].name, 'pl'));
  }
  // kroki łączenia: największy niepełny stos dobiera od najmniejszych (jak w torbie)
  function stackSteps(list) {
    const st = list.map(s => ({ id: s.id, amount: s.amount, cap: s.cap })), steps = [];
    for (let guard = 0; guard < 200; guard++) {
      const open = st.filter(s => s.amount > 0 && s.amount < s.cap).sort((a, b) => b.amount - a.amount);
      if (open.length < 2) break;
      const dst = open[0], src = open[open.length - 1], move = Math.min(src.amount, dst.cap - dst.amount);
      steps.push({ src: src.id, dst: dst.id });
      dst.amount += move; src.amount -= move;
    }
    return { steps, after: st.filter(s => s.amount > 0).map(s => s.amount).sort((a, b) => b - a) };
  }
  function freeBagCells() {
    const { items, L } = snap(), used = new Set(items.filter(i => i.st === 0).map(i => i.x + ',' + i.y)), out = [];
    L.forEach(b => {
      for (let j = 0; j < b.cap; j++) { const x = j % COLS, y = b.from + Math.floor(j / COLS); if (!used.has(x + ',' + y)) out.push([x, y]); }
    });
    return out;
  }
  const locate = id => {
    for (const l of ['g', 'd']) { const it = readItems(l).find(i => i.id === id); if (it) return { l, it }; }
    return null;
  };
  async function waitFor(fn, ms = 3000) {
    for (let t = 0; t < ms; t += 50) { await sleep(50); const r = fn(); if (r) return r; }
    return null;
  }
  let depoBusy = false, depoStop = false;
  async function depoMerge() {
    if (busy) { if (depoBusy) { depoStop = true; dsay('Zatrzymam po bieżącym przedmiocie…'); } else dsay('Trwa inna akcja…'); return; }
    if (!depoOpen()) return dsay('Otwórz depozyt w grze – na stronie, którą chcesz uporządkować.');
    const groups = depoGroups();
    if (!groups.length) return dsay('Na otwartej stronie depozytu nie ma czego łączyć.');
    const need = Math.max(...groups.map(g => g.length)), free = freeBagCells().length;
    if (free < need) return dsay(`Potrzeba ${need} wolnych miejsc w torbach (masz ${free}). Zwolnij miejsce i kliknij ponownie.`);
    busy = depoBusy = true; depoStop = false; busyUI(); errHide();
    const t0 = Date.now(), log = [], all = new Set();
    const st = groups.map(g => ({ n: g[0].name, s: 'wait', i: g.map(i => i.amount).sort((a, b) => b - a).join(' · ') }));
    let done = 0, err = '', stopped = false;
    try {
      for (const [gi, g] of groups.entries()) {
        if (depoStop) { stopped = true; break; }
        const name = g[0].name, before = g.map(i => i.amount).sort((a, b) => b - a);
        const slots = g.map(i => [i.x, i.y]).sort((a, b) => a[1] - b[1] || a[0] - b[0]), taken = [];
        st[gi].s = 'run'; st[gi].i = 'łączę w torbie…';
        depoProg(st, 'Łączenie identycznych stosów');
        // 1) z depozytu do torby, każdy stos na wolne miejsce
        for (const i of g) {
          const cell = freeBagCells()[0];
          if (!cell) { err = 'brak wolnego miejsca w torbie'; break; }
          send(`depo&get=${i.id}&x=${cell[0]}&y=${cell[1]}`);
          const r = await waitFor(() => { const f = locate(i.id); return f && f.l === 'g' && f.it.x === cell[0] && f.it.y === cell[1] ? f : null; });
          if (!r) { err = 'gra nie przeniosła stosu do torby'; break; }
          taken.push(i.id); all.add(i.id);
          if (r.it.amount !== i.amount) { err = 'ilość w stosie zmieniła się przy przenoszeniu'; break; }
          await sleep(200);
        }
        // 2) łączenie w torbie
        if (!err) {
          for (const s of stackSteps(g).steps) {
            const d0 = locate(s.dst), s0 = locate(s.src);
            if (!d0 || !s0 || d0.l !== 'g' || s0.l !== 'g') { err = 'stos zniknął z torby'; break; }
            send(`moveitem&st=0&id=${s.src}&x=${d0.it.x}&y=${d0.it.y}`);
            if (!(await waitFor(() => { const d = locate(s.dst); return d && d.it.amount > d0.it.amount ? d : null; }))) { err = 'gra nie połączyła stosów w torbie'; break; }
            await sleep(200);
          }
        }
        // 3) z powrotem do depozytu, na pierwotne miejsca – także po błędzie, żeby nic nie zostało w torbie
        const back = taken.filter(id => { const f = locate(id); return f && f.l === 'g'; });
        for (let n = 0; n < back.length; n++) {
          const id = back[n], [x, y] = slots[n];
          if (readItems('d').some(i => i.x === x && i.y === y)) { err = (err ? err + '; ' : '') + `miejsce ${x},${y} w depozycie jest zajęte`; break; }
          send(`depo&put=${id}&x=${x}&y=${y}`);
          if (!(await waitFor(() => { const f = locate(id); return f && f.l === 'd' && f.it.x === x && f.it.y === y ? f : null; }))) {
            err = (err ? err + '; ' : '') + 'gra nie odłożyła stosu do depozytu'; break;
          }
          await sleep(200);
        }
        const after = readItems('d').filter(i => taken.includes(i.id)).map(i => i.amount).sort((a, b) => b - a);
        log.push(`• ${name}: ${before.join(', ')} → ${after.join(', ') || '–'}`);
        st[gi].s = err ? 'bad' : 'ok'; st[gi].i = `${before.join(' · ')} → ${after.join(' · ') || '–'}`;
        if (err) { err = `„${name}”: ${err} – przerwano.`; break; }
        done++;
      }
    } finally { busy = depoBusy = false; busyUI(); }
    const left = readItems('g').filter(i => all.has(i.id));
    const leftTxt = left.length ? `W torbie zostało z depozytu: ${left.map(i => `${i.name} ×${i.amount}`).join(', ')} – odłóż je ręcznie do depozytu.` : '';
    depoProg(st, `${stopped ? 'Zatrzymano' : err ? 'Przerwano' : 'Gotowe'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (err) errBar(err, leftTxt || 'Stosy wróciły na swoje miejsca w depozycie.');
    else if (leftTxt) errBar('Część stosów została w torbie', leftTxt);
    depoInfo();
  }

  /* ---------- ukrywanie innych graczy (wg skryptu użytkownika „usuwacz innych”, 10.2026) ----------
     Serwer przysyła innych graczy w polu `other`; przy włączonej opcji czyścimy je, zanim gra je przetworzy.
     Tylko wygląd u użytkownika – nic nie jest wysyłane do serwera. Flaga na window, żeby nowa wersja skryptu
     sterowała też nakładką założoną przez starszą. */
  function hookOthers() {
    try {
      const C = window.Engine && window.Engine.communication;
      if (!C || typeof C.parseJSON !== 'function') return false;
      if (C.parseJSON.__mbt) return true;
      const orig = C.parseJSON;
      const wrap = function (e) {
        try { if (window.__mbtHideOthers && e && typeof e === 'object' && Object.prototype.hasOwnProperty.call(e, 'other')) e.other = {}; } catch {}
        return orig.apply(this, arguments);
      };
      wrap.__mbt = 1;
      C.parseJSON = wrap;
      return true;
    } catch { return false; }
  }

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
    $('#mbt-search').value = ''; S.rar = []; S.lastFind = null; rarKey = ''; renderRar(); out.style.display = 'none'; errHide(); save();
  };
  $('#mbt-search').addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
  $('#mbt-wname').addEventListener('keydown', e => { if (e.key === 'Enter') wFind(); });
  $('#mbt-wfind').onclick = wFind;
  $('#mbt-dups').onclick = dups;
  $('#mbt-diag').onclick = diag;
  $('#mbt-depostudy').onclick = depoStudy;
  $('#mbt-deporec').onclick = depoRec;
  $('#mbt-depocopy').onclick = depoCopy;
  $('#mbt-depomerge').onclick = depoMerge;
  $('#mbt-merge').onclick = merge;
  $('#mbt-lootclear').onclick = () => {
    if (!confirm('Wyczyścić dziennik zdobyczy?')) return;
    LOOT.log = []; try { localStorage.setItem(LKEY, JSON.stringify(LOOT)); } catch {}
    renderLoot();
  };

  /* ---------- kopia ustawień (eksport / import) ---------- */
  const EXPORT_SKIP = ['lastFind', 'verified', 'sv', 'tab'];
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
    ['compact', 'showCount', 'lootToast', 'lootLoose', 'watchShow', 'hideOthers']
      .forEach(k => { if (typeof o[k] === 'boolean') S[k] = o[k]; });
    window.__mbtHideOthers = !!S.hideOthers;
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
    { id: 'toggle', label: 'Otwórz/zamknij okno', run() { dockOpen = !dockOpen; view(); } },
    { id: 'merge', label: 'Połącz identyczne (torba)', run() { dockOpen = true; S.tab = 'torba'; view(); merge(); } },
    { id: 'find', label: 'Szukaj przedmiotu', run() { dockOpen = true; S.tab = 'torba'; S.fold.search = false; S.min.main = false; applyFold(); view(); $('#mbt-search').focus(); } },
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
    $('#mbt-kmerge').textContent = (S.keys.merge || []).length ? fmt(S.keys.merge) : '';
    $('#mbt-keys').innerHTML = ACTIONS.map(a => {
      const on = rec && rec.id === a.id, k = S.keys[a.id] || [];
      const txt = on ? (rec.seq.length ? fmt(rec.seq) + ' …' : 'Naciśnij klawisze…') : (k.length ? fmt(k) : '—');
      return `<div class="kb"><span>${a.label}</span><button class="btn sm kbbtn${on ? ' rec' : ''}" data-kb="${a.id}" title="Kliknij i naciśnij 1–3 klawisze naraz">${txt}</button><button class="ibtn" data-kbclear="${a.id}" title="Usuń skrót">${ic('x')}</button></div>`;
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
  window.__mbtHideOthers = !!S.hideOthers;
  hookOthers(); setInterval(hookOthers, 2000);
  apply(); view();
  if (S.lastFind) renderFind(S.lastFind);
})();
