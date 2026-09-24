/* Moteur de l'Atelier GTA, dans un Web Worker.
 *
 * Charge Pyodide (CDN), installe openpyxl depuis les wheels du dépôt (vendor/),
 * puis les modules Python d'engine/. Le reste de la page ne parle au moteur
 * que par messages : {id, cmd, ...} -> {id, ok, result | error}.
 *
 * Aucun fichier ne quitte le navigateur : les exports sont écrits dans le
 * système de fichiers virtuel de Pyodide, en mémoire.
 */
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';
const WHEELS = ['et_xmlfile-2.0.0-py3-none-any.whl', 'openpyxl-3.1.5-py2.py3-none-any.whl'];
const MODULES = ['tables.py', 'dossier_common.py', 'humanizer.py', 'build_xlsx.py', 'model.py'];

let py = null;
let base = '';
let bootPromise = null;

function progress(step) { self.postMessage({ type: 'progress', step }); }

async function boot(root, version) {
  base = root;
  const bust = version ? '?v=' + encodeURIComponent(version) : '';
  progress('Téléchargement de Python…');
  importScripts(PYODIDE + 'pyodide.js');
  py = await loadPyodide({ indexURL: PYODIDE });
  progress('Installation d\'openpyxl…');
  for (const wheel of WHEELS) {
    const res = await fetch(base + 'vendor/' + wheel);
    if (!res.ok) throw new Error('bibliothèque introuvable : ' + wheel);
    py.unpackArchive(await res.arrayBuffer(), 'wheel');
  }
  progress('Chargement du moteur…');
  py.FS.mkdirTree('/moteur');
  for (const name of MODULES) {
    const res = await fetch(base + 'engine/' + name + bust);
    if (!res.ok) throw new Error('module introuvable : ' + name);
    py.FS.writeFile('/moteur/' + name, await res.text());
  }
  await py.runPythonAsync(`
import sys
sys.path.insert(0, '/moteur')
import model, build_xlsx, dossier_common
`);
  return py.runPython('build_xlsx.VERSION');
}

function safeName(name) { return name.replace(/[^\w.\- ()À-ÿ]/g, '_'); }

async function load(files) {
  py.runPython("import shutil, os; shutil.rmtree('/entrees', ignore_errors=True); os.makedirs('/entrees')");
  const paths = [];
  for (const f of files) {
    const path = '/entrees/' + safeName(f.name);
    py.FS.writeFile(path, new Uint8Array(f.bytes));
    paths.push(path);
  }
  py.globals.set('chemins', py.toPy(paths));
  const tri = JSON.parse(py.runPython(`
import json
from dossier_common import identify_files
tri = identify_files(list(chemins))
json.dumps({'rapport': tri['rapport'], 'manque': tri['manque'], 'regles': tri['regles'],
            'jours': tri['types de jour'], 'refs': tri['referentiels']}, ensure_ascii=False)
`));
  return tri;
}

function analyse(tri) {
  py.globals.set('tri', py.toPy(tri));
  return JSON.parse(py.runPython(`
import json, model
m = model.build_model(tri['regles'], tri['jours'] or None, list(tri['refs']))
json.dumps(m, ensure_ascii=False)
`));
}

function dossier(tri, opts) {
  py.globals.set('tri', py.toPy(tri));
  py.globals.set('opts', py.toPy(opts));
  py.runPython(`
import build_xlsx
from dossier_common import load_referentials
refs, _ = load_referentials(list(tri['refs']))
build_xlsx.build(tri['regles'], '/sortie.xlsx', tri['jours'] or None, opts.get('client') or None,
                 None, 'contrats' if opts.get('contrats', True) else 'non',
                 opts.get('langue', 'fr'), refs)
`);
  return py.FS.readFile('/sortie.xlsx');
}

self.onmessage = async (ev) => {
  const { id, cmd } = ev.data;
  try {
    let result;
    if (cmd === 'boot') {
      bootPromise = bootPromise || boot(ev.data.base, ev.data.version);
      result = await bootPromise;
    } else {
      await bootPromise;
      if (cmd === 'load') result = await load(ev.data.files);
      else if (cmd === 'analyse') result = analyse(ev.data.tri);
      else if (cmd === 'dossier') {
        const bytes = dossier(ev.data.tri, ev.data.opts || {});
        self.postMessage({ id, ok: true, result: bytes }, [bytes.buffer]);
        return;
      } else throw new Error('commande inconnue : ' + cmd);
    }
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    // ExportError et autres : on renvoie la dernière ligne lisible de la trace Python
    const text = String(err && err.message || err);
    const lines = text.trim().split('\n');
    self.postMessage({ id, ok: false, error: lines[lines.length - 1] || text });
  }
};
