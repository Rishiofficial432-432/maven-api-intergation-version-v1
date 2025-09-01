

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CheckCircle, Clock, Loader, LogOut, Info, WifiOff, Users, GraduationCap, User as UserIcon, XCircle, Edit, Save, Plus, Trash2, Camera, Mail, Lock, BookOpen, Smartphone, ShieldCheck, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './firebase-config';

// --- TYPES ---
interface User {
    id: number;
    created_at: string;
    name: string;
    email: string | null;
    role: 'teacher' | 'student';
    enrollment_id: string | null;
    phone: string | null;
    password?: string;
}

interface Session {
    id: string; // UUID
    created_at: string;
    expires_at: string;
    teacher_id: number | null;
    is_active: boolean;
}

interface NewUser {
    name: string;
    email: string;
    password?: string;
    role: 'teacher' | 'student';
    enrollment_id: string | null;
}

type ScanStatus = { type: 'success' | 'error' | 'info' | 'idle', message: string | null };


// =================================================================
// MOCK DATA AND CONFIG (for when Supabase is not configured)
// =================================================================
const MOCK_TEACHER: User = { id: 101, created_at: new Date().toISOString(), name: 'Dr. Evelyn Reed', email: 'teacher@example.com', role: 'teacher', enrollment_id: null, phone: '555-0101', password: 'password123' };
const MOCK_STUDENTS: User[] = [
    { id: 201, created_at: new Date().toISOString(), name: 'Alex Johnson', email: 'alex@example.com', role: 'student', enrollment_id: 'S201', phone: '555-0102', password: 'password123' },
    { id: 202, created_at: new Date().toISOString(), name: 'Maria Garcia', email: 'maria@example.com', role: 'student', enrollment_id: 'S202', phone: '555-0103', password: 'password123' },
    { id: 203, created_at: new Date().toISOString(), name: 'Chen Wei', email: 'chen@example.com', role: 'student', enrollment_id: 'S203', phone: '555-0104', password: 'password123' },
];


// =================================================================
// PRESENTATIONAL SUB-COMPONENTS
// =================================================================

const Timer: React.FC<{ endTime: string, onEnd: () => void }> = ({ endTime, onEnd }) => {
    const [timeLeft, setTimeLeft] = useState(Math.max(0, new Date(endTime).getTime() - Date.now()));

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, new Date(endTime).getTime() - Date.now());
            setTimeLeft(remaining);
            if (remaining === 0) {
                clearInterval(interval);
                onEnd();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime, onEnd]);

    const minutes = Math.floor(timeLeft / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0');
    return <span className="font-mono text-2xl">{minutes}:{seconds}</span>;
};


const LoginView: React.FC<{ onLogin: (email: string, pass: string) => Promise<void>, error: string | null, setError: (err: string | null) => void, setViewMode: (mode: 'signup') => void, pendingSessionId: string | null }> = ({ onLogin, error, setError, setViewMode, pendingSessionId }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        await onLogin(email, password);
        setIsSubmitting(false);
    };

    return (
        <div className="flex-1 flex items-center justify-center bg-secondary/30 p-4">
            <div className="w-full max-w-sm bg-card p-8 rounded-xl shadow-lg border border-border">
                <div className="text-center mb-6">
                    <BookOpen size={48} className="mx-auto text-primary mb-2" />
                    <h1 className="text-2xl font-bold">Portal Login</h1>
                    <p className="text-muted-foreground text-sm">Sign in to access your dashboard.</p>
                </div>
                {pendingSessionId && (
                    <div className="bg-blue-500/10 text-blue-300 text-sm p-3 rounded-md mb-4 text-center flex items-center gap-2">
                        <Info size={16} />
                        <span>Please sign in to mark your attendance.</span>
                    </div>
                )}
                {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <div className="relative mt-1">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                    <div>
                         <label className="text-sm font-medium" htmlFor="password">Password</label>
                        <div className="relative mt-1">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader className="animate-spin"/> Signing In...</> : 'Sign In'}
                    </button>
                </form>
                 <p className="text-center text-sm text-muted-foreground mt-6">
                    Don't have an account?{' '}
                    <button onClick={() => setViewMode('signup')} className="font-semibold text-primary hover:underline">
                        Sign Up
                    </button>
                </p>
            </div>
        </div>
    );
};

