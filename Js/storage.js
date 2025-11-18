const DB_NAME = 'MaxMoviesDB';
const STORE_NAME = 'downloads';
const VERSION = 1;

export const db = {
    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    },

    async saveDownload(meta, blob) {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ ...meta, blob, date: new Date() });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    },

    async getAll() {
        const database = await this.open();
        return new Promise(resolve => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result);
        });
    },

    async delete(id) {
        const database = await this.open();
        return new Promise(resolve => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
        });
    }
};
