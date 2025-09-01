
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar } from 'lucide-react';
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
    session_code?: string;
}

interface Curriculum {
    id?: number;
    teacher_id: number;
    date: string; // YYYY-MM-DD
    topic: string;
    activities: string;
}

interface NewUser {
    name: string;
    email: string;
    password?: string;
    role: 'teacher' | 'student';
    enrollment_id: string | null;
    phone: string | null;
}

type ScanStatus = { type: 'success' | 'error' | 'info' | 'idle', message: string | null };
type ViewMode = 'login' | 'signup' | 'forgot_password' | 'forgot_password_confirmation';

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

const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
    const getStrength = () => {
        let score = 0;
        if (password.length > 8) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    };
    const strength = getStrength();
    const strengthText = ['Weak', 'Fair', 'Good', 'Strong'];
    const strengthColor = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

    return (
        <div className="flex items-center gap-2 mt-2">
            <div className="w-full bg-secondary rounded-full h-1.5">
                <div 
                    className={`h-1.5 rounded-full ${strength > 0 ? strengthColor[strength-1] : ''} transition-all duration-300`}
                    style={{ width: `${(strength / 4) * 100}%` }}
                ></div>
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">{strength > 0 ? strengthText[strength-1] : ''}</span>
        </div>
    );
};


const LoginView: React.FC<{ onLogin: (email: string, pass: string) => Promise<void>, error: string | null, setError: (err: string | null) => void, setViewMode: (mode: ViewMode) => void, pendingSessionId: string | null }> = ({ onLogin, error, setError, setViewMode, pendingSessionId }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
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
            {pendingSessionId && (
                <div className="bg-blue-500/10 text-blue-300 text-sm p-3 rounded-md mb-4 text-center flex items-center gap-2">
                    <Info size={16} />
                    <span>Please sign in to mark your attendance.</span>
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
                    <PasswordStrengthIndicator password={password} />
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
    );
};

const ForgotPasswordView: React.FC<{ setViewMode: (mode: ViewMode) => void, onForgotPassword: (email: string) => void }> = ({ setViewMode, onForgotPassword }) => {
    const [email, setEmail] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onForgotPassword(email);
        setViewMode('forgot_password_confirmation');
    };

    return (
        <div className="w-full max-w-sm bg-card p-8 rounded-xl shadow-lg border border-border">
             <div className="text-center mb-8">
                <ShieldCheck size={48} className="mx-auto text-primary mb-2" />
                <h1 className="text-2xl font-bold">Forgot Password</h1>
                <p className="text-muted-foreground text-sm">Enter your email to receive reset instructions.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="text-sm font-medium" htmlFor="forgot-email">Email</label>
                    <div className="relative mt-1">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input id="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
                    </div>
                </div>
                 <button type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors">
                    Send Reset Instructions
                </button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
                Remembered your password?{' '}
                <button onClick={() => setViewMode('login')} className="font-semibold text-primary hover:underline">
                    Sign In
                </button>
            </p>
        </div>
    );
};

const ForgotPasswordConfirmationView: React.FC<{ setViewMode: (mode: ViewMode) => void }> = ({ setViewMode }) => {
    return (
        <div className="w-full max-w-sm bg-card p-8 rounded-xl shadow-lg border border-border text-center">
            <Mail size={48} className="mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold">Check Your Email</h1>
            <p className="text-muted-foreground text-sm my-4">If an account with that email exists, we've sent instructions to reset your password.</p>
            <button onClick={() => setViewMode('login')} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors">
                Back to Login
            </button>
        </div>
    );
};


interface AuthPortalProps {
    onLogin: (email: string, pass: string) => Promise<void>;
    onRegister: (details: NewUser) => Promise<void>;
    onForgotPassword: (email: string) => void;
    error: string | null;
    setError: (err: string | null) => void;
    pendingSessionId: string | null;
}