const SignUpView: React.FC<{ onRegister: (details: NewUser) => Promise<void>, error: string | null, setError: (err: string | null) => void, setViewMode: (mode: 'login') => void }> = ({ onRegister, error, setError, setViewMode }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (role === 'student' && !enrollmentId.trim()) {
            setError("Enrollment ID is required for students.");
            return;
        }
        setError(null);
        setIsSubmitting(true);
        await onRegister({ name, email, password, role, enrollment_id: role === 'student' ? enrollmentId : null });
        setIsSubmitting(false);
    };

    return (
        <div className="flex-1 flex items-center justify-center bg-secondary/30 p-4">
            <div className="w-full max-w-sm bg-card p-8 rounded-xl shadow-lg border border-border">
                <div className="text-center mb-6">
                    <UserIcon size={48} className="mx-auto text-primary mb-2" />
                    <h1 className="text-2xl font-bold">Create Account</h1>
                    <p className="text-muted-foreground text-sm">Join the portal to get started.</p>
                </div>
                {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">{error}</div>}
                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium" htmlFor="name">Full Name</label>
                        <div className="relative mt-1">
                            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium" htmlFor="signup-email">Email</label>
                        <div className="relative mt-1">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium" htmlFor="signup-password">Password</label>
                        <div className="relative mt-1">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium" htmlFor="confirm-password">Confirm Password</label>
                        <div className="relative mt-1">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Role</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-2"><input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} /> Student</label>
                            <label className="flex items-center gap-2"><input type="radio" name="role" value="teacher" checked={role === 'teacher'} onChange={() => setRole('teacher')} /> Teacher</label>
                        </div>
                    </div>
                    {role === 'student' && (
                         <div style={{ transition: 'opacity 0.3s', opacity: 1 }}>
                            <label className="text-sm font-medium" htmlFor="enrollment">Enrollment ID</label>
                            <div className="relative mt-1">
                                <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input id="enrollment" type="text" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} placeholder="e.g., S12345" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                            </div>
                        </div>
                    )}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader className="animate-spin"/> Creating Account...</> : 'Sign Up'}
                    </button>
                </form>
                 <p className="text-center text-sm text-muted-foreground mt-6">
                    Already have an account?{' '}
                    <button onClick={() => setViewMode('login')} className="font-semibold text-primary hover:underline">
                        Sign In
                    </button>
                </p>
            </div>
        </div>
    );
};

interface AuthPortalProps {
    onLogin: (email: string, pass: string) => Promise<void>;
    onRegister: (details: NewUser) => Promise<void>;
    error: string | null;
    setError: (err: string | null) => void;
    pendingSessionId: string | null;
}

const AuthPortal: React.FC<AuthPortalProps> = ({ onLogin, onRegister, error, setError, pendingSessionId }) => {
    const [viewMode, setViewMode] = useState<'login' | 'signup'>('login');

    if (viewMode === 'login') {
        return <LoginView onLogin={onLogin} error={error} setError={setError} setViewMode={setViewMode} pendingSessionId={pendingSessionId} />;
    }
    return <SignUpView onRegister={onRegister} error={error} setError={setError} setViewMode={setViewMode} />;
};


