// FIX: Re-export local portal types to be consumed by other modules.
export type { PortalSession, PortalAttendanceRecord } from '../types';
import { PortalUser, PortalSession, PortalAttendanceRecord, CurriculumFile, Test, TestSubmission, UnitMaterial } from '../types';

const DB_NAME = 'MavenPortalDB';
const DB_VERSION = 6; // Incremented version to trigger the new, robust upgrade logic
const STORES = {
  USERS: 'users',
  SESSIONS: 'sessions',
  ATTENDANCE: 'attendance',
  CURRICULUM: 'curriculum_files',
  TESTS: 'tests',
  SUBMISSIONS: 'submissions',
  UNIT_MATERIALS: 'unit_materials',
};

let db: IDBDatabase;

const initPortalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = request.result;
      const transaction = request.transaction;
      if (!transaction) {
          console.error("Version change transaction is null during upgrade. Aborting.");
          return;
      }

      // --- Create missing object stores ---
      // This declarative approach is more robust than checking oldVersion.
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
      if (!dbInstance.objectStoreNames.contains(STORES.TESTS)) {
        dbInstance.createObjectStore(STORES.TESTS, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.SUBMISSIONS)) {
        const store = dbInstance.createObjectStore(STORES.SUBMISSIONS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('studentId', 'studentId', { unique: false });
        store.createIndex('testId', 'testId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.UNIT_MATERIALS)) {
        dbInstance.createObjectStore(STORES.UNIT_MATERIALS, { keyPath: 'id' });
      }

      // --- Handle index upgrades for users with older DB versions ---
      if (dbInstance.objectStoreNames.contains(STORES.ATTENDANCE)) {
          const store = transaction.objectStore(STORES.ATTENDANCE);
          if (!store.indexNames.contains('session_id')) {
              store.createIndex('session_id', 'session_id', { unique: false });
          }
      }
    };

    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => { console.error('IndexedDB error:', request.error); reject('IndexedDB error'); };
  });
};

const getStore = (storeName: string, mode: IDBTransactionMode) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
};

// Generic get all from store
// FIX: Export `getAllFromStore` to make it accessible to other modules that need to query the local database.
export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
    await initPortalDB();
    const store = getStore(storeName, 'readonly');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
    });
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
    const users = await getAllFromStore<PortalUser>(STORES.USERS);
    const user = users.find(u => u.email === email);
    if (user && user.role === 'student' && !user.approved) {
        throw new Error("Account pending teacher approval.");
    }
    return user || null;
};

export const getStudents = async (): Promise<PortalUser[]> => {
    const users = await getAllFromStore<PortalUser>(STORES.USERS);
    return users.filter(u => u.role === 'student' && u.approved);
};


export const getPendingStudents = async (): Promise<PortalUser[]> => {
    const users = await getAllFromStore<PortalUser>(STORES.USERS);
    return users.filter(u => u.role === 'student' && !u.approved);
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
    const store = getStore(STORES.SESSIONS, 'readwrite');
    const sessions = await getAllFromStore<PortalSession>(STORES.SESSIONS);
    const now = new Date();
    for (const session of sessions) {
        if (session.is_active) {
            if (new Date(session.expires_at) > now) return session;
            session.is_active = false;
            store.put(session);
        }
    }
    return null;
};

export const endActiveSession = async (): Promise<void> => {
    const activeSession = await getActiveSession();
    if (activeSession) {
        activeSession.is_active = false;
        const store = getStore(STORES.SESSIONS, 'readwrite');
        const req = store.put(activeSession);
        return new Promise((res, rej) => { req.onsuccess = () => res(); req.onerror = () => rej(req.error); });
    }
};

// --- Attendance Functions ---
export const logAttendance = async (record: Omit<PortalAttendanceRecord, 'id' | 'created_at'>): Promise<void> => {
    await initPortalDB();
    const attendanceStore = getStore(STORES.ATTENDANCE, 'readwrite');

    const allAttendance = await getAttendanceForSession(record.session_id);
    if (allAttendance.some(r => r.student_id === record.student_id)) {
        throw new Error("You have already checked in for this session.");
    }
    
    const newRecord = { ...record, created_at: new Date().toISOString() };
    const addRequest = attendanceStore.add(newRecord);
    return new Promise((resolve, reject) => {
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
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
    const dataToStore = { ...fileInfo, blob: fileBlob };
    const request = store.put(dataToStore);
    return new Promise((res, rej) => { request.onsuccess = () => res(); request.onerror = () => rej(request.error); });
};

export const getCurriculumFiles = async (): Promise<CurriculumFile[]> => {
    const files = await getAllFromStore<any>(STORES.CURRICULUM);
    return files.map((f: any) => {
        const { blob, ...info } = f;
        return info;
    }).sort((a: CurriculumFile, b: CurriculumFile) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getCurriculumFileBlob = async (fileId: string): Promise<Blob | null> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readonly');
    const request = store.get(fileId);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteCurriculumFile = async (fileId: string): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.CURRICULUM, 'readwrite');
    const request = store.delete(fileId);
    return new Promise((res, rej) => { request.onsuccess = () => res(); request.onerror = () => rej(request.error); });
};

// --- Test & Submission Functions ---
export const saveTest = async (test: Test): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.TESTS, 'readwrite');
    const request = store.put(test); // Use put to allow creating and updating
    return new Promise((res, rej) => { request.onsuccess = () => res(); request.onerror = () => rej(request.error); });
};

