import { PortalUser, PortalSession, PortalAttendanceRecord, CurriculumFile } from '../types';

const DB_NAME = 'MavenPortalDB';
const DB_VERSION = 2; // Incremented version for schema change
const STORES = {
  USERS: 'users',
  SESSIONS: 'sessions',
  ATTENDANCE: 'attendance',
  CURRICULUM: 'curriculum_files',
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
      if (!dbInstance.objectStoreNames.contains(STORES.CURRICULUM)) {
        dbInstance.createObjectStore(STORES.CURRICULUM, { keyPath: 'id' });
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
            if (user && user.role === 'student' && !user.approved) {
              reject(new Error("Account pending teacher approval."));
              return;
            }
            resolve(user || null);
        };
        request.onerror = () => reject(request.error);
    });
};

export const getPendingStudents = async (): Promise<PortalUser[]> => {
    await initPortalDB();
    const store = getStore(STORES.USERS, 'readonly');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const users = request.result as PortalUser[];
            resolve(users.filter(u => u.role === 'student' && !u.approved));
        };
        request.onerror = () => reject(request.error);
    });
};

export const approveStudent = async (studentId: string): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.USERS, 'readwrite');
    const getRequest = store.get(studentId);
    return new Promise((resolve, reject) => {
        getRequest.onsuccess = () => {
            const user = getRequest.result as PortalUser;
            if (user) {
                user.approved = true;
                const putRequest = store.put(user);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error("Student not found."));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
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

// --- Curriculum File Functions ---
export const addCurriculumFile = async (fileInfo: CurriculumFile, fileBlob: Blob): Promise<void> => {
    await initPortalDB();
    const transaction = db.transaction([STORES.CURRICULUM, 'blobs'], 'readwrite');
    const infoStore = transaction.objectStore(STORES.CURRICULUM);
    const blobStore = transaction.objectStore('blobs'); // Assuming a 'blobs' store for binary data

    // This is a simplified model. A real implementation might need a separate blob store.
    // For this local-first app, we'll store the blob with a key matching the file ID.
    const blobKey = fileInfo.id;

    return new Promise((resolve, reject) => {
      const infoRequest = infoStore.add(fileInfo);
      infoRequest.onerror = () => reject(infoRequest.error);

      // This is a conceptual representation. Storing large blobs directly might be inefficient.
      const blobRequest = infoStore.put({ ...fileInfo, blob: fileBlob });
      blobRequest.onerror = () => reject(blobRequest.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
};


export const getCurriculumFiles = async (): Promise<CurriculumFile[]> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getCurriculumFileBlob = async (fileId: string): Promise<Blob | null> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readonly');
     return new Promise((resolve, reject) => {
        const request = store.get(fileId);
        request.onsuccess = () => resolve((request.result as any)?.blob || null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteCurriculumFile = async (fileId: string): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};