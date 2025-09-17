

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PortalUser, PortalSession, PortalAttendanceRecord, CurriculumFile } from '../types';
import { createUser, getUserByEmail, createSession, getActiveSession, endActiveSession, logAttendance, getAttendanceForSession, getPendingStudents, approveStudent, addCurriculumFile, getCurriculumFiles, getCurriculumFileBlob, deleteCurriculumFile } from './portal-db';
// FIX: Added missing GraduationCap icon import from lucide-react.
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, Download, QrCode, UploadCloud, FileText, Check, GraduationCap } from 'lucide-react';
import { useToast } from './Toast';
import QRCode from 'qrcode';

// --- HELPERS ---
const getGeolocationErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED: return "Location permission denied. Please enable it in your browser settings.";
    case error.POSITION_UNAVAILABLE: return "Unable to retrieve your location. Check your device's location services.";
    case error.TIMEOUT: return "Getting your location took too long. Please try again.";
    default: return "An unknown error occurred while getting your location.";
  }
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in metres
}

const attendanceChannel = new BroadcastChannel('portal-attendance-channel');

// --- DEMO USERS ---
const demoTeacher: PortalUser = {
    id: 'teacher-demo-01',
    name: 'Dr. Evelyn Reed',
    email: 'e.reed@university.edu',
    role: 'teacher',
    approved: true
};

const demoStudent: PortalUser = {
    id: 'student-demo-01',
    name: 'Alex Johnson',
    email: 'a.johnson@university.edu',
    role: 'student',
    enrollment_id: 'S2024-AJ-01',
    ug_number: 'UG-12345',
    phone_number: '555-0101',
    approved: true
};

