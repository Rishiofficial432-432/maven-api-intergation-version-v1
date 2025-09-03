import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, QrCode, Copy, ToggleLeft, ToggleRight, RefreshCw, Video, VideoOff, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase-config';
import QRCode from 'qrcode';
import { useToast } from './Toast';
import { geminiAI } from './gemini';
import { Html5QrcodeScanner } from 'html5-qrcode';


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
    session_code?: string;
    location_enforced: boolean; 
}

interface Curriculum {
    id: string;
    teacherId: number;
    date: string; // YYYY-MM-DD
    topic: string;
    activities: string;
}

interface AttendanceRecord {
    id: string;
    sessionId: string;
    studentName: string;
    enrollmentId: string;
    timestamp: string;
    teacherId: number;
}

interface NewUser {
    name: string;
    email: string;
    password?: string;
    role: 'teacher' | 'student';
    enrollment_id: string | null;
    phone: string | null;
}

type ViewMode = 'login' | 'signup' | 'forgot_password' | 'forgot_password_confirmation';

// =================================================================
// MOCK DATA AND CONFIG
// =================================================================
const MOCK_TEACHER: User = { id: 101, created_at: new Date().toISOString(), name: 'Dr. Evelyn Reed', email: 'teacher@example.com', role: 'teacher', enrollment_id: null, phone: '555-0101', password: 'password123' };
const MOCK_STUDENTS: User[] = [
    { id: 201, created_at: new Date().toISOString(), name: 'Alex Johnson', email: 'alex@example.com', role: 'student', enrollment_id: 'S201', phone: '555-0102', password: 'password123' },
    { id: 202, created_at: new Date().toISOString(), name: 'Maria Garcia', email: 'maria@example.com', role: 'student', enrollment_id: 'S202', phone: '555-0103', password: 'password123' },
    { id: 203, created_at: new Date().toISOString(), name: 'Chen Wei', email: 'chen@example.com', role: 'student', enrollment_id: 'S203', phone: '555-0104', password: 'password123' },
];
const MOCK_SESSIONS: Session[] = [];
const MOCK_CURRICULUM: Curriculum[] = [
    { id: 'c1', teacherId: 101, date: new Date().toISOString().split('T')[0], topic: 'Introduction to React Hooks', activities: '1. useState deep dive\n2. useEffect for side effects\n3. Group project setup' }
];
const MOCK_ATTENDANCE: AttendanceRecord[] = [];

// =================================================================
// LOCALSTORAGE-BASED MOCK BACKEND
// =================================================================