interface TeacherDashboardProps {
    teacher: User;
    onLogout: () => void;
    qrCode: string | null;
    isStartingSession: boolean;
    students: User[];
    presentStudents: Set<number>;
    activeSession: Session | null;
    error: string | null;
    setError: (err: string | null) => void;
    onStartSession: () => Promise<void>;
    onEndSession: (sessionId?: string) => Promise<void>;
    onAddStudent: (name: string, enrollment: string, phone: string) => Promise<void>;
    onSaveEdit: (id: number, name: string, phone: string) => Promise<void>;
    onDeleteStudent: (id: number) => Promise<void>;
    onCheckActiveSession: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
    teacher, onLogout, qrCode, isStartingSession, students, presentStudents, activeSession, error,
    setError, onStartSession, onEndSession, onAddStudent, onSaveEdit, onDeleteStudent, onCheckActiveSession
}) => {
    const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingPhone, setEditingPhone] = useState('');
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnrollment, setNewStudentEnrollment] = useState('');
    const [newStudentPhone, setNewStudentPhone] = useState('');

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        await onAddStudent(newStudentName, newStudentEnrollment, newStudentPhone);
        setNewStudentName('');
        setNewStudentEnrollment('');
        setNewStudentPhone('');
    };

    const handleSaveEdit = (studentId: number) => {
        onSaveEdit(studentId, editingName, editingPhone);
        setEditingStudentId(null);
    };

    return (
      <div className="flex flex-col md:flex-row h-full bg-secondary/30">
        <aside className="w-full md:w-80 lg:w-96 bg-card p-4 md:p-6 flex flex-col border-b md:border-b-0 md:border-r border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><UserIcon size={20}/></div>
                <div>
                    <h2 className="font-bold text-lg">{teacher.name}</h2>
                    <p className="text-xs text-muted-foreground">Teacher Dashboard</p>
                </div>
            </div>
            <button onClick={onLogout} className="p-2 rounded-md hover:bg-accent text-muted-foreground"><LogOut size={18}/></button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-secondary/50 rounded-lg">
            {activeSession && qrCode ? (
                <>
                    <h3 className="font-semibold mb-2">Session is Live</h3>
                    <img src={qrCode} alt="Attendance QR Code" className="rounded-lg border-4 border-white shadow-lg w-full max-w-[250px]"/>
                    <div className="mt-4 flex items-center gap-3 bg-card px-4 py-2 rounded-full">
                        <Clock size={20} className="text-primary"/>
                        <Timer endTime={activeSession.expires_at} onEnd={onCheckActiveSession} />
                    </div>
                    <button onClick={() => onEndSession()} className="mt-4 w-full bg-destructive text-destructive-foreground py-2 rounded-lg hover:bg-destructive/90 transition-colors">End Session</button>
                </>
            ) : (
                <>
                    <Users size={48} className="text-muted-foreground mb-4"/>
                    <p className="text-muted-foreground mb-4">Start a new 10-minute session to take attendance.</p>
                    <button onClick={onStartSession} disabled={isStartingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {isStartingSession ? <><Loader className="animate-spin"/> Starting...</> : 'Start New Session'}
                    </button>
                </>
            )}
            </div>
        </aside>
        <main className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                <h2 className="text-xl font-bold">Student Roster ({students.length})</h2>
            </div>
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4 flex items-center justify-between"><span>{error}</span><button onClick={() => setError(null)}><X size={16}/></button></div>}
            
            <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row flex-wrap gap-4 items-end mb-4 p-4 bg-secondary/50 rounded-lg">
                <div className="w-full sm:flex-1"><label className="text-xs text-muted-foreground">Name</label><input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Full Name" required className="w-full bg-input border-border rounded-md px-3 py-2 mt-1"/></div>
                <div className="w-full sm:flex-1"><label className="text-xs text-muted-foreground">Enrollment ID</label><input type="text" value={newStudentEnrollment} onChange={e => setNewStudentEnrollment(e.target.value)} placeholder="Enrollment ID" required className="w-full bg-input border-border rounded-md px-3 py-2 mt-1"/></div>
                <div className="w-full sm:flex-1"><label className="text-xs text-muted-foreground">Phone (Optional)</label><input type="tel" value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-input border-border rounded-md px-3 py-2 mt-1"/></div>
                <button type="submit" className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center gap-2"><Plus size={16}/> Add</button>
            </form>

            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {students.map(s => (
                        <div key={s.id} className={`p-4 rounded-lg border transition-all ${presentStudents.has(s.id) ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border'}`}>
                            {editingStudentId === s.id ? (
                                <div className="space-y-2">
                                    <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)} className="w-full bg-input border-border rounded-md px-2 py-1"/>
                                    <input type="tel" value={editingPhone} onChange={e => setEditingPhone(e.target.value)} className="w-full bg-input border-border rounded-md px-2 py-1"/>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSaveEdit(s.id)} className="p-2 bg-primary text-primary-foreground rounded-md"><Save size={16}/></button>
                                        <button onClick={() => setEditingStudentId(null)} className="p-2 bg-secondary rounded-md"><X size={16}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {presentStudents.has(s.id) ? <CheckCircle size={16} className="text-green-500"/> : <Clock size={16} className="text-muted-foreground"/>}
                                            <p className="font-semibold">{s.name}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{s.enrollment_id}</p>
                                        <p className="text-sm text-muted-foreground">{s.phone}</p>
                                    </div>
                                    <div className="flex self-end sm:self-auto items-center gap-2 flex-shrink-0">
                                        <button onClick={() => { setEditingStudentId(s.id); setEditingName(s.name); setEditingPhone(s.phone || ''); }} className="p-2 text-muted-foreground hover:text-primary"><Edit size={16}/></button>
                                        <button onClick={() => onDeleteStudent(s.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </main>
      </div>
    );
};

interface StudentDashboardProps {
    student: User;
    onLogout: () => void;
    onProcessSessionId: (sessionId: string) => Promise<void>;
    scanStatus: ScanStatus;
    setScanStatus: (status: ScanStatus) => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, onLogout, onProcessSessionId, scanStatus, setScanStatus }) => {
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = "qr-reader";

    const processScan = useCallback(async (decodedText: string) => {
        let sessionId: string | null = null;
        try {
            const url = new URL(decodedText);
            sessionId = url.searchParams.get('session');
        } catch (e) { /* Not a URL, ignore */ }
        
        if (sessionId) {
            try {
                await onProcessSessionId(sessionId);
            } catch (e: any) {
                // This catch is a fallback; primary status is set by parent
                setScanStatus({ type: 'error', message: e.message || "An unknown error occurred." });
            }
        } else {
            setScanStatus({ type: 'error', message: "Invalid QR code. Please scan a valid code." });
        }
    }, [onProcessSessionId, setScanStatus]);

     const startScan = useCallback(async () => {
        setScanStatus({ type: 'idle', message: null });
        setIsScanning(true);

        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length) {
                const qrScanner = new Html5Qrcode(scannerContainerId);
                scannerRef.current = qrScanner;

                await qrScanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        qrScanner.stop();
                        setIsScanning(false);
                        processScan(decodedText);
                    },
                    () => {}
                ).catch(() => {
                    setScanStatus({ type: 'error', message: "Could not start scanner. Please grant camera permissions."});
                    setIsScanning(false);
                });
            } else {
                setScanStatus({ type: 'error', message: "No camera found on this device."});
                setIsScanning(false);
            }
        } catch (err) {
            setScanStatus({ type: 'error', message: "Failed to initialize camera. Please ensure you have a camera and have granted permissions."});
            setIsScanning(false);
        }
    }, [setScanStatus, processScan]);

    useEffect(() => {
        return () => {
            if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
                scannerRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
            }
        };
    }, []);
    
    return (
        <div className="flex-1 flex flex-col h-full bg-secondary/30 p-4">
             <header className="flex items-center justify-between mb-4 bg-card p-3 rounded-lg flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><GraduationCap size={20}/></div>
                    <div>
                        <h2 className="font-bold text-lg">{student.name}</h2>
                        <p className="text-xs text-muted-foreground">{student.enrollment_id}</p>
                    </div>
                </div>
                <button onClick={onLogout} className="p-2 rounded-md hover:bg-accent text-muted-foreground"><LogOut size={18}/></button>
            </header>
            <main className="flex-1 flex items-center justify-center">
                 <div className="w-full max-w-md bg-card p-6 rounded-xl shadow-lg border border-border text-center">
                    {scanStatus.type === 'idle' && !isScanning && (
                        <>
                            <Smartphone size={48} className="mx-auto text-primary mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Mark Your Attendance</h2>
                            <p className="text-muted-foreground mb-6">Click the button below to scan the QR code provided by your teacher.</p>
                            <button onClick={startScan} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                                <Camera size={20}/> Scan QR Code
                            </button>
                        </>
                    )}
                    {isScanning && (
                        <>
                            <p className="text-muted-foreground mb-4">Point your camera at the QR code.</p>
                            <div id={scannerContainerId} className="w-full aspect-square rounded-lg overflow-hidden border-2 border-primary bg-black"></div>
                        </>
                    )}
                    {scanStatus.type === 'success' && (
                        <div className="flex flex-col items-center">
                            <CheckCircle size={64} className="text-green-500 mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Success!</h2>
                            <p className="text-muted-foreground mb-6">{scanStatus.message}</p>
                             <button onClick={() => setScanStatus({ type: 'idle', message: null })} className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg hover:bg-secondary/80">Done</button>
                        </div>
                    )}
                    {scanStatus.type === 'error' && (
                         <div className="flex flex-col items-center">
                            <XCircle size={64} className="text-destructive mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Error</h2>
                            <p className="text-muted-foreground mb-6">{scanStatus.message}</p>
                            <button onClick={() => setScanStatus({ type: 'idle', message: null })} className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg hover:bg-secondary/80">Try Again</button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};


// =================================================================
// LOGIC CONTAINERS
// =================================================================

const SupabasePortal: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<ScanStatus>({ type: 'idle', message: null });

    // Teacher state
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [students, setStudents] = useState<User[]>([]);
    const [presentStudents, setPresentStudents] = useState<Set<number>>(new Set());
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    
    // --- COMMON LOGIC ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session');
        if (sessionId) {
            setPendingSessionId(sessionId);
            const url = new URL(window.location.href);
            url.searchParams.delete('session');
            window.history.replaceState({}, document.title, url.toString());
        }
    }, []);

    const processStudentScan = useCallback(async (sessionId: string, studentUser: User) => {
        setScanStatus({ type: 'info', message: 'Verifying session...' });
        if (!supabase) {
            setScanStatus({ type: 'error', message: 'Portal is not connected.' });
            return;
        }

        const { data: session, error: sessionError } = await supabase.from('portal_sessions').select('created_at, expires_at, is_active').eq('id', sessionId).single();
        
        if (sessionError || !session) {
            setScanStatus({ type: 'error', message: "Session not found. It might be invalid." });
            return;
        }
        if (!session.is_active || new Date(session.expires_at).getTime() < Date.now()) {
            setScanStatus({ type: 'error', message: "This attendance session has expired or is no longer active." });
            return;
        }

        const { error: insertError } = await supabase.from('portal_attendance').upsert({ student_id: studentUser.id, session_id: sessionId });
        
        if (insertError) {
             if (insertError.code === '23505') { // Unique constraint violation
                setScanStatus({ type: 'success', message: "You have already been marked present for this session!" });
             } else {
                setScanStatus({ type: 'error', message: `Failed to mark attendance: ${insertError.message}` });
             }
        } else {
             setScanStatus({ type: 'success', message: 'Attendance marked successfully!' });
        }
    }, []);

    const handleLogin = async (email: string, pass: string) => {
        if (!supabase) return;
        const { data, error: dbError } = await supabase.from('portal_users').select('*').eq('email', email.toLowerCase().trim()).single();
        if (dbError || !data || data.password !== pass) {
            setError("Invalid credentials or user not found.");
            return;
        }
        const loggedInUser = data as User;
        setUser(loggedInUser);
        sessionStorage.setItem('portalUser', JSON.stringify(loggedInUser));

        if (loggedInUser.role === 'student' && pendingSessionId) {
            await processStudentScan(pendingSessionId, loggedInUser);
            setPendingSessionId(null);
        }
    };

    const handleRegister = async (details: NewUser) => {
        if (!supabase) return;
        const { data, error: dbError } = await supabase.from('portal_users').insert({
            name: details.name,
            email: details.email.toLowerCase().trim(),
            password: details.password,
            role: details.role,
            enrollment_id: details.role === 'student' ? details.enrollment_id : null,
        }).select().single();

        if (dbError) {
            if (dbError.code === '23505') {
                 setError('An account with this email or enrollment ID already exists.');
            } else {
                setError(`Registration failed: ${dbError.message}`);
            }
            return;
        }
        if (data) {
            const newUser = data as User;
            setUser(newUser);
            sessionStorage.setItem('portalUser', JSON.stringify(newUser));
             if (newUser.role === 'student' && pendingSessionId) {
                await processStudentScan(pendingSessionId, newUser);
                setPendingSessionId(null);
            }
        }
    };

    const handleLogout = () => {
        setUser(null);
        setScanStatus({ type: 'idle', message: null });
        sessionStorage.removeItem('portalUser');
    };
    
    useEffect(() => {
        try {
            const storedUser = sessionStorage.getItem('portalUser');
            if (storedUser) setUser(JSON.parse(storedUser));
        } catch (e) { console.error(e); }
        setIsLoading(false);
    }, []);
    
    // --- TEACHER LOGIC ---
    const loadStudents = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_users').select('*').eq('role', 'student').order('name');
        if (error) console.error("Error fetching students:", error);
        else setStudents((data as User[]) || []);
    }, []);

    const endSession = useCallback(async (sessionId?: string) => {
        if (!supabase) return;
        const id = sessionId || activeSession?.id;
        if (!id) return;
        await supabase.from('portal_sessions').update({ is_active: false }).eq('id', id);
        if (activeSession?.id === id) {
            setActiveSession(null);
            setQrCode(null);
        }
    }, [activeSession]);

    const checkActiveSession = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_sessions').select('*').eq('is_active', true).single();
        if (error && error.code !== 'PGRST116') return; // Ignore 'not found'
        if (data && new Date(data.expires_at).getTime() > Date.now()) {
            setActiveSession(data as Session);
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'portal');
            url.searchParams.set('session', data.id);
            QRCode.toDataURL(url.toString(), { width: 300, margin: 1 }).then(setQrCode);
        } else if (data) {
            endSession(data.id);
        }
    }, [endSession]);

    useEffect(() => {
        if (user?.role === 'teacher') {
            loadStudents();
            checkActiveSession();
        }
    }, [user, loadStudents, checkActiveSession]);
    
    useEffect(() => {
        if (!activeSession || !supabase) return;
        const fetchInitialAttendance = async () => {
            const { data, error } = await supabase.from('portal_attendance').select('student_id').eq('session_id', activeSession.id);
            if (!error) setPresentStudents(new Set(data.map(d => d.student_id)));
        };
        fetchInitialAttendance();
        const channel = supabase.channel(`attendance-${activeSession.id}`);
        const subscription = channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_attendance', filter: `session_id=eq.${activeSession.id}`}, 
            (payload) => setPresentStudents(prev => new Set(prev).add((payload.new as any).student_id)))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activeSession]);

    const startSession = async () => {
        if (!supabase || !user) return;
        setIsStartingSession(true);
        await supabase.from('portal_sessions').update({ is_active: false }).eq('is_active', true);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const { data, error } = await supabase.from('portal_sessions').insert({ expires_at: expiresAt.toISOString(), teacher_id: user.id }).select().single();
        if (error || !data) { setError(`Failed to start session: ${error?.message}`); setIsStartingSession(false); return; }
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'portal');
        url.searchParams.set('session', data.id);
        setQrCode(await QRCode.toDataURL(url.toString(), { width: 300, margin: 1 }));
        setActiveSession(data as Session);
        setPresentStudents(new Set());
        setIsStartingSession(false);
    };
    
    const handleAddStudent = async (name: string, enrollment_id: string, phone: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('portal_users').insert({ name, enrollment_id, phone: phone || null, role: 'student', password: 'password123' });
        if (error) setError(`Failed to add student: ${error.message}`);
        else loadStudents();
    };
    const handleSaveEdit = async (id: number, name: string, phone: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('portal_users').update({ name, phone: phone || null }).eq('id', id);
        if (error) setError(`Failed to update student: ${error.message}`);
        else loadStudents();
    };
    const handleDeleteStudent = async (id: number) => {
        if (!supabase || !window.confirm("Are you sure? This will delete the student and all their attendance records.")) return;
        const { error } = await supabase.from('portal_users').delete().eq('id', id);
        if (error) setError(`Failed to delete student: ${error.message}`);
        else loadStudents();
    };
    
    // --- RENDER LOGIC ---
    if (isLoading) return <div className="flex-1 flex items-center justify-center bg-secondary/30"><Loader className="animate-spin text-primary" size={48}/></div>;
    if (!user) return <AuthPortal onLogin={handleLogin} onRegister={handleRegister} error={error} setError={setError} pendingSessionId={pendingSessionId} />;
    if (user.role === 'teacher') return <TeacherDashboard 
        teacher={user} onLogout={handleLogout} qrCode={qrCode} isStartingSession={isStartingSession} students={students} presentStudents={presentStudents} 
        activeSession={activeSession} error={error} setError={setError} onStartSession={startSession} onEndSession={endSession} onAddStudent={handleAddStudent}
        onSaveEdit={handleSaveEdit} onDeleteStudent={handleDeleteStudent} onCheckActiveSession={checkActiveSession} />;
    
    return <StudentDashboard student={user} onLogout={handleLogout} onProcessSessionId={(sessionId) => processStudentScan(sessionId, user)} scanStatus={scanStatus} setScanStatus={setScanStatus} />;
};


