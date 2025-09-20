const DB_NAME = 'MavenDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(true);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(new Error(`IndexedDB failed to open: ${request.error?.message}`));
    };
  });
};

export const setBannerData = (key: string, value: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('DB not initialized');
      return;
    }
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      console.error('Transaction error:', transaction.error);
      reject(transaction.error);
    };
  });
};

export const getBannerData = (key: string): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        reject('DB not initialized');
        return;
    }
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => {
      console.error('Transaction error:', request.error);
      reject(request.error);
    };
  });
};

export const deleteBannerData = (key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('DB not initialized');
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            reject(transaction.error);
        };
    });
};