// --- AUTH SCREEN ---
const AuthScreen: React.FC<{ onLogin: (user: PortalUser) => void }> = ({ onLogin }) => {
    const [viewMode, setViewMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [ugNumber, setUgNumber] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (viewMode === 'login') {
                const user = await getUserByEmail(email);
                if (user && user.password === password) {
                    toast.success("Logged in successfully!");
                    onLogin(user);
                } else {
                    throw new Error("Invalid email or password.");
                }
            } else {
                 const newUser: PortalUser = {
                    id: crypto.randomUUID(), name, email, password, role,
                    enrollment_id: role === 'student' ? enrollmentId : undefined,
                    ug_number: role === 'student' ? ugNumber : undefined,
                    phone_number: role === 'student' ? phoneNumber : undefined,
                    approved: role === 'teacher' // Teachers are auto-approved
                };
                await createUser(newUser);
                toast.success(role === 'student' ? "Signup successful! A teacher must approve your account before you can log in." : "Teacher account created! You can now log in.");
                setViewMode('login');
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-accent/20 animate-fade-in-up">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold flex items-center justify-center gap-2"><ClipboardList/> Student/Teacher Portal</h1>
                    <p className="text-muted-foreground mt-2">{viewMode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
                </div>

                <div className="space-y-3 mb-4">
                    <button onClick={() => onLogin(demoTeacher)} className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <UserIcon size={16}/> Demo Login as Teacher
                    </button>
                    <button onClick={() => onLogin(demoStudent)} className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <GraduationCap size={16}/> Demo Login as Student
                    </button>
                </div>
                 <div className="relative my-4 flex items-center">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">Or continue with email</span>
                    <div className="flex-grow border-t border-border"></div>
                </div>

                <form onSubmit={handleAuthAction} className="space-y-4">
                     {viewMode === 'signup' && (
                        <div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" /></div>
                    )}
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" /></div>
                     <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" /></div>
                    {viewMode === 'signup' && (
                        <>
                            <div className="flex gap-4 p-1 bg-secondary rounded-lg">
                                <button type="button" onClick={() => setRole('student')} className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${role === 'student' ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-accent'}`}>I am a Student</button>
                                <button type="button" onClick={() => setRole('teacher')} className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${role === 'teacher' ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-accent'}`}>I am a Teacher</button>
                            </div>
                            {role === 'student' && (
                                <div className="space-y-4 pt-2">
                                    <input type="text" placeholder="Enrollment ID" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />
                                    <input type="text" placeholder="UG Number" value={ugNumber} onChange={e => setUgNumber(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />
                                    <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />
                                </div>
                            )}
                        </>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50 transition-colors hover:bg-primary/90">
                        {loading ? <Loader className="animate-spin"/> : (viewMode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>
                <div className="text-center mt-6">
                    <button onClick={() => setViewMode(v => v === 'login' ? 'signup' : 'login')} className="text-sm text-primary hover:underline">{viewMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}</button>
                </div>
            </div>
        </div>
    );
};

// --- DASHBOARDS ---
const TeacherDashboard: React.FC<{ user: PortalUser, onLogout: () => void }> = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'session' | 'approvals' | 'curriculum'>('session');
    
    const [activeSession, setActiveSession] = useState<PortalSession | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [liveAttendance, setLiveAttendance] = useState<PortalAttendanceRecord[]>([]);
    const [locationEnforced, setLocationEnforced] = useState(false);
    const [radius, setRadius] = useState(100);
    const [startingSession, setStartingSession] = useState(false);
    const [teacherLocation, setTeacherLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    const [pendingStudents, setPendingStudents] = useState<PortalUser[]>([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    
    const [curriculumFiles, setCurriculumFiles] = useState<CurriculumFile[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);

    const toast = useToast();

    useEffect(() => {
        if (activeTab === 'approvals') {
            setLoadingApprovals(true);
            getPendingStudents().then(setPendingStudents).finally(() => setLoadingApprovals(false));
        }
        if (activeTab === 'curriculum') {
            getCurriculumFiles().then(setCurriculumFiles);
        }
    }, [activeTab]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data;
            if (type === 'NEW_ATTENDANCE' && activeSession && payload.sessionId === activeSession.id) {
                toast.success(`New student checked in!`);
                setLiveAttendance(prev => [...prev, payload.record]);
            }
        };
        attendanceChannel.addEventListener('message', handleMessage);
        return () => attendanceChannel.removeEventListener('message', handleMessage);
    }, [activeSession, toast]);
    
     useEffect(() => { if (activeSession?.session_code) { QRCode.toDataURL(activeSession.session_code, { width: 256, margin: 2, color: { dark: '#FFFFFF', light: '#18181b' } }, (err, url) => { if (err) console.error(err); setQrCodeUrl(url); }); } }, [activeSession]);

    const handleApproveStudent = async (studentId: string) => {
        try {
            await approveStudent(studentId);
            setPendingStudents(prev => prev.filter(s => s.id !== studentId));
            toast.success("Student approved successfully!");
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20 text-foreground">
            <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold">Teacher Dashboard</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.name}</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-6">
                    <h2 className="text-xl font-bold">Session Control</h2>
                    {/* Session UI Here */}
                </div>
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-2">Pending Approvals</h3>
                        {/* Approvals UI Here */}
                    </div>
                     <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-2">Curriculum Files</h3>
                        {/* Curriculum UI Here */}
                    </div>
                </div>
            </main>
        </div>
    );
};

const StudentDashboard: React.FC<{ user: PortalUser, onLogout: () => void }> = ({ user, onLogout }) => {
    const [code, setCode] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const toast = useToast();

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20 text-foreground">
             <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold">Student Hub</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.name}</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
             <main className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 text-center">
                        <h2 className="text-xl font-bold mb-4">Attendance Check-in</h2>
                        <form className="space-y-4 max-w-sm mx-auto">
                            <input type="text" placeholder="Enter 6-Digit Code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} className="w-full bg-input text-center text-2xl tracking-[0.5em] font-mono rounded-lg p-4"/>
                            <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold">Check In</button>
                        </form>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-2">Attendance Summary</h3>
                        {/* Stats Here */}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-2">Today's Schedule</h3>
                         {/* Schedule Here */}
                    </div>
                     <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-2">Recent Curriculum Files</h3>
                         {/* Files Here */}
                    </div>
                </div>
             </main>
        </div>
    );
};

// --- LOCATION PERMISSION GUARD ---
const LocationGuard: React.FC<{ onLogout: () => void, children: React.ReactNode }> = ({ onLogout, children }) => {
    const [permission, setPermission] = useState<PermissionState | 'loading'>('loading');
    const toast = useToast();

    const checkPermission = useCallback(async () => {
        if (!navigator.geolocation || !navigator.permissions) {
            toast.error("Geolocation is not supported by your browser.");
            onLogout();
            return;
        }
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            setPermission(status.state);
            return status;
        } catch (error) {
            console.error("Error querying location permission:", error);
            setPermission('denied'); // Assume denied if query fails
        }
    }, [onLogout, toast]);

    useEffect(() => {
        let permissionStatus: PermissionStatus | undefined;
        
        const handleChange = () => {
            if (permissionStatus && permissionStatus.state !== 'granted') {
                toast.error("Location permission is required and was disabled. You have been logged out.");
                onLogout();
            }
        };

        checkPermission().then(status => {
            if (status) {
                permissionStatus = status;
                status.addEventListener('change', handleChange);
            }
        });

        return () => {
            if (permissionStatus) {
                permissionStatus.removeEventListener('change', handleChange);
            }
        };
    }, [checkPermission, onLogout, toast]);

    const requestPermission = () => {
        setPermission('loading');
        navigator.geolocation.getCurrentPosition(
            () => checkPermission(),
            () => checkPermission()
        );
    };

    if (permission === 'loading') {
        return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary" size={32}/></div>;
    }

    if (permission === 'denied') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-accent/20 text-center">
                <div className="bg-card p-8 rounded-xl border border-border max-w-md">
                    <MapPin size={48} className="text-destructive mx-auto mb-4"/>
                    <h2 className="text-2xl font-bold">Location Permission Required</h2>
                    <p className="text-muted-foreground mt-2">The Student/Teacher Portal requires location access to function securely. Please enable location services for this site in your browser settings.</p>
                    <button onClick={requestPermission} className="mt-6 bg-primary text-primary-foreground py-2 px-6 rounded-lg font-semibold">Try Again</button>
                </div>
            </div>
        );
    }
    
    if (permission === 'prompt') {
        return (
             <div className="flex-1 flex flex-col items-center justify-center p-8 bg-accent/20 text-center">
                <div className="bg-card p-8 rounded-xl border border-border max-w-md">
                    <MapPin size={48} className="text-primary mx-auto mb-4"/>
                    <h2 className="text-2xl font-bold">Enable Location</h2>
                    <p className="text-muted-foreground mt-2">Please allow location access when your browser prompts you. This is required to use the portal.</p>
                    <button onClick={requestPermission} className="mt-6 bg-primary text-primary-foreground py-2 px-6 rounded-lg font-semibold">Grant Permission</button>
                </div>
            </div>
        )
    }

    return <>{children}</>;
}


// --- MAIN PORTAL COMPONENT ---
const StudentTeacherPortal: React.FC = () => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loggedInUser = sessionStorage.getItem('portal-user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
        }
        setLoading(false);
    }, []);

    const handleLogin = (loggedInUser: PortalUser) => {
        sessionStorage.setItem('portal-user', JSON.stringify(loggedInUser));
        setUser(loggedInUser);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('portal-user');
        setUser(null);
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary" size={32}/></div>;
    }

    if (!user) {
        return <AuthScreen onLogin={handleLogin} />;
    }
    
    const dashboard = user.role === 'teacher' 
        ? <TeacherDashboard user={user} onLogout={handleLogout} /> 
        : <StudentDashboard user={user} onLogout={handleLogout} />;

    return (
        <LocationGuard onLogout={handleLogout}>
            {dashboard}
        </LocationGuard>
    );
};

export default StudentTeacherPortal;