const MockPortal: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<ScanStatus>({ type: 'idle', message: null });
    
    const [mockUsers, setMockUsers] = useState([MOCK_TEACHER, ...MOCK_STUDENTS]);
    const [students, setStudents] = useState<User[]>(MOCK_STUDENTS);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [presentStudents, setPresentStudents] = useState<Set<number>>(new Set());
    const [qrCode, setQrCode] = useState<string | null>(null);

     const processStudentScan = useCallback(async (sessionId: string, studentUser: User) => {
        setScanStatus({ type: 'info', message: 'Verifying session...' });
        await new Promise(res => setTimeout(res, 500)); // Simulate network delay

        if (!activeSession || sessionId !== activeSession.id) {
            setScanStatus({ type: 'error', message: "Session not found or has expired." });
            return;
        }
        if (!activeSession.is_active || new Date(activeSession.expires_at).getTime() < Date.now()) {
            setScanStatus({ type: 'error', message: "This attendance session is no longer active." });
            return;
        }
        if (presentStudents.has(studentUser.id)) {
            setScanStatus({ type: 'success', message: "You have already been marked present!" });
            return;
        }
        setPresentStudents(prev => new Set(prev).add(studentUser.id));
        setScanStatus({ type: 'success', message: 'Attendance marked successfully!' });
    }, [activeSession, presentStudents]);


    const handleLogin = async (email: string, pass: string) => {
        const foundUser = mockUsers.find(u => u.email?.toLowerCase() === email.toLowerCase().trim() && u.password === pass);
        if (foundUser) {
            setUser(foundUser);
            sessionStorage.setItem('portalUserMock', JSON.stringify(foundUser));
            if (foundUser.role === 'student' && pendingSessionId) {
                await processStudentScan(pendingSessionId, foundUser);
                setPendingSessionId(null);
            }
        } else {
            setError("Invalid credentials. Try 'teacher@example.com' or a student email with password 'password123'.");
        }
    };

    const handleRegister = async (details: NewUser) => {
        if (mockUsers.some(u => u.email?.toLowerCase() === details.email.toLowerCase().trim())) {
            setError('An account with this email already exists.');
            return;
        }
        if (details.role === 'student' && mockUsers.some(u => u.enrollment_id === details.enrollment_id)) {
            setError('An account with this enrollment ID already exists.');
            return;
        }

        const newUser: User = {
            id: Date.now(),
            created_at: new Date().toISOString(),
            name: details.name,
            email: details.email.toLowerCase().trim(),
            password: details.password,
            role: details.role,
            enrollment_id: details.role === 'student' ? details.enrollment_id : null,
            phone: null,
        };

        setMockUsers(prev => [...prev, newUser]);
        
        if (newUser.role === 'student') {
            setStudents(prev => [...prev, newUser]);
        }
        
        setUser(newUser);
        sessionStorage.setItem('portalUserMock', JSON.stringify(newUser));

        if (newUser.role === 'student' && pendingSessionId) {
            await processStudentScan(pendingSessionId, newUser);
            setPendingSessionId(null);
        }
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('session')) {
            setPendingSessionId(urlParams.get('session'));
            const url = new URL(window.location.href);
            url.searchParams.delete('session');
            window.history.replaceState({}, document.title, url.toString());
        }
        try {
            const storedUser = sessionStorage.getItem('portalUserMock');
            if (storedUser) setUser(JSON.parse(storedUser));
        } catch(e) {}
        setIsLoading(false);
    }, []);

    const handleLogout = () => {
        setUser(null);
        sessionStorage.removeItem('portalUserMock');
    };

    const startSession = async () => {
        const session: Session = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            teacher_id: MOCK_TEACHER.id,
            is_active: true,
        };
        setActiveSession(session);
        setPresentStudents(new Set());
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'portal');
        url.searchParams.set('session', session.id);
        setQrCode(await QRCode.toDataURL(url.toString(), { width: 300, margin: 1 }));
    };

    const endSession = async () => {
        setActiveSession(null);
        setQrCode(null);
    };

    const handleAddStudent = async (name: string, enrollment_id: string, phone: string) => {
        const newUser: User = { id: Date.now(), created_at: new Date().toISOString(), name, enrollment_id, phone, role: 'student', email: `${name.split(' ')[0].toLowerCase()}@example.com`, password: 'password123' };
        setStudents(prev => [...prev, newUser]);
        setMockUsers(prev => [...prev, newUser]);
    };
    
    const handleSaveEdit = async (id: number, name: string, phone: string) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, name, phone } : s));
    };

    const handleDeleteStudent = async (id: number) => {
        if (window.confirm("Are you sure?")) setStudents(prev => prev.filter(s => s.id !== id));
    };

    if (isLoading) return <div className="flex-1 flex items-center justify-center bg-secondary/30"><Loader className="animate-spin text-primary" size={48}/></div>;
    if (!user) return <AuthPortal onLogin={handleLogin} onRegister={handleRegister} error={error} setError={setError} pendingSessionId={pendingSessionId} />;
    
    if (user.role === 'teacher') {
        return <TeacherDashboard 
            teacher={user} 
            onLogout={handleLogout}
            qrCode={qrCode}
            isStartingSession={false}
            students={students}
            presentStudents={presentStudents}
            activeSession={activeSession}
            error={error}
            setError={setError}
            onStartSession={startSession}
            onEndSession={endSession}
            onAddStudent={handleAddStudent}
            onSaveEdit={handleSaveEdit}
            onDeleteStudent={handleDeleteStudent}
            onCheckActiveSession={() => { if(activeSession && new Date(activeSession.expires_at).getTime() < Date.now()) endSession(); }}
        />;
    }

    return <StudentDashboard student={user} onLogout={handleLogout} onProcessSessionId={(sessionId) => processStudentScan(sessionId, user)} scanStatus={scanStatus} setScanStatus={setScanStatus} />;
};

// =================================================================
// MAIN EXPORTED COMPONENT
// =================================================================

const StudentTeacherPortal: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isSupabaseConfigured) {
        return <MockPortal />;
    }
    
    if (!supabase) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-secondary/30 text-center">
                 <div className="p-8 bg-card rounded-lg shadow-lg max-w-md">
                    <ShieldCheck size={48} className="mx-auto text-destructive mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Portal Offline</h1>
                    <p className="text-muted-foreground">The real-time Student & Teacher Portal is currently offline due to a configuration error. Please check the setup instructions.</p>
                </div>
            </div>
        );
    }
    
    if (!isOnline) {
         return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-secondary/30 text-center">
                <div className="p-8 bg-card rounded-lg shadow-lg max-w-md">
                    <WifiOff size={48} className="mx-auto text-destructive mb-4" />
                    <h1 className="text-2xl font-bold mb-2">You are Offline</h1>
                    <p className="text-muted-foreground">Please check your internet connection to use the portal.</p>
                </div>
            </div>
        );
    }

    return <SupabasePortal />;
};

export default StudentTeacherPortal;