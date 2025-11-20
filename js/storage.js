const DB_NAME = 'MaxMoviesDB';
const STORE_NAME = 'downloads';
const VERSION = 1;

let cachedDB = null;

export const db = {

    async open() {
        // Reuse existing DB connection
        if (cachedDB) return cachedDB;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, VERSION);

            // Fix database upgrades / initialize store
            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                cachedDB = request.result;

                // Auto-recover if the DB goes into error mode
                cachedDB.onerror = () => {
                    console.warn('IndexedDB error → clearing DB');
                    indexedDB.deleteDatabase(DB_NAME);
                    cachedDB = null;
                };

                resolve(cachedDB);
            };

            request.onerror = (e) => {
                console.error('IndexedDB open failed', e);
                reject(e);
            };
        });
    },

    // Save movie file + metadata
    async saveDownload(meta, blob) {
        const database = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const tx = database.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);

                const data = {
                    ...meta,
                    blob,
                    date: new Date().toISOString()
                };

                store.put(data);

                tx.oncomplete = () => resolve(true);
                tx.onerror = (err) => {
                    console.error('Save failed', err);
                    reject(err);
                };

            } catch (err) {
                console.error('Transaction error', err);
                reject(err);
            }
        });
    },

    // Retrieve all downloads
    async getAll() {
        const database = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const tx = database.transaction(STORE_NAME, 'readonly');
                const request = tx.objectStore(STORE_NAME).getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = (e) => reject(e);

            } catch (err) {
                console.error(err);
                resolve([]);
            }
        });
    },

    // Delete a specific download
    async delete(id) {
        const database = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const tx = database.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(id);

                tx.oncomplete = () => resolve(true);
                tx.onerror = (err) => reject(err);

            } catch (err) {
                reject(err);
            }
        });
    },

    // Delete ALL downloads (optional helper)
    async deleteAll() {
        const database = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const tx = database.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();

                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e);

            } catch (err) {
                reject(err);
            }
        });
    }
};