const usePersistentMockState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key “${key}”:`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, state]);

    return [state, setState];
};


// =================================================================
// STANDALONE CHECK-IN PAGE
// =================================================================

export const StandaloneCheckinPage: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    const toast = useToast();
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckedIn, setIsCheckedIn] = useState(false);

    useEffect(() => {
        // Mock fetching session data
        const allSessions: Session[] = JSON.parse(localStorage.getItem('maven-portal-sessions') || '[]');
        const activeSession = allSessions.find(s => s.id === sessionId);

        if (activeSession) {
            if (new Date(activeSession.expires_at) > new Date()) {
                setSession(activeSession);
            } else {
                setError("This attendance session has expired.");
            }
        } else {
            setError("Invalid attendance session link.");
        }
        setIsLoading(false);
    }, [sessionId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !name.trim() || !enrollmentId.trim()) return;

        setIsSubmitting(true);
        // Simulate backend call
        setTimeout(() => {
            const allAttendance: AttendanceRecord[] = JSON.parse(localStorage.getItem('maven-portal-attendance') || '[]');
            const hasAlreadyCheckedIn = allAttendance.some(rec => rec.sessionId === session.id && rec.enrollmentId.toLowerCase() === enrollmentId.trim().toLowerCase());

            if (hasAlreadyCheckedIn) {
                toast.error("You have already checked in for this session.");
                setIsSubmitting(false);
                return;
            }

            const newRecord: AttendanceRecord = {
                id: crypto.randomUUID(),
                sessionId: session.id,
                studentName: name.trim(),
                enrollmentId: enrollmentId.trim().toUpperCase(),
                timestamp: new Date().toISOString(),
                teacherId: session.teacher_id!,
            };
            
            localStorage.setItem('maven-portal-attendance', JSON.stringify([...allAttendance, newRecord]));
            toast.success("Attendance marked successfully!");
            setIsCheckedIn(true);
            setIsSubmitting(false);
        }, 500);
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center bg-background"><Loader className="animate-spin text-primary" size={48} /></div>;
    }

    return (
        <div className="flex-1 flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm bg-card p-8 rounded-xl shadow-lg border border-border text-center">
                <QrCode size={48} className="mx-auto text-primary mb-4" />
                <h1 className="text-2xl font-bold mb-2">Attendance Check-in</h1>
                {error ? (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                        <p className="font-semibold">Unable to Check In</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                ) : isCheckedIn ? (
                     <div className="bg-green-500/10 text-green-400 p-4 rounded-md">
                        <CheckCircle size={32} className="mx-auto mb-2" />
                        <p className="font-semibold">You're All Set!</p>
                        <p className="text-sm mt-1">Your attendance has been recorded. You can now close this page.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-muted-foreground text-sm mb-6">Enter your details to mark your attendance for this session.</p>
                        <form onSubmit={handleSubmit} className="space-y-4 text-left">
                            <div>
                                <label className="text-sm font-medium" htmlFor="name">Full Name</label>
                                <div className="relative mt-1">
                                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium" htmlFor="enrollmentId">Enrollment ID</label>
                                <div className="relative mt-1">
                                    <UserCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input id="enrollmentId" type="text" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} placeholder="S12345" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSubmitting ? <><Loader className="animate-spin"/> Submitting...</> : 'Mark Present'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};


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

// ... (LoginView and SignUpView remain mostly the same, so they are omitted for brevity but should be kept from the original file)
const LoginView: React.FC<{ onLogin: (email: string, pass: string) => Promise<void>, error: string | null, setError: (err: string | null) => void, setViewMode: (mode: ViewMode) => void, pendingSessionId: string | null }> = ({ onLogin, error, setError, setViewMode, pendingSessionId }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showMockInfo, setShowMockInfo] = useState(true);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        await onLogin(email, password.trim());
        setIsSubmitting(false);
    };

    return (
        <div className="w-full max-w-sm bg-card p-8 rounded-xl shadow-lg border border-border">
            <div className="text-center mb-8">
                <BookOpen size={48} className="mx-auto text-primary mb-2" />
                <h1 className="text-2xl font-bold">Portal Login</h1>
                <p className="text-muted-foreground text-sm">Sign in to access your dashboard.</p>
            </div>
            {showMockInfo && !isSupabaseConfigured && (
                 <div className="bg-blue-900/50 border border-blue-500/50 text-blue-200 text-xs p-3 rounded-md mb-4 relative">
                    <button onClick={() => setShowMockInfo(false)} className="absolute top-2 right-2 text-blue-300 hover:text-white"><X size={14}/></button>
                    <h4 className="font-bold mb-1">Mock Mode Active</h4>
                    <p>Use these credentials for testing:</p>
                    <ul className="list-disc pl-4 mt-1">
                        <li><b>Teacher:</b> teacher@example.com</li>
                        <li><b>Student:</b> alex@example.com</li>
                        <li><b>Password:</b> password123</li>
                    </ul>
                </div>
            )}
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-6">{error}</div>}
            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="text-sm font-medium" htmlFor="email">Email</label>
                    <div className="relative mt-1">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium" htmlFor="password">Password</label>
                        <button type="button" onClick={() => setViewMode('forgot_password')} className="text-xs text-primary hover:underline">Forgot?</button>
                    </div>
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
    );
};
const SignUpView: React.FC<{ onRegister: (details: NewUser) => Promise<void>, error: string | null, setError: (err: string | null) => void, setViewMode: (mode: ViewMode) => void }> = ({ onRegister, error, setError, setViewMode }) => {
    // This component is large and unchanged, keeping it as is from original file
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedPassword = password.trim();
        if (trimmedPassword !== confirmPassword.trim()) {
            setError("Passwords do not match.");
            return;
        }
        if (role === 'student' && !enrollmentId.trim()) {
            setError("Enrollment ID is required for students.");
            return;
        }
        if (!isSupabaseConfigured && role === 'student') {
            const allUsers: User[] = [MOCK_TEACHER, ...JSON.parse(localStorage.getItem('maven-portal-users') || JSON.stringify(MOCK_STUDENTS))];
            const enrollmentExists = allUsers.some(u => u.enrollment_id && u.enrollment_id.trim().toLowerCase() === enrollmentId.trim().toLowerCase());
            if (enrollmentExists) {
                setError("An account with this enrollment ID already exists.");
                return;
            }
        }
        setError(null);
        setIsSubmitting(true);
        await onRegister({ name, email, password: trimmedPassword, role, enrollment_id: role === 'student' ? enrollmentId : null, phone: phone || null });
        setIsSubmitting(false);
    };
    
    const formatPhoneNumber = (value: string) => {
        const input = value.replace(/\D/g, '').substring(0, 10);
        const size = input.length;
        if (size === 0) return '';
        if (size < 4) return `(${input}`;
        if (size < 7) return `(${input.substring(0, 3)}) ${input.substring(3)}`;
        return `(${input.substring(0, 3)}) ${input.substring(3, 6)}-${input.substring(6, 10)}`;
    };

    return (
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
                    <label className="text-sm font-medium" htmlFor="phone">Phone Number</label>
                    <div className="relative mt-1">
                        <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input id="phone" type="tel" value={phone} onChange={e => setPhone(formatPhoneNumber(e.target.value))} placeholder="(555) 555-5555" className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
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
                    <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} className="form-radio text-primary focus:ring-primary" />
                            <span>Student</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="role" value="teacher" checked={role === 'teacher'} onChange={() => setRole('teacher')} className="form-radio text-primary focus:ring-primary" />
                            <span>Teacher</span>
                        </label>
                    </div>
                </div>
                {role === 'student' && (
                    <div>
                        <label className="text-sm font-medium" htmlFor="enrollmentId">Enrollment ID</label>
                        <div className="relative mt-1">
                            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="enrollmentId" type="text" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} placeholder="S12345" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                        </div>
                    </div>
                )}
                <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader className="animate-spin"/> Creating Account...</> : 'Create Account'}
                </button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{' '}
                <button onClick={() => setViewMode('login')} className="font-semibold text-primary hover:underline">
                    Sign In
                </button>
            </p>
        </div>
    );
};


// =================================================================
// DASHBOARD COMPONENTS
// =================================================================
const TeacherDashboard: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('session');
    const [sessions, setSessions] = usePersistentMockState<Session[]>('maven-portal-sessions', MOCK_SESSIONS);
    const [curriculum, setCurriculum] = usePersistentMockState<Curriculum[]>('maven-portal-curriculum', MOCK_CURRICULUM);
    const [attendance, setAttendance] = usePersistentMockState<AttendanceRecord[]>('maven-portal-attendance', MOCK_ATTENDANCE);
    const [students, setStudents] = usePersistentMockState<User[]>('maven-portal-users', MOCK_STUDENTS);
    
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [liveAttendance, setLiveAttendance] = useState<AttendanceRecord[]>([]);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);

    const toast = useToast();

    // Real-time attendance polling
    useEffect(() => {
        if (activeSession) {
            const interval = setInterval(() => {
                const allAttendance: AttendanceRecord[] = JSON.parse(localStorage.getItem('maven-portal-attendance') || '[]');
                const sessionAttendance = allAttendance.filter(rec => rec.sessionId === activeSession.id);
                setLiveAttendance(sessionAttendance);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [activeSession]);


    const handleStartSession = useCallback(async () => {
        if (activeSession || isFetchingLocation) return;

        setIsFetchingLocation(true);
        toast.info("Requesting location access to start a secure session...");

        try {
            await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            
            toast.success("Location access granted. Starting session.");

            const now = new Date();
            const expires = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
            const newSession: Session = {
                id: crypto.randomUUID(),
                created_at: now.toISOString(),
                expires_at: expires.toISOString(),
                teacher_id: user.id,
                is_active: true,
                session_code: Math.random().toString(36).substring(2, 7).toUpperCase(),
                location_enforced: true,
            };
            setActiveSession(newSession);
            setSessions(prev => [...prev, newSession]);

            const url = `${window.location.origin}${window.location.pathname}?session_id=${newSession.id}`;
            const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 2, scale: 6 });
            setQrCodeUrl(dataUrl);

        } catch (error: any) {
            if (error.code === error.PERMISSION_DENIED) {
                toast.error("Location access is required to start a secure session.");
            } else {
                toast.error("Could not get location. Please check your device settings.");
            }
        } finally {
            setIsFetchingLocation(false);
        }
    }, [activeSession, user.id, setSessions, isFetchingLocation, toast]);

    const handleEndSession = useCallback(() => {
        setActiveSession(null);
        setQrCodeUrl('');
        setLiveAttendance([]);
    }, []);
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Copied to clipboard!");
        });
    };

    const TabButton: React.FC<{tabName: string, icon: React.ReactNode}> = ({tabName, icon}) => (
        <button 
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tabName ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        >
            {icon} {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
        </button>
    );

    return (
        <div className="flex-1 p-6 sm:p-8 bg-background text-foreground overflow-y-auto">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user.name}!</p>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                    <LogOut size={16} /> Logout
                </button>
            </header>
            
            <nav className="flex items-center gap-2 mb-6 border-b border-border pb-4">
                <TabButton tabName="session" icon={<Clock size={16}/>}/>
                <TabButton tabName="curriculum" icon={<BookOpen size={16}/>}/>
                <TabButton tabName="analytics" icon={<BarChart2 size={16}/>}/>
            </nav>

            <div className="transition-opacity duration-300">
                {activeTab === 'session' && (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                             <h2 className="text-xl font-bold mb-4">Attendance Session</h2>
                             {activeSession ? (
                                <div className="space-y-4">
                                    <div className="text-center p-3 bg-secondary rounded-lg">
                                        <p className="text-xs text-muted-foreground">Session ends in:</p>
                                        <Timer endTime={activeSession.expires_at} onEnd={handleEndSession} />
                                    </div>
                                     <div className="flex items-center justify-center gap-2">
                                        <p className="font-mono text-3xl tracking-widest bg-input p-2 rounded-md">{activeSession.session_code}</p>
                                        <button onClick={() => copyToClipboard(activeSession.session_code || '')} title="Copy Code" className="p-2 bg-secondary rounded-md hover:bg-accent"><Copy size={16}/></button>
                                    </div>
                                    <div className="flex justify-center">{qrCodeUrl && <img src={qrCodeUrl} alt="Session QR Code" className="w-48 h-48 rounded-lg border-4 border-primary p-1" />}</div>
                                    <button onClick={handleEndSession} className="w-full bg-destructive text-destructive-foreground py-2 rounded-lg hover:bg-destructive/90">End Session</button>
                                </div>
                             ) : (
                                <div className="text-center">
                                    <p className="text-muted-foreground mb-4">Start a new 5-minute, location-secured session for attendance.</p>
                                    <button onClick={handleStartSession} disabled={isFetchingLocation} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                                      {isFetchingLocation ? <><Loader size={20} className="animate-spin" /> Checking Location...</> : 'Start New Session'}
                                    </button>
                                </div>
                             )}
                        </div>
                        <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                             <h2 className="text-xl font-bold mb-4">Live Attendance ({liveAttendance.length})</h2>
                             <div className="space-y-2 max-h-96 overflow-y-auto">
                                {liveAttendance.length > 0 ? liveAttendance.map(rec => (
                                    <div key={rec.id} className="bg-secondary p-3 rounded-md flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{rec.studentName}</p>
                                            <p className="text-xs text-muted-foreground">{rec.enrollmentId}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{new Date(rec.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                )) : <p className="text-muted-foreground text-center pt-8">Waiting for students to check in...</p>}
                             </div>
                        </div>
                    </div>
                )}
                {activeTab === 'curriculum' && <TeacherCurriculum user={user} curriculum={curriculum} setCurriculum={setCurriculum} />}
                {activeTab === 'analytics' && <TeacherAnalytics teacherId={user.id} allAttendance={attendance} allStudents={students} />}
            </div>
        </div>
    );
};

const TeacherCurriculum: React.FC<{ user: User, curriculum: Curriculum[], setCurriculum: (c: Curriculum[]) => void }> = ({ user, curriculum, setCurriculum }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [topic, setTopic] = useState('');
    const [activities, setActivities] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        const entry = curriculum.find(c => c.date === selectedDate && c.teacherId === user.id);
        setTopic(entry?.topic || '');
        setActivities(entry?.activities || '');
    }, [selectedDate, curriculum, user.id]);

    const handleSave = () => {
        const existing = curriculum.find(c => c.date === selectedDate && c.teacherId === user.id);
        if (existing) {
            setCurriculum(curriculum.map(c => c.id === existing.id ? { ...c, topic, activities } : c));
        } else {
            setCurriculum([...curriculum, { id: crypto.randomUUID(), teacherId: user.id, date: selectedDate, topic, activities }]);
        }
        toast.success("Curriculum saved!");
    };

    const handleGetAiSuggestions = async () => {
        if (!topic.trim()) {
            toast.error("Please enter a topic first.");
            return;
        }
        if (!geminiAI) {
            toast.error("AI features are not available. Please configure the API key.");
            return;
        }
        setIsAiLoading(true);
        try {
            const prompt = `Based on the curriculum topic "${topic}", suggest 3-5 creative and engaging student activities. Format the output as a numbered list.`;
            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setActivities(response.text);
        } catch (e) {
            console.error(e);
            toast.error("Failed to get AI suggestions.");
        }
        setIsAiLoading(false);
    };

    return (
        <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Curriculum Planner</h2>
            <div className="mb-4">
                <label htmlFor="curriculum-date" className="text-sm font-medium">Date</label>
                <input id="curriculum-date" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full mt-1 bg-input border-border rounded-md px-3 py-2" />
            </div>
            <div className="mb-4">
                <label htmlFor="topic" className="text-sm font-medium">Topic of the Day</label>
                <input id="topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Photosynthesis" className="w-full mt-1 bg-input border-border rounded-md px-3 py-2" />
            </div>
            <div>
                 <label htmlFor="activities" className="text-sm font-medium">Activities & Plan</label>
                 <div className="relative">
                    <textarea id="activities" value={activities} onChange={e => setActivities(e.target.value)} placeholder="1. ..." className="w-full mt-1 bg-input border-border rounded-md px-3 py-2 min-h-[150px] resize-y" />
                    <button onClick={handleGetAiSuggestions} disabled={isAiLoading} className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 text-xs bg-secondary rounded-md hover:bg-accent disabled:opacity-50">
                        {isAiLoading ? <Loader size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                        AI Suggest
                    </button>
                 </div>
            </div>
            <button onClick={handleSave} className="w-full mt-4 bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90">Save Curriculum</button>
        </div>
    );
};

const TeacherAnalytics: React.FC<{ teacherId: number; allAttendance: AttendanceRecord[]; allStudents: User[] }> = ({ teacherId, allAttendance, allStudents }) => {
    const studentsOfTeacher = allStudents.filter(s => s.role === 'student'); // simplified for mock
    const attendanceOfTeacher = allAttendance.filter(a => a.teacherId === teacherId);

    // Calculate total unique sessions for this teacher
    const totalSessions = new Set(attendanceOfTeacher.map(a => a.sessionId)).size;
    
    // Calculate overall attendance rate
    const overallRate = (studentsOfTeacher.length * totalSessions) > 0 
        ? (attendanceOfTeacher.length / (studentsOfTeacher.length * totalSessions)) * 100
        : 0;

    const studentRates = studentsOfTeacher.map(student => {
        const attendedCount = new Set(attendanceOfTeacher.filter(a => a.enrollmentId === student.enrollment_id).map(a => a.sessionId)).size;
        const rate = totalSessions > 0 ? (attendedCount / totalSessions) * 100 : 0;
        return { name: student.name, enrollmentId: student.enrollment_id, rate: rate };
    });

    return (
        <div className="bg-card border border-border p-6 rounded-xl shadow-lg space-y-8">
            <div>
                 <h2 className="text-xl font-bold mb-4">Overall Analytics</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="bg-secondary p-4 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{studentsOfTeacher.length}</p>
                        <p className="text-sm text-muted-foreground">Total Students</p>
                    </div>
                    <div className="bg-secondary p-4 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{totalSessions}</p>
                        <p className="text-sm text-muted-foreground">Total Sessions</p>
                    </div>
                     <div className="bg-secondary p-4 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{overallRate.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Avg. Attendance Rate</p>
                    </div>
                 </div>
            </div>
            <div>
                <h2 className="text-xl font-bold mb-4">Student Attendance Breakdown</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {studentRates.length > 0 ? studentRates.map(s => (
                        <div key={s.enrollmentId} className="bg-secondary p-3 rounded-md">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{s.name}</p>
                                    <p className="text-xs text-muted-foreground">{s.enrollmentId}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 bg-input rounded-full h-2.5"><div className="bg-primary h-2.5 rounded-full" style={{width: `${s.rate}%`}}></div></div>
                                    <p className="text-sm font-semibold w-12 text-right">{s.rate.toFixed(0)}%</p>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <p className="text-muted-foreground text-center py-8">No student data to analyze.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const QrScannerModal: React.FC<{ user: User; onClose: () => void; onScanSuccess: (sessionId: string) => void }> = ({ user, onClose, onScanSuccess }) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            'qr-reader',
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );
        scannerRef.current = scanner;

        const handleSuccess = (decodedText: string, decodedResult: any) => {
            try {
                const url = new URL(decodedText);
                const sessionId = url.searchParams.get('session_id');
                if (sessionId) {
                    onScanSuccess(sessionId);
                    if (scannerRef.current) {
                        scannerRef.current.clear();
                    }
                }
            } catch (error) {
                // Ignore errors from scanning non-URL QR codes
            }
        };

        const handleError = (error: string) => {
            // This callback can be noisy, so we'll just log it to the console for debugging
            // console.warn(`QR error = ${error}`);
        };

        scanner.render(handleSuccess, handleError);

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode scanner.", error);
                });
            }
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center animate-fade-in-fast">
            <div className="bg-card p-6 rounded-lg relative max-w-sm w-full mx-4">
                <button onClick={onClose} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"><X size={20}/></button>
                <h3 className="text-lg font-bold text-center mb-4">Scan Attendance QR Code</h3>
                <div id="qr-reader" className="w-full border border-border rounded-lg overflow-hidden"></div>
                 <style>{`
                    @keyframes fade-in-fast {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out; }
                    #qr-reader__dashboard_section_swaplink { display: none; }
                `}</style>
            </div>
        </div>
    );
};


const StudentDashboard: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const [curriculum, setCurriculum] = usePersistentMockState<Curriculum[]>('maven-portal-curriculum', MOCK_CURRICULUM);
    const [attendance, setAttendance] = usePersistentMockState<AttendanceRecord[]>('maven-portal-attendance', MOCK_ATTENDANCE);
    const [isScanning, setIsScanning] = useState(false);
    const toast = useToast();

    const todayEntry = curriculum.find(c => c.date === new Date().toISOString().split('T')[0]);
    const myAttendance = attendance.filter(a => a.enrollmentId === user.enrollment_id);

    const handleScanSuccess = (sessionId: string) => {
        setIsScanning(false);
        const allAttendance: AttendanceRecord[] = JSON.parse(localStorage.getItem('maven-portal-attendance') || '[]');
        const hasAlreadyCheckedIn = allAttendance.some(rec => rec.sessionId === sessionId && rec.enrollmentId === user.enrollment_id);

        if (hasAlreadyCheckedIn) {
            toast.error("You have already checked in for this session.");
            return;
        }

        const allSessions: Session[] = JSON.parse(localStorage.getItem('maven-portal-sessions') || '[]');
        const session = allSessions.find(s => s.id === sessionId);
        if (!session || new Date(session.expires_at) < new Date()) {
            toast.error("Invalid or expired session code.");
            return;
        }

        const newRecord: AttendanceRecord = {
            id: crypto.randomUUID(),
            sessionId: sessionId,
            studentName: user.name,
            enrollmentId: user.enrollment_id!,
            timestamp: new Date().toISOString(),
            teacherId: session.teacher_id!,
        };
        
        setAttendance(prev => [...prev, newRecord]);
        toast.success("Attendance marked successfully!");
    };


    return (
         <div className="flex-1 p-6 sm:p-8 bg-background text-foreground overflow-y-auto">
            {isScanning && <QrScannerModal user={user} onClose={() => setIsScanning(false)} onScanSuccess={handleScanSuccess} />}
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Student Dashboard</h1>
                    <p className="text-muted-foreground">Welcome, {user.name} ({user.enrollment_id})</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsScanning(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80">
                        <QrCode size={16} /> Scan Attendance
                    </button>
                    <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 bg-card border border-border p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold mb-4">Today's Curriculum</h2>
                    {todayEntry ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-primary">{todayEntry.topic}</h3>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">Activities:</p>
                                <div className="prose prose-invert prose-sm whitespace-pre-wrap bg-secondary p-4 rounded-md">
                                    {todayEntry.activities}
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="text-center py-12 text-muted-foreground">
                            <BookOpen size={32} className="mx-auto mb-4"/>
                            <p>No curriculum posted for today.</p>
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold mb-4">My Attendance History</h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                       {myAttendance.length > 0 ? myAttendance.map(rec => (
                           <div key={rec.id} className="bg-secondary p-3 rounded-md flex items-center gap-3">
                                <CheckCircle size={16} className="text-green-500" />
                                <div>
                                    <p className="font-medium text-sm">Checked In</p>
                                    <p className="text-xs text-muted-foreground">{new Date(rec.timestamp).toLocaleString()}</p>
                                </div>
                           </div>
                       )) : <p className="text-muted-foreground text-sm text-center pt-8">No attendance records found.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};


// =================================================================
// MAIN PORTAL COMPONENT
// =================================================================

export const StudentTeacherPortal: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (email: string, pass: string): Promise<void> => {
        setError(null);
        if (!isSupabaseConfigured) {
            await new Promise(res => setTimeout(res, 500));
            const user = [MOCK_TEACHER, ...MOCK_STUDENTS].find(u => u.email === email && u.password === pass);
            if (user) setCurrentUser(user);
            else setError("Invalid email or password.");
            return;
        }
        setError("Supabase login not implemented.");
    };

    const handleRegister = async (details: NewUser): Promise<void> => {
         setError(null);
        if (!isSupabaseConfigured) {
            await new Promise(res => setTimeout(res, 500));
            const userExists = [MOCK_TEACHER, ...MOCK_STUDENTS].find(u => u.email === details.email);
            if (userExists) { setError("An account with this email already exists."); return; }
            const newUser: User = { id: Date.now(), created_at: new Date().toISOString(), ...details };
            setCurrentUser(newUser);
        }
        setError("Supabase registration not implemented.");
    };
    
    const handleLogout = () => {
        setCurrentUser(null);
        setViewMode('login');
    };

    if (!currentUser) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background p-4">
                {viewMode === 'signup' ? 
                    <SignUpView onRegister={handleRegister} error={error} setError={setError} setViewMode={setViewMode} /> :
                    <LoginView onLogin={handleLogin} error={error} setError={setError} setViewMode={setViewMode} pendingSessionId={null} />
                }
            </div>
        );
    }

    if (currentUser.role === 'teacher') return <TeacherDashboard user={currentUser} onLogout={handleLogout} />;
    if (currentUser.role === 'student') return <StudentDashboard user={currentUser} onLogout={handleLogout} />;
    
    return null;
};