const AuthPortal: React.FC<AuthPortalProps> = ({ onLogin, onRegister, onForgotPassword, error, setError, pendingSessionId }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('login');

    const renderView = () => {
        switch (viewMode) {
            case 'signup':
                return <SignUpView onRegister={onRegister} error={error} setError={setError} setViewMode={setViewMode} />;
            case 'forgot_password':
                return <ForgotPasswordView setViewMode={setViewMode} onForgotPassword={onForgotPassword} />;
            case 'forgot_password_confirmation':
                return <ForgotPasswordConfirmationView setViewMode={setViewMode} />;
            case 'login':
            default:
                return <LoginView onLogin={onLogin} error={error} setError={setError} setViewMode={setViewMode} pendingSessionId={pendingSessionId} />;
        }
    };
    
    return (
         <div className="flex-1 flex items-center justify-center bg-secondary/30 p-4">
            {renderView()}
        </div>
    );
};

const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const CurriculumManager: React.FC<{
    teacher: User;
    onSave: (curriculum: Curriculum) => Promise<void>;
    onFetch: (date: string) => Promise<Curriculum | null>;
}> = ({ teacher, onSave, onFetch }) => {
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [topic, setTopic] = useState('');
    const [activities, setActivities] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchCurriculum = async () => {
            setIsLoading(true);
            const data = await onFetch(selectedDate);
            setTopic(data?.topic || '');
            setActivities(data?.activities || '');
            setIsLoading(false);
        };
        fetchCurriculum();
    }, [selectedDate, onFetch]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave({
            teacher_id: teacher.id,
            date: selectedDate,
            topic,
            activities,
        });
        setIsSaving(false);
    };

    return (
        <div className="bg-card p-6 rounded-xl shadow-lg border border-border flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar size={20}/> Curriculum Log
            </h2>
            <div className="mb-4">
                <label htmlFor="curriculum-date" className="text-sm font-medium text-muted-foreground">Select Date</label>
                <input
                    type="date"
                    id="curriculum-date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full mt-1 bg-input border-border rounded-md px-3 py-2"
                />
            </div>
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader className="animate-spin" />
                </div>
            ) : (
                <form onSubmit={handleSave} className="flex flex-col flex-1">
                    <div className="mb-4">
                        <label htmlFor="topic" className="text-sm font-medium text-muted-foreground">Topic of the Day</label>
                        <input
                            id="topic"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="e.g., Introduction to Algebra"
                            className="w-full mt-1 bg-input border-border rounded-md px-3 py-2"
                        />
                    </div>
                    <div className="flex-1 flex flex-col mb-4">
                        <label htmlFor="activities" className="text-sm font-medium text-muted-foreground">Activities & Notes</label>
                        <textarea
                            id="activities"
                            value={activities}
                            onChange={e => setActivities(e.target.value)}
                            placeholder="Describe the activities covered, homework assigned, etc."
                            className="w-full mt-1 bg-input border-border rounded-md px-3 py-2 flex-1 resize-none"
                        />
                    </div>
                    <button type="submit" disabled={isSaving} className="w-full bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2">
                        {isSaving ? <><Loader size={16} className="animate-spin" /> Saving...</> : 'Save Curriculum'}
                    </button>
                </form>
            )}
        </div>
    );
};

