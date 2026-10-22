/* ===== 健康集 · 本地存储层（IndexedDB，数据不上传） ===== */
(function () {
  const DB_NAME = 'health-hub';
  const DB_VERSION = 1;
  const REC_STORE = 'records';
  const FILE_STORE = 'files';

  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(REC_STORE)) {
          const s = d.createObjectStore(REC_STORE, { keyPath: 'id' });
          s.createIndex('recordDate', 'recordDate', { unique: false });
          s.createIndex('type', 'type', { unique: false });
          s.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!d.objectStoreNames.contains(FILE_STORE)) {
          d.createObjectStore(FILE_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      const req = fn(os);
      let result;
      if (req) req.onsuccess = () => (result = req.result);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
    });
  }

  function uid() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  const Store = {
    async init() { await openDB(); },

    async getAll() {
      const all = await tx(REC_STORE, 'readonly', (os) => os.getAll());
      return (all || []).sort((a, b) => (b.recordDate || '').localeCompare(a.recordDate || ''));
    },

    async get(id) {
      return tx(REC_STORE, 'readonly', (os) => os.get(id));
    },

    async put(record) {
      if (!record.id) record.id = uid();
      if (!record.createdAt) record.createdAt = Date.now();
      return tx(REC_STORE, 'readwrite', (os) => os.put(record)).then(() => record);
    },

    async remove(id) {
      return tx(REC_STORE, 'readwrite', (os) => os.delete(id));
    },

    async clear() {
      await tx(REC_STORE, 'readwrite', (os) => os.clear());
      await tx(FILE_STORE, 'readwrite', (os) => os.clear());
    },

    /* 文件单独存储，记录里只放引用 */
    async saveFile(blob, name) {
      const id = uid();
      await tx(FILE_STORE, 'readwrite', (os) => os.put({ id, name, blob, mime: blob.type, size: blob.size }));
      return id;
    },

    async getFile(id) {
      const f = await tx(FILE_STORE, 'readonly', (os) => os.get(id));
      return f || null;
    },

    async getFiles(ids) {
      const out = [];
      for (const id of ids || []) {
        const f = await Store.getFile(id);
        if (f) out.push(f);
      }
      return out;
    },

    async exportJSON() {
      const records = await Store.getAll();
      const files = await tx(FILE_STORE, 'readonly', (os) => os.getAll());
      const filesB64 = await Promise.all((files || []).map(async (f) => {
        const buf = await f.blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return { id: f.id, name: f.name, mime: f.mime, size: f.size, data: btoa(bin) };
      }));
      return JSON.stringify({ app: 'health-hub', version: 1, exportedAt: new Date().toISOString(), records, files: filesB64 });
    },

    async importJSON(json) {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data || data.app !== 'health-hub') throw new Error('不是有效的健康集备份文件');
      const files = data.files || [];
      for (const f of files) {
        const bin = atob(f.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: f.mime || 'application/octet-stream' });
        await tx(FILE_STORE, 'readwrite', (os) => os.put({ id: f.id, name: f.name, blob, mime: f.mime, size: f.size }));
      }
      for (const r of data.records || []) {
        await tx(REC_STORE, 'readwrite', (os) => os.put(r));
      }
      return (data.records || []).length;
    }
  };

  /* ===== 设置（localStorage） ===== */
  const DEFAULT_SETTINGS = {
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-flash',
    apiKey: '',
    visionModel: ''
  };

  const Settings = {
    load() {
      try {
        const s = JSON.parse(localStorage.getItem('health-hub-settings') || '{}');
        return Object.assign({}, DEFAULT_SETTINGS, s);
      } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
    },
    save(s) {
      localStorage.setItem('health-hub-settings', JSON.stringify(s));
    }
  };

  window.Store = Store;
  window.Settings = Settings;
})();
