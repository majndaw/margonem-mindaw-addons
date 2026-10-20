// ==UserScript==
// @name         Mindaw Addons (ładowacz)
// @namespace    margonem-mindaw-addons
// @version      1.0.0
// @description  Wczytuje najnowsze dodatki Mindaw z GitHuba przy każdym wejściu do gry Margonem.
// @match        http*://*.margonem.pl/
// @match        http*://*.margonem.com/
// @exclude      http*://margonem.*/*
// @exclude      http*://www.margonem.*/*
// @exclude      http*://new.margonem.*/*
// @exclude      http*://forum.margonem.*/*
// @exclude      http*://commons.margonem.*/*
// @exclude      http*://dev-commons.margonem.*/*
// @homepageURL  https://github.com/majndaw/margonem-mindaw-addons
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const BASE = 'https://majndaw.github.io/margonem-mindaw-addons/';
  // kolejne dodatki dopisuj do tej listy
  const ADDONS = ['margonem-bag-tools.user.js'];

  for (const file of ADDONS) {
    const s = document.createElement('script');
    // ?v=czas = zawsze najnowsza wersja, bez pamięci podręcznej
    s.src = BASE + file + '?v=' + Date.now();
    s.onerror = () => console.warn('[Mindaw Addons] Nie udało się wczytać: ' + file);
    document.body.appendChild(s);
  }
})();
