/* Copyright (c) 2026 zzpice. MIT License. */
// One record, optimistic revision check inside the same read/write transaction.
export async function openWorkspaceStore() {
  const db = await new Promise((resolve,reject) => {
    const request = indexedDB.open('anki-template-authoring',1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspaces');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('本地存储被其他页面占用'));
  });
  db.onversionchange = () => db.close();
  return {
    read() { return new Promise((resolve,reject) => {
      const request = db.transaction('workspaces').objectStore('workspaces').get('current');
      request.onsuccess = () => resolve(request.result || {revision:0});
      request.onerror = () => reject(request.error);
    }); },
    save(data, revision) { return new Promise((resolve,reject) => {
      const tx = db.transaction('workspaces','readwrite'), store = tx.objectStore('workspaces'); let conflict = false;
      const request = store.get('current');
      request.onsuccess = () => {
        if ((request.result?.revision || 0) !== revision) { conflict = true; tx.abort(); return; }
        store.put({revision:revision+1, data},'current');
      };
      tx.oncomplete = () => resolve(revision+1);
      tx.onabort = tx.onerror = () => reject(conflict ? new Error('另一页面已保存新版本。请先导出当前 JSON，再重新载入并导入合并。') : tx.error || new Error('本地保存失败'));
    }); },
  };
}