export const deleteTest = async (testId: string): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.TESTS, 'readwrite');
    const request = store.delete(testId);
    return new Promise((res, rej) => { request.onsuccess = () => res(); request.onerror = () => rej(request.error); });
};

export const getTestsForTeacher = async (teacherId: string): Promise<Test[]> => {
    const tests = await getAllFromStore<Test>(STORES.TESTS);
    return tests.filter(t => t.teacherId === teacherId);
};

export const getTestById = async (testId: string): Promise<Test | null> => {
    await initPortalDB();
    const store = getStore(STORES.TESTS, 'readonly');
    const request = store.get(testId);
    return new Promise((res, rej) => {
        request.onsuccess = () => res(request.result || null);
        request.onerror = () => rej(request.error);
    });
};

export const submitTest = async (submission: Omit<TestSubmission, 'id'>): Promise<void> => {
    await initPortalDB();
    const store = getStore(STORES.SUBMISSIONS, 'readwrite');
    const request = store.add(submission);
     return new Promise((res, rej) => { request.onsuccess = () => res(); request.onerror = () => rej(request.error); });
};

export const getSubmissionsForStudent = async (studentId: string): Promise<TestSubmission[]> => {
    await initPortalDB();
    const store = getStore(STORES.SUBMISSIONS, 'readonly');
    const index = store.index('studentId');
    const request = index.getAll(studentId);
    return new Promise((res, rej) => { request.onsuccess = () => res(request.result || []); request.onerror = () => rej(request.error); });
};

export const getSubmissionsForTest = async (testId: string): Promise<TestSubmission[]> => {
    await initPortalDB();
    const store = getStore(STORES.SUBMISSIONS, 'readonly');
    const index = store.index('testId');
    const request = index.getAll(testId);
    return new Promise((res, rej) => { request.onsuccess = () => res(request.result || []); request.onerror = () => rej(request.error); });
};


// --- Demo User Functions ---
export const getDemoUser = async (role: 'teacher' | 'student'): Promise<PortalUser> => {
    await initPortalDB();
    const email = role === 'teacher' ? 'e.reed@university.edu' : 'a.johnson@university.edu';
    
    const store = getStore(STORES.USERS, 'readwrite');
    const users = await getAllFromStore<PortalUser>(STORES.USERS);
    let user = users.find(u => u.email === email);

    if (user) return user;

    const newUser: PortalUser = role === 'teacher' ? {
        id: `demo-teacher-${crypto.randomUUID()}`, name: 'Dr. Evelyn Reed', email, role: 'teacher', approved: true,
    } : {
        id: `demo-student-${crypto.randomUUID()}`, name: 'Alex Johnson', email, role: 'student', approved: true,
        enrollment_id: 'S12345', ug_number: 'UG67890', phone_number: '555-0101',
    };
    
    const addRequest = store.add(newUser);
    return new Promise((resolve, reject) => {
        addRequest.onsuccess = () => resolve(newUser);
        addRequest.onerror = () => reject(addRequest.error);
    });
};


// --- Unit Material Functions ---
export const addUnitMaterial = async (materialInfo: Omit<UnitMaterial, 'createdAt' | 'id'>, fileBlob: Blob): Promise<UnitMaterial> => {
    await initPortalDB();
    const store = getStore(STORES.UNIT_MATERIALS, 'readwrite');
    const materialWithBlob = {
        ...materialInfo,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        blob: fileBlob,
    };
    const request = store.put(materialWithBlob);
    return new Promise((res, rej) => {
        request.onsuccess = () => {
            const { blob, ...info } = materialWithBlob;
            res(info);
        };
        request.onerror = () => rej(request.error);
    });
};

export const getUnitMaterialBlob = async (materialId: string): Promise<Blob | null> => {
    await initPortalDB();
    const store = getStore(STORES.UNIT_MATERIALS, 'readonly');
    const request = store.get(materialId);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error);
    });
};