

import { PortalUser, PortalSession, PortalAttendanceRecord } from '../types';

let db: IDBDatabase;

const DB_NAME = 'MavenPortalDB';
const DB_VERSION = 1;

export const initPortalDB = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (db) return resolve(true);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains('users')) {
        // FIX: Removed 'autoIncrement: true' because string UUIDs are used for IDs, not numbers.
        const userStore = dbInstance.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('email', 'email', { unique: true });
      }
      if (!dbInstance.objectStoreNames.contains('sessions')) {
        dbInstance.createObjectStore('sessions', { keyPath: 'id' });
      }
       if (!dbInstance.objectStoreNames.contains('attendance')) {
        // FIX: Removed 'autoIncrement: true' because string UUIDs are used for IDs, not numbers.
        const attendanceStore = dbInstance.createObjectStore('attendance', { keyPath: 'id' });
        attendanceStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      resolve(false);
    };
  });
};

// --- User Functions ---
export const registerUser = (user: Omit<PortalUser, 'id'>): Promise<PortalUser> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readwrite');
        const store = transaction.objectStore('users');
        const request = store.add({id: crypto.randomUUID(), ...user});
        request.onsuccess = () => {
            const getReq = store.get(request.result);
            getReq.onsuccess = () => resolve(getReq.result);
        };
        request.onerror = () => reject('User with this email already exists.');
    });
};

export const loginUser = (email: string, pass: string): Promise<PortalUser> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('email');
        const request = index.get(email);
        request.onsuccess = () => {
            if (request.result && request.result.password === pass) {
                resolve(request.result);
            } else {
                reject('Invalid email or password.');
            }
        };
        request.onerror = () => reject('Failed to login.');
    });
};

export const getUserById = (id: string): Promise<PortalUser | null> => {
    return new Promise((resolve) => {
        if (!db) return resolve(null);
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};


// --- Session Functions ---
export const createSession = (session: Omit<PortalSession, 'id'>): Promise<PortalSession> => {
    return new Promise((resolve, reject) => {
        // FIX: Explicitly type `newSession` to resolve a compiler error where the `id` field's
        // literal type was being incorrectly widened to `string`.
        const newSession: PortalSession = { ...session, id: 'active_session' };
        const transaction = db.transaction('sessions', 'readwrite');
        const store = transaction.objectStore('sessions');
        const clearRequest = store.clear(); // Ensure only one active session
        clearRequest.onsuccess = () => {
            const addRequest = store.put(newSession);
            addRequest.onsuccess = () => resolve(newSession);
            addRequest.onerror = () => reject('Failed to create session.');
        };
        clearRequest.onerror = () => reject('Failed to clear old sessions.');
    });
};

export const getActiveSession = (): Promise<PortalSession | null> => {
    return new Promise((resolve) => {
        if (!db) return resolve(null);
        const transaction = db.transaction('sessions', 'readonly');
        const store = transaction.objectStore('sessions');
        const request = store.get('active_session');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};

export const endSession = (): Promise<void> => {
    return new Promise((resolve) => {
        const transaction = db.transaction('sessions', 'readwrite');
        const store = transaction.objectStore('sessions');
        store.clear();
        transaction.oncomplete = () => resolve();
    });
};

// --- Attendance Functions ---
export const logAttendance = (attendance: Omit<PortalAttendanceRecord, 'id'>): Promise<PortalAttendanceRecord> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('attendance', 'readwrite');
        const store = transaction.objectStore('attendance');
        const newRecord = { ...attendance, id: crypto.randomUUID() };
        const request = store.add(newRecord);
        request.onsuccess = () => resolve(newRecord);
        request.onerror = (e) => {
            console.error(e);
            reject('Failed to log attendance.');
        }
    });
};

export const getAttendanceForSession = (sessionId: string): Promise<PortalAttendanceRecord[]> => {
    return new Promise((resolve) => {
        if (!db) return resolve([]);
        const transaction = db.transaction('attendance', 'readonly');
        const store = transaction.objectStore('attendance');
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
};