/* Pont vers le moteur Python (engine-worker.js). Une promesse par commande. */
const Engine = (() => {
  const worker = new Worker(new URL('engine-worker.js', document.currentScript.src));
  const pending = new Map();
  const listeners = new Set();
  let seq = 0;
  worker.onmessage = (ev) => {
    const msg = ev.data;
    if (msg.type === 'progress') { listeners.forEach(fn => fn(msg.step)); return; }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
  };
  worker.onerror = (ev) => {
    const err = new Error(ev.message || 'le moteur s\'est arrêté');
    pending.forEach(p => p.reject(err)); pending.clear();
  };
  function call(cmd, payload = {}, transfer = []) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, cmd, ...payload }, transfer);
    });
  }
  const root = new URL('..', document.currentScript.src).href;
  let ready = null;
  return {
    onProgress(fn) { listeners.add(fn); },
    boot(version) { return ready = ready || call('boot', { base: root, version }); },
    async load(fileList) {
      const files = [];
      for (const f of fileList) files.push({ name: f.name, bytes: await f.arrayBuffer() });
      return call('load', { files }, files.map(f => f.bytes));
    },
    analyse(tri) { return call('analyse', { tri }); },
    dossier(tri, opts) { return call('dossier', { tri, opts }); },
  };
})();