interface TeacherDashboardProps {
    teacher: User;
    onLogout: () => void;
    sessionCode: string | null;
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
    onSaveCurriculum: (curriculum: Curriculum) => Promise<void>;
    onFetchCurriculum: (date: string) => Promise<Curriculum | null>;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
    teacher, onLogout, sessionCode, isStartingSession, students, presentStudents, activeSession, error,
    setError, onStartSession, onEndSession, onAddStudent, onSaveEdit, onDeleteStudent, onCheckActiveSession,
    onSaveCurriculum, onFetchCurriculum
}) => {
    const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingPhone, setEditingPhone] = useState('');
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnrollment, setNewStudentEnrollment] = useState('');
    const [newStudentPhone, setNewStudentPhone] = useState('');
    const [view, setView] = useState<'attendance' | 'curriculum'>('attendance');

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

    const startEditing = (student: User) => {
        setEditingStudentId(student.id);
        setEditingName(student.name);
        setEditingPhone(student.phone || '');
    };
    
    useEffect(() => {
        onCheckActiveSession();
    }, []);

    return (
        <div className="flex-1 flex flex-col p-6 bg-secondary/30">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
                    <p className="text-muted-foreground">Welcome, {teacher.name}</p>
                </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-card p-1 rounded-lg">
                        <button onClick={() => setView('attendance')} className={`px-3 py-1.5 text-sm rounded-md ${view === 'attendance' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Attendance</button>
                        <button onClick={() => setView('curriculum')} className={`px-3 py-1.5 text-sm rounded-md ${view === 'curriculum' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Curriculum</button>
                    </div>
                    <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-card text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            {view === 'curriculum' && (
                <CurriculumManager teacher={teacher} onSave={onSaveCurriculum} onFetch={onFetchCurriculum} />
            )}
            
            {view === 'attendance' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    <div className="lg:col-span-1 flex flex-col items-center justify-center bg-card p-6 rounded-xl shadow-lg border border-border">
                        {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4 w-full text-center">{error}</div>}
                        {activeSession ? (
                            <>
                                <h2 className="text-xl font-semibold mb-2">Session is Live</h2>
                                <p className="text-muted-foreground mb-4">Share this code with your students:</p>
                                <div className="bg-primary/10 text-primary p-4 rounded-lg font-mono text-5xl tracking-widest font-bold mb-4">
                                    {sessionCode}
                                </div>
                                <div className="flex items-center gap-2 text-lg text-accent-foreground mb-4">
                                    <Clock />
                                    <Timer endTime={activeSession.expires_at} onEnd={() => onEndSession(activeSession.id)} />
                                </div>
                                <button onClick={() => onEndSession(activeSession.id)} className="w-full bg-destructive text-destructive-foreground py-2 rounded-lg hover:bg-destructive/90">
                                    End Session
                                </button>
                            </>
                        ) : (
                            <>
                                <h2 className="text-xl font-semibold mb-2">Start a New Session</h2>
                                <p className="text-muted-foreground mb-6 text-center">Click below to start a 10-minute attendance session.</p>
                                <button onClick={onStartSession} disabled={isStartingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                                    {isStartingSession ? <><Loader className="animate-spin"/> Starting...</> : 'Start New Session'}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="lg:col-span-2 bg-card p-6 rounded-xl shadow-lg border border-border flex flex-col min-h-0">
                        <h2 className="text-xl font-bold mb-4">Student Roster & Attendance</h2>
                        <div className="flex-1 overflow-y-auto pr-2">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="p-2">Name</th>
                                        <th className="p-2">Enrollment ID</th>
                                        <th className="p-2">Phone</th>
                                        <th className="p-2 text-center">Status</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => (
                                        <tr key={student.id} className="border-b border-border/50 hover:bg-secondary/50">
                                            {editingStudentId === student.id ? (
                                                <>
                                                    <td className="p-2"><input value={editingName} onChange={e => setEditingName(e.target.value)} className="bg-input w-full p-1 rounded"/></td>
                                                    <td className="p-2">{student.enrollment_id}</td>
                                                    <td className="p-2"><input value={editingPhone} onChange={e => setEditingPhone(e.target.value)} className="bg-input w-full p-1 rounded"/></td>
                                                    <td className="p-2"></td>
                                                    <td className="p-2"><button onClick={() => handleSaveEdit(student.id)} className="p-1 text-green-400"><Save size={16}/></button></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2">{student.name}</td>
                                                    <td className="p-2">{student.enrollment_id}</td>
                                                    <td className="p-2">{student.phone}</td>
                                                    <td className="p-2 text-center">
                                                        {presentStudents.has(student.id) ? 
                                                            <span className="text-green-400 font-semibold flex items-center justify-center gap-1"><CheckCircle size={14}/> Present</span> : 
                                                            <span className="text-muted-foreground text-sm">Absent</span>}
                                                    </td>
                                                    <td className="p-2 flex gap-2">
                                                        <button onClick={() => startEditing(student)} className="p-1 text-muted-foreground hover:text-primary"><Edit size={14}/></button>
                                                        <button onClick={() => onDeleteStudent(student.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14}/></button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {students.length === 0 && <p className="text-muted-foreground text-center py-8">No students enrolled yet.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface StudentDashboardProps {
    student: User;
    onLogout: () => void;
    onCheckIn: (code: string) => Promise<void>;
    onFetchTodaysCurriculum: () => Promise<Curriculum | null>;
    status: ScanStatus;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, onLogout, onCheckIn, onFetchTodaysCurriculum, status }) => {
    const [sessionCode, setSessionCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [todaysAgenda, setTodaysAgenda] = useState<Curriculum | null>(null);
    const [isLoadingAgenda, setIsLoadingAgenda] = useState(true);

    useEffect(() => {
        const fetchAgenda = async () => {
            setIsLoadingAgenda(true);
            const agenda = await onFetchTodaysCurriculum();
            setTodaysAgenda(agenda);
            setIsLoadingAgenda(false);
        };
        fetchAgenda();
    }, [onFetchTodaysCurriculum]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionCode.trim()) return;
        setIsSubmitting(true);
        await onCheckIn(sessionCode.trim().toUpperCase());
        setIsSubmitting(false);
    };

    const StatusDisplay: React.FC<{ status: ScanStatus }> = ({ status }) => {
        if (status.type === 'idle') return null;
        
        const icons = {
            success: <CheckCircle className="text-green-400" />,
            error: <X className="text-destructive" />,
            info: <Info className="text-blue-400" />
        };
        const colors = {
            success: 'bg-green-500/10 text-green-300',
            error: 'bg-destructive/10 text-destructive',
            info: 'bg-blue-500/10 text-blue-300'
        }

        return (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${colors[status.type]}`}>
                {icons[status.type]}
                <span className="font-medium">{status.message}</span>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col p-6 bg-secondary/30">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Student Dashboard</h1>
                    <p className="text-muted-foreground">Welcome, {student.name} ({student.enrollment_id})</p>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-card text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                    <LogOut size={16} /> Logout
                </button>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                 <div className="w-full max-w-md mx-auto bg-card p-8 rounded-xl shadow-lg border border-border">
                    <div className="text-center mb-6">
                        <Smartphone size={48} className="mx-auto text-primary mb-2" />
                        <h2 className="text-2xl font-bold">Attendance Check-In</h2>
                        <p className="text-muted-foreground">Enter the session code from your teacher.</p>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                        <input
                            type="text"
                            value={sessionCode}
                            onChange={(e) => setSessionCode(e.target.value)}
                            placeholder="A4B7C"
                            maxLength={5}
                            className="w-full p-4 bg-input text-center text-3xl font-mono tracking-[0.5em] uppercase rounded-lg border-border focus:ring-2 focus:ring-primary"
                            />
                        <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                           {isSubmitting ? <><Loader className="animate-spin"/> Checking In...</> : 'Check In'}
                        </button>
                    </form>
                    
                    <StatusDisplay status={status} />
                </div>
                <div className="w-full max-w-md mx-auto bg-card p-8 rounded-xl shadow-lg border border-border h-full flex flex-col">
                    <div className="text-center mb-6">
                         <Calendar size={48} className="mx-auto text-primary mb-2" />
                         <h2 className="text-2xl font-bold">Today's Agenda</h2>
                         <p className="text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                    {isLoadingAgenda ? <Loader className="mx-auto animate-spin"/> : (
                        todaysAgenda ? (
                             <div className="space-y-4 text-left">
                                <div>
                                    <h3 className="font-semibold text-muted-foreground">Topic:</h3>
                                    <p className="text-lg">{todaysAgenda.topic}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-muted-foreground">Activities:</h3>
                                    <p className="whitespace-pre-wrap text-foreground/80">{todaysAgenda.activities}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center flex-1 flex items-center justify-center">No curriculum has been logged for today.</p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

// =================================================================
// SUPABASE PORTAL IMPLEMENTATION (Live Mode)
// =================================================================
const SupabasePortal: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [sessionCode, setSessionCode] = useState<string | null>(null);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [students, setStudents] = useState<User[]>([]);
    const [presentStudents, setPresentStudents] = useState<Set<number>>(new Set());
    const [studentStatus, setStudentStatus] = useState<ScanStatus>({ type: 'idle', message: null });
    const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

    const fetchStudents = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_users').select('*').eq('role', 'student');
        if (error) console.error("Error fetching students:", error);
        else setStudents(data as User[]);
    }, []);

    useEffect(() => {
        fetchStudents();
        const urlParams = new URLSearchParams(window.location.search);
        const sessionIdFromUrl = urlParams.get('session_id');
        if (sessionIdFromUrl) {
            setPendingSessionId(sessionIdFromUrl);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [fetchStudents]);

    const handleLogin = async (email: string, pass: string) => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_users').select('*').eq('email', email).single();
        if (error || !data || data.password !== pass) {
            setLoginError("Invalid credentials. Please try again.");
        } else {
            setUser(data as User);
            setLoginError(null);
            if (data.role === 'student' && pendingSessionId) {
                await handleStudentCheckInWithId(data.id, pendingSessionId);
            }
        }
    };
    
    const handleRegister = async (details: NewUser) => {
        if (!supabase) return;
        const { data: existingUser } = await supabase.from('portal_users').select('id').or(`email.eq.${details.email},enrollment_id.eq.${details.enrollment_id}`).single();
        if(existingUser){
            setLoginError("An account with this email or enrollment ID already exists.");
            return;
        }

        const { data, error } = await supabase.from('portal_users').insert([details]).select().single();
        if (error) {
            setLoginError("Registration failed: " + error.message);
        } else if (data) {
            setUser(data as User);
            setLoginError(null);
        }
    };
    
    const handleLogout = () => setUser(null);
    
    const checkActiveSession = useCallback(async (teacherId?: number) => {
        if (!supabase || !teacherId) return;
        const { data, error } = await supabase.from('portal_sessions')
            .select('*').eq('teacher_id', teacherId).eq('is_active', true).single();
        if (data) {
            setActiveSession(data as Session);
            setSessionCode(data.session_code || null);
            fetchPresentStudents(data.id);
        } else {
            setActiveSession(null);
            setSessionCode(null);
        }
        if (error && error.code !== 'PGRST116') console.error("Error checking active session:", error);
    }, []);

    const handleStartSession = async () => {
        if (!supabase || !user || user.role !== 'teacher') return;
        setIsStartingSession(true);
        setLoginError(null);
        const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        const { data, error } = await supabase.from('portal_sessions').insert({ teacher_id: user.id, expires_at, session_code: code }).select().single();
        if (error) {
            setLoginError("Failed to start session: " + error.message);
        } else {
            setActiveSession(data as Session);
            setSessionCode(data.session_code);
            setPresentStudents(new Set());
        }
        setIsStartingSession(false);
    };

    const handleEndSession = async (sessionId?: string) => {
        if (!supabase || !sessionId) return;
        await supabase.from('portal_sessions').update({ is_active: false }).eq('id', sessionId);
        setActiveSession(null);
        setSessionCode(null);
        setPresentStudents(new Set());
    };
    
    const fetchPresentStudents = useCallback(async (sessionId: string) => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_attendance').select('student_id').eq('session_id', sessionId);
        if (error) console.error("Error fetching present students:", error);
        else setPresentStudents(new Set(data.map(d => d.student_id)));
    }, []);
    
    const handleStudentCheckIn = async (code: string) => {
         if (!supabase || !user || user.role !== 'student') return;
         setStudentStatus({ type: 'idle', message: null });

         const { data: sessionData, error: sessionError } = await supabase.from('portal_sessions')
            .select('*').eq('session_code', code).eq('is_active', true).single();
        
        if (sessionError || !sessionData) {
            setStudentStatus({ type: 'error', message: "Invalid or expired session code." });
            return;
        }

        await handleStudentCheckInWithId(user.id, sessionData.id);
    };

    const handleStudentCheckInWithId = async (studentId: number, sessionId: string) => {
        if(!supabase) return;
        setPendingSessionId(null);
        const { error: insertError } = await supabase.from('portal_attendance')
            .insert({ student_id: studentId, session_id: sessionId });

        if (insertError) {
             if (insertError.code === '23505') { 
                setStudentStatus({ type: 'info', message: "You've already been marked present for this session." });
            } else {
                setStudentStatus({ type: 'error', message: "Check-in failed: " + insertError.message });
            }
        } else {
            setStudentStatus({ type: 'success', message: "Attendance marked successfully!" });
        }
    };

    const handleAddStudent = async (name: string, enrollment: string, phone: string) => {
        if (!supabase) return;
        await supabase.from('portal_users').insert({ name, enrollment_id: enrollment, phone, role: 'student', email: `${enrollment}@school.local` });
        fetchStudents();
    };
    const handleSaveEdit = async (id: number, name: string, phone: string) => {
        if (!supabase) return;
        await supabase.from('portal_users').update({ name, phone }).eq('id', id);
        fetchStudents();
    };
    const handleDeleteStudent = async (id: number) => {
        if (!supabase) return;
        await supabase.from('portal_users').delete().eq('id', id);
        fetchStudents();
    };

    const handleSaveCurriculum = async (curriculum: Curriculum) => {
        if (!supabase) return;
        const { error } = await supabase.from('portal_curriculum').upsert(curriculum, { onConflict: 'teacher_id,date' });
        if(error) console.error("Error saving curriculum:", error);
    };

    const handleFetchCurriculum = async (date: string): Promise<Curriculum | null> => {
        if (!supabase || !user) return null;
        const { data, error } = await supabase.from('portal_curriculum').select('*').eq('teacher_id', user.id).eq('date', date).single();
        if (error && error.code !== 'PGRST116') console.error("Error fetching curriculum:", error);
        return data as Curriculum | null;
    };

    const handleFetchTodaysCurriculum = async (): Promise<Curriculum | null> => {
        if (!supabase) return null;
        const today = formatDate(new Date());
        const { data, error } = await supabase.from('portal_curriculum').select('*').eq('date', today).limit(1).single();
        if (error && error.code !== 'PGRST116') console.error("Error fetching today's curriculum:", error);
        return data as Curriculum | null;
    };

    useEffect(() => {
        if (activeSession) {
            const interval = setInterval(() => fetchPresentStudents(activeSession.id), 5000);
            return () => clearInterval(interval);
        }
    }, [activeSession, fetchPresentStudents]);

    if (!user) {
        return <AuthPortal onLogin={handleLogin} onRegister={handleRegister} onForgotPassword={()=>{}} error={loginError} setError={setLoginError} pendingSessionId={pendingSessionId} />;
    }
    if (user.role === 'teacher') {
        return <TeacherDashboard 
            teacher={user} 
            onLogout={handleLogout} 
            sessionCode={sessionCode}
            isStartingSession={isStartingSession} 
            students={students} 
            presentStudents={presentStudents} 
            activeSession={activeSession}
            error={loginError}
            setError={setLoginError}
            onStartSession={handleStartSession} 
            onEndSession={handleEndSession}
            onAddStudent={handleAddStudent}
            onSaveEdit={handleSaveEdit}
            onDeleteStudent={handleDeleteStudent}
            onCheckActiveSession={() => checkActiveSession(user?.id)}
            onSaveCurriculum={handleSaveCurriculum}
            onFetchCurriculum={handleFetchCurriculum}
        />;
    }
    return <StudentDashboard student={user} onLogout={handleLogout} onCheckIn={handleStudentCheckIn} onFetchTodaysCurriculum={handleFetchTodaysCurriculum} status={studentStatus} />;
};

// =================================================================
// MOCK PORTAL IMPLEMENTATION (Local/Offline Mode)
// =================================================================
const MockPortal: React.FC = () => {
    const [users, setUsers] = useState<User[]>([MOCK_TEACHER, ...MOCK_STUDENTS]);
    const [user, setUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [sessionCode, setSessionCode] = useState<string | null>(null);
    const [presentStudents, setPresentStudents] = useState<Set<number>>(new Set());
    const [studentStatus, setStudentStatus] = useState<ScanStatus>({ type: 'idle', message: null });
    const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
    const [curriculumLog, setCurriculumLog] = useState<Curriculum[]>([]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionIdFromUrl = urlParams.get('session_id');
        if (sessionIdFromUrl) {
            setPendingSessionId(sessionIdFromUrl);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleLogin = async (email: string, pass: string) => {
        const foundUser = users.find(u => u.email === email && u.password === pass);
        if (foundUser) {
            setUser(foundUser);
            setLoginError(null);
            if (foundUser.role === 'student' && pendingSessionId) {
                await handleStudentCheckInWithId(foundUser.id, pendingSessionId);
            }
        } else {
            setLoginError("Invalid credentials for local mock mode.");
        }
    };
    
    const handleRegister = async (details: NewUser) => {
        if(users.some(u => u.email === details.email || u.enrollment_id === details.enrollment_id)){
            setLoginError("An account with this email or enrollment ID already exists in mock mode.");
            return;
        }
        const newUser: User = {
            id: Date.now(),
            created_at: new Date().toISOString(),
            ...details,
        };
        setUsers(prev => [...prev, newUser]);
        setUser(newUser);
        setLoginError(null);
    };
    
    const handleForgotPassword = (email: string) => {
        console.log(`Password reset requested for mock user: ${email}`);
    };

    const handleLogout = () => setUser(null);

    const handleStartSession = async () => {
        if (!user || user.role !== 'teacher') return;
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        const session: Session = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            teacher_id: user.id,
            is_active: true,
            session_code: code,
        };
        setActiveSession(session);
        setSessionCode(code);
        setPresentStudents(new Set());
    };

    const handleEndSession = async () => {
        setActiveSession(null);
        setSessionCode(null);
    };

    const handleStudentCheckIn = async (code: string) => {
        if (!user || user.role !== 'student') return;
        setStudentStatus({type: 'idle', message: null});

        if (activeSession && activeSession.session_code === code && activeSession.is_active) {
            await handleStudentCheckInWithId(user.id, activeSession.id);
        } else {
            setStudentStatus({ type: 'error', message: "Invalid or expired session code." });
        }
    };

    const handleStudentCheckInWithId = async (studentId: number, sessionId: string) => {
        setPendingSessionId(null);
        if (activeSession && activeSession.id === sessionId && new Date(activeSession.expires_at) > new Date()) {
             if (presentStudents.has(studentId)) {
                setStudentStatus({ type: 'info', message: "You've already been marked present." });
            } else {
                setPresentStudents(prev => new Set(prev).add(studentId));
                setStudentStatus({ type: 'success', message: "Attendance marked successfully!" });
            }
        } else {
            setStudentStatus({type: 'error', message: 'The session is invalid or has expired.'});
        }
    }

    const handleAddStudent = async (name: string, enrollment: string, phone: string) => {
        const newUser: User = { id: Date.now(), created_at: new Date().toISOString(), name, email: `${enrollment}@school.local`, role: 'student', enrollment_id: enrollment, phone };
        setUsers(prev => [...prev, newUser]);
    };
    const handleSaveEdit = async (id: number, name: string, phone: string) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, name, phone } : u));
    };
    const handleDeleteStudent = async (id: number) => {
        setUsers(prev => prev.filter(u => u.id !== id));
    };
    
    const handleSaveCurriculum = async (curriculum: Curriculum) => {
        setCurriculumLog(prev => {
            const existingIndex = prev.findIndex(c => c.date === curriculum.date);
            if (existingIndex > -1) {
                const updatedLog = [...prev];
                updatedLog[existingIndex] = curriculum;
                return updatedLog;
            }
            return [...prev, curriculum];
        });
    };

    const handleFetchCurriculum = async (date: string): Promise<Curriculum | null> => {
        return curriculumLog.find(c => c.date === date) || null;
    };
    
    const handleFetchTodaysCurriculum = async (): Promise<Curriculum | null> => {
        const today = formatDate(new Date());
        return curriculumLog.find(c => c.date === today) || null;
    };

    if (!user) {
        return <AuthPortal onLogin={handleLogin} onRegister={handleRegister} onForgotPassword={handleForgotPassword} error={loginError} setError={setLoginError} pendingSessionId={pendingSessionId} />;
    }

    if (user.role === 'teacher') {
        return <TeacherDashboard 
            teacher={user}
            onLogout={handleLogout}
            sessionCode={sessionCode}
            isStartingSession={false}
            students={users.filter(u => u.role === 'student')}
            presentStudents={presentStudents}
            activeSession={activeSession}
            error={loginError}
            setError={setLoginError}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onAddStudent={handleAddStudent}
            onSaveEdit={handleSaveEdit}
            onDeleteStudent={handleDeleteStudent}
            onCheckActiveSession={() => {}}
            onSaveCurriculum={handleSaveCurriculum}
            onFetchCurriculum={handleFetchCurriculum}
        />;
    }
    return <StudentDashboard student={user} onLogout={handleLogout} onCheckIn={handleStudentCheckIn} onFetchTodaysCurriculum={handleFetchTodaysCurriculum} status={studentStatus} />;
};


// =================================================================
// CONTAINER COMPONENT
// =================================================================
export const StudentTeacherPortal: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return isSupabaseConfigured ? <SupabasePortal /> : <MockPortal />;
};
