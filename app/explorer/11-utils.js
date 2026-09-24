/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 7. UTILS
 * ========================================================================*/
function htmlTooltip(html) {
  const d = document.createElement('div');
  d.style.padding='9px 12px';d.style.background='var(--panel)';d.style.color='var(--txt)';
  d.style.border='1px solid var(--border)';d.style.borderRadius='10px';
  d.style.boxShadow='var(--shadow-3)';d.style.lineHeight='1.5';
  d.style.maxWidth='340px';d.style.fontSize='11.5px';
  d.innerHTML = html;
  return d;
}
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function escapeAttr(s){return escapeHtml(s);}

/* ------------------------------------------------------------------
 * Libellés « riches ».
 * Les libellés saisis dans #Dièse contiennent parfois un peu de mise en
 * forme HTML inline, ex. « Somme de <small>VDL</small> H Dim/JF A payer ».
 * richText() rend cette mise en forme, mais UNIQUEMENT pour une liste
 * blanche de balises sans attribut : tout le reste (attributs, <script>,
 * <img onerror=…>, balises inconnues) reste échappé et s'affiche en clair.
 * On échappe d'abord tout, puis on « déséchappe » les seules balises
 * autorisées — l'ordre garantit qu'aucun HTML actif ne peut passer.
 * plainText() donne la version sans balise, pour les contextes qui
 * n'acceptent pas de HTML : libellés de nœuds du graphe (canvas),
 * attributs title, <title> du document, recherche, phrases générées.
 * ------------------------------------------------------------------ */
const RICH_TAGS = ['b','strong','i','em','small','u','s','strike','sub','sup','mark','br','wbr'];
const RICH_RE = new RegExp('&lt;(/?)(' + RICH_TAGS.join('|') + ')\\s*/?&gt;', 'gi');
function richText(s){
  return escapeHtml(s).replace(RICH_RE, (m, slash, tag) => {
    const t = tag.toLowerCase();
    return (t === 'br' || t === 'wbr') ? ('<' + t + '>') : ('<' + slash + t + '>');
  });
}
function plainText(s){
  // On ne retire que ce qui ressemble vraiment à une balise (< suivi d'une
  // lettre ou de /) : un libellé du genre « Heures < 35h » ou « Seuil >8h »
  // garde ses signes de comparaison intacts.
  return String(s == null ? '' : s)
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*)?\/?>/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function shade(hex, pct){
  const m = String(hex||'').match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return hex;
  const n = parseInt(m[1],16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r=Math.max(0,Math.min(255,r+Math.round(255*pct/100)));
  g=Math.max(0,Math.min(255,g+Math.round(255*pct/100)));
  b=Math.max(0,Math.min(255,b+Math.round(255*pct/100)));
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function toast(msg, kind){
  const root = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + (kind||'');
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),250); }, 3500);
}
