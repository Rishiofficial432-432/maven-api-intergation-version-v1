
// FIX: Re-export local portal types to be consumed by other modules.
export type { PortalSession, PortalAttendanceRecord } from '../types';
import { PortalUser, PortalSession, PortalAttendanceRecord, CurriculumFile } from '../types';

const DB_NAME = 'MavenPortalDB';
const DB_VERSION = 3; // Keep version the same, the logic will handle the fix
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

    request.onupgradeneeded = (event) => {
      const dbInstance = request.result;
      const transaction = (event.target as any).transaction;

      // Version 1: Initial schema for users, sessions, and attendance
      if (event.oldVersion < 1) {
        if (!dbInstance.objectStoreNames.contains(STORES.USERS)) {
          dbInstance.createObjectStore(STORES.USERS, { keyPath: 'id' });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.SESSIONS)) {
          dbInstance.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.ATTENDANCE)) {
          dbInstance.createObjectStore(STORES.ATTENDANCE, { keyPath: 'id', autoIncrement: true });
        }
      }

      // This block runs for any upgrade to version 3 (or higher) from an older version.
      // This is the key fix: It ensures the index and new store are created correctly on upgrade.
      if (event.oldVersion < 3) {
        // Fix/Add the attendance index if it's missing
        if (dbInstance.objectStoreNames.contains(STORES.ATTENDANCE)) {
            const attendanceStore = transaction.objectStore(STORES.ATTENDANCE);
            if (!attendanceStore.indexNames.contains('session_id')) {
                 attendanceStore.createIndex('session_id', 'session_id', { unique: false });
            }
        }
        // Add the curriculum store
        if (!dbInstance.objectStoreNames.contains(STORES.CURRICULUM)) {
           dbInstance.createObjectStore(STORES.CURRICULUM, { keyPath: 'id' });
        }
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
    if (!session || !session.id) {
        throw new Error("Invalid session object provided to createSession.");
    }
    const store = getStore(STORES.SESSIONS, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.add(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getActiveSession = async (): Promise<PortalSession | null> => {
    await initPortalDB();
    const store = getStore(STORES.SESSIONS, 'readwrite'); // readwrite to clean up
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const sessions = request.result as PortalSession[];
            const now = new Date();
            for (const session of sessions) {
                if (session.is_active) {
                    if (new Date(session.expires_at) > now) {
                        return resolve(session);
                    } else {
                        // Expired session found, end it
                        session.is_active = false;
                        store.put(session);
                    }
                }
            }
            resolve(null); // No active, non-expired session found
        };
        request.onerror = () => reject(request.error);
    });
};

export const endActiveSession = async (): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.SESSIONS, 'readwrite');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const sessions = request.result as PortalSession[];
            const active = sessions.find(s => s.is_active);
            if (active) {
                active.is_active = false;
                const updateRequest = store.put(active);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve(); // No active session to end
            }
        };
        request.onerror = () => reject(request.error);
    });
};

// --- Attendance Functions ---
export const logAttendance = async (record: Omit<PortalAttendanceRecord, 'id' | 'created_at'>): Promise<void> => {
    await initPortalDB();
    const attendanceStore = getStore(STORES.ATTENDANCE, 'readwrite');

    return new Promise((resolve, reject) => {
        const index = attendanceStore.index('session_id');
        const range = IDBKeyRange.only(record.session_id);
        const getRequest = index.getAll(range);

        getRequest.onsuccess = () => {
            const existingRecords = getRequest.result as PortalAttendanceRecord[];
            if (existingRecords.some(r => r.student_id === record.student_id)) {
                return reject(new Error("You have already checked in for this session."));
            }

            const newRecord = { ...record, created_at: new Date().toISOString() };
            const addRequest = attendanceStore.add(newRecord);
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = () => reject(addRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

export const getAttendanceForSession = async (sessionId: string): Promise<PortalAttendanceRecord[]> => {
    await initPortalDB();
    const store = getStore(STORES.ATTENDANCE, 'readonly');
    const index = store.index('session_id');
    const request = index.getAll(sessionId);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve((request.result || []).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        request.onerror = () => reject(request.error);
    });
};

// --- Curriculum Functions ---
export const addCurriculumFile = async (fileInfo: CurriculumFile, fileBlob: Blob): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readwrite');
    return new Promise((resolve, reject) => {
        const dataToStore = { ...fileInfo, blob: fileBlob };
        const request = store.put(dataToStore);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getCurriculumFiles = async (): Promise<CurriculumFile[]> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readonly');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const files = request.result.map((f: any) => {
                const { blob, ...info } = f;
                return info;
            });
            resolve(files.sort((a: CurriculumFile, b: CurriculumFile) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        };
        request.onerror = () => reject(request.error);
    });
};

export const getCurriculumFileBlob = async (fileId: string): Promise<Blob | null> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readonly');
    const request = store.get(fileId);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result?.blob || null);
        };
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

// --- Demo User Functions ---
export const getDemoUser = async (role: 'teacher' | 'student'): Promise<PortalUser> => {
    await initPortalDB();
    const email = role === 'teacher' ? 'e.reed@university.edu' : 'a.johnson@university.edu';
    
    const store = getStore(STORES.USERS, 'readwrite');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const users = request.result as PortalUser[];
            let user = users.find(u => u.email === email);

            if (user) {
                resolve(user);
            } else {
                // User doesn't exist, create them in IndexedDB
                const newUser: PortalUser = role === 'teacher' ? {
                    id: `demo-teacher-${crypto.randomUUID()}`,
                    name: 'Dr. Evelyn Reed',
                    email,
                    role: 'teacher',
                    approved: true,
                } : {
                    id: `demo-student-${crypto.randomUUID()}`,
                    name: 'Alex Johnson',
                    email,
                    role: 'student',
                    approved: true,
                    enrollment_id: 'S12345',
                    ug_number: 'UG67890',
                    phone_number: '555-0101',
                };
                
                const addRequest = store.add(newUser);
                addRequest.onsuccess = () => resolve(newUser);
                addRequest.onerror = () => reject(addRequest.error);
            }
        };
        request.onerror = () => reject(request.error);
    });
};