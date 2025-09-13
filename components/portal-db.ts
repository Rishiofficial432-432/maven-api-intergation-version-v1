import { PortalUser, PortalSession, PortalAttendanceRecord } from '../types';

const DB_NAME = 'MavenPortalDB';
const DB_VERSION = 1;
const STORES = {
  USERS: 'users',
  SESSIONS: 'sessions',
  ATTENDANCE: 'attendance',
};

let db: IDBDatabase;

const initPortalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(STORES.USERS)) {
        dbInstance.createObjectStore(STORES.USERS, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.SESSIONS)) {
        dbInstance.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.ATTENDANCE)) {
        const store = dbInstance.createObjectStore(STORES.ATTENDANCE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('session_id', 'session_id', { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('IndexedDB error');
    };
  });
};

const getStore = (storeName: string, mode: IDBTransactionMode) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
};

// --- User Functions ---
export const createUser = async (user: PortalUser): Promise<void> => {
  await initPortalDB();
  const store = getStore(STORES.USERS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.add(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getUserByEmail = async (email: string): Promise<PortalUser | null> => {
    await initPortalDB();
    const store = getStore(STORES.USERS, 'readonly');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const users = request.result as PortalUser[];
            const user = users.find(u => u.email === email);
            resolve(user || null);
        };
        request.onerror = () => reject(request.error);
    });
};

// --- Session Functions ---
export const createSession = async (session: PortalSession): Promise<void> => {
    await initPortalDB();
    // Clear any old sessions first
    const clearStore = getStore(STORES.SESSIONS, 'readwrite');
    const clearRequest = clearStore.clear();
    
    return new Promise((resolve, reject) => {
        clearRequest.onsuccess = () => {
            const addStore = getStore(STORES.SESSIONS, 'readwrite');
            const addRequest = addStore.add(session);
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = () => reject(addRequest.error);
        };
        clearRequest.onerror = () => reject(clearRequest.error);
    });
};

export const getActiveSession = async (): Promise<PortalSession | null> => {
    await initPortalDB();
    const store = getStore(STORES.SESSIONS, 'readonly');
    const request = store.getAll();
     return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const sessions = request.result as PortalSession[];
            if (sessions.length > 0) {
                 const session = sessions[0];
                if (new Date(session.expires_at) > new Date()) {
                    resolve(session);
                } else {
                    // Clean up expired session
                    createSession({} as PortalSession).finally(() => resolve(null));
                }
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const endActiveSession = async (): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.SESSIONS, 'readwrite');
    const request = store.clear();
     return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};


// --- Attendance Functions ---
export const logAttendance = async (record: Omit<PortalAttendanceRecord, 'id' | 'created_at'>): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.ATTENDANCE, 'readwrite');
    const newRecord = { ...record, created_at: new Date().toISOString() };

    return new Promise((resolve, reject) => {
        const request = store.add(newRecord);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAttendanceForSession = async (sessionId: string): Promise<PortalAttendanceRecord[]> => {
    await initPortalDB();
    const store = getStore(STORES.ATTENDANCE, 'readonly');
    const index = store.index('session_id');
    const request = index.getAll(sessionId);

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as PortalAttendanceRecord[]);
        request.onerror = () => reject(request.error);
    });
};
