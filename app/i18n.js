/* Langue de l'interface de l'Atelier (depuis v2.1).
 *
 * Deux mécanismes, un seul état :
 *   - dans le HTML, un élément porte son texte français et sa version anglaise en
 *     attribut : data-en (texte), data-en-html (contenu avec balises), data-en-title,
 *     data-en-placeholder, data-en-aria. I18N.apply() bascule tout le document ;
 *   - dans le code, L('texte français', 'English text') renvoie la version de la
 *     langue courante. Le français et l'anglais restent côte à côte, au même endroit.
 *
 * Les libellés venant de l'environnement du client (règles, contrats, types de
 * jour) ne sont jamais traduits : on doit les retrouver à l'identique dans #Dièse.
 */
"use strict";

const I18N = {
  KEY: 'atelier-lang',
  lang: 'fr',
  listeners: [],

  init() {
    let saved = null;
    try { saved = localStorage.getItem(this.KEY); } catch (_) { /* navigation privée */ }
    const browser = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    this.lang = saved === 'fr' || saved === 'en' ? saved : browser;
    this.apply();
  },

  set(lang) {
    if (lang !== 'fr' && lang !== 'en') return;
    if (lang === this.lang) { this.paintSwitch(); return; }
    this.lang = lang;
    try { localStorage.setItem(this.KEY, lang); } catch (_) { /* mémorisation facultative */ }
    this.apply();
    for (const fn of this.listeners) {
      try { fn(lang); } catch (err) { console.error(err); }
    }
  },

  onChange(fn) { this.listeners.push(fn); },

  // Bascule les textes statiques du document. Le français d'origine est gardé en
  // data-fr* au premier passage, pour pouvoir revenir en arrière.
  apply(root) {
    const en = this.lang === 'en';
    document.documentElement.lang = this.lang;
    const scope = root || document;
    const swap = (attr, read, write) => {
      scope.querySelectorAll('[data-en' + attr + ']').forEach(el => {
        const store = 'data-fr' + attr;
        if (!el.hasAttribute(store)) el.setAttribute(store, read(el));
        write(el, en ? el.getAttribute('data-en' + attr) : el.getAttribute(store));
      });
    };
    swap('', el => el.textContent, (el, v) => { el.textContent = v; });
    swap('-html', el => el.innerHTML, (el, v) => { el.innerHTML = v; });
    swap('-title', el => el.getAttribute('title') || '', (el, v) => el.setAttribute('title', v));
    swap('-placeholder', el => el.getAttribute('placeholder') || '', (el, v) => el.setAttribute('placeholder', v));
    swap('-aria', el => el.getAttribute('aria-label') || '', (el, v) => el.setAttribute('aria-label', v));
    this.paintSwitch();
  },

  // Slider FR | EN de l'en-tête : deux boutons radio et une pastille qui glisse.
  bindSwitch() {
    const sw = document.getElementById('lang-switch');
    if (!sw) return;
    sw.querySelectorAll('[data-lang]').forEach(b =>
      b.addEventListener('click', () => this.set(b.dataset.lang)));
    sw.addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        this.set(this.lang === 'fr' ? 'en' : 'fr');
        sw.querySelector(`[data-lang="${this.lang}"]`).focus();
      }
    });
    this.paintSwitch();
  },

  paintSwitch() {
    const sw = document.getElementById('lang-switch');
    if (!sw) return;
    sw.dataset.lang = this.lang;
    sw.querySelectorAll('[data-lang]').forEach(b => {
      const on = b.dataset.lang === this.lang;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  },
};

/* L('Texte', 'Text') : la chaîne dans la langue de l'interface. */
function L(fr, en) { return I18N.lang === 'en' ? en : fr; }

/* Nombre + nom accordé : Ln(3, 'règle', 'règles', 'rule', 'rules') -> « 3 règles ». */
function Ln(n, frOne, frMany, enOne, enMany) {
  return n + ' ' + (I18N.lang === 'en' ? (n === 1 ? enOne : enMany) : (n > 1 ? frMany : frOne));
}

I18N.init();
