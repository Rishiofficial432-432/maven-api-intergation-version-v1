
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PortalUser, PortalSession, PortalAttendanceRecord, CurriculumFile } from '../types';
import { createUser, getUserByEmail, createSession, getActiveSession, endActiveSession, logAttendance, getAttendanceForSession, getPendingStudents, approveStudent, addCurriculumFile, getCurriculumFiles, getCurriculumFileBlob, deleteCurriculumFile } from './portal-db';
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
    const [activeSession, setActiveSession] = useState<PortalSession | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [liveAttendance, setLiveAttendance] = useState<PortalAttendanceRecord[]>([]);
    const [locationEnforced, setLocationEnforced] = useState(false);
    const [radius, setRadius] = useState(50);
    const [startingSession, setStartingSession] = useState(false);
    const [pendingStudents, setPendingStudents] = useState<PortalUser[]>([]);
    const [loadingApprovals, setLoadingApprovals] = useState(true);
    const [curriculumFiles, setCurriculumFiles] = useState<CurriculumFile[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const toast = useToast();

    const fetchDashboardData = useCallback(async () => {
        setLoadingApprovals(true);
        try {
            const [students, files, session] = await Promise.all([
                getPendingStudents(),
                getCurriculumFiles(),
                getActiveSession()
            ]);
            setPendingStudents(students);
            setCurriculumFiles(files);
            if (session) {
                setActiveSession(session);
                const attendance = await getAttendanceForSession(session.id);
                setLiveAttendance(attendance);
            }
        } catch (error: any) {
            toast.error(`Failed to load data: ${error.message}`);
        } finally {
            setLoadingApprovals(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data;
            if (type === 'NEW_ATTENDANCE' && activeSession && payload.sessionId === activeSession.id) {
                toast.success(`${payload.record.student_name} just checked in!`);
                setLiveAttendance(prev => [...prev, payload.record]);
            }
        };
        attendanceChannel.addEventListener('message', handleMessage);
        return () => attendanceChannel.removeEventListener('message', handleMessage);
    }, [activeSession, toast]);

    useEffect(() => {
        if (activeSession?.session_code) {
            QRCode.toDataURL(activeSession.session_code, { width: 256, margin: 1, color: { dark: '#f8fafc', light: '#111827' } }, (err, url) => {
                if (err) console.error(err);
                setQrCodeUrl(url);
            });
        }
    }, [activeSession]);
    
    const handleStartSession = async () => {
        setStartingSession(true);
        try {
            let location: { latitude: number, longitude: number } | null = null;
            if (locationEnforced) {
                location = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        (err) => reject(new Error(getGeolocationErrorMessage(err)))
                    );
                });
            }
            const session_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const newSession: PortalSession = {
                id: crypto.randomUUID(),
                teacher_id: user.id,
                session_code,
                expires_at,
                is_active: true,
                location_enforced: locationEnforced,
                radius,
                location
            };
            await createSession(newSession);
            setActiveSession(newSession);
            toast.success("New session started!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setStartingSession(false);
        }
    };

    const handleEndSession = async () => {
        if (!activeSession) return;
        try {
            await endActiveSession();
            setActiveSession(null);
            setLiveAttendance([]);
            setQrCodeUrl('');
            toast.info("Session has been ended.");
        } catch (error: any) {
            toast.error(error.message);
        }
    };
    
    const handleApproveStudent = async (studentId: string) => {
        await approveStudent(studentId);
        setPendingStudents(p => p.filter(s => s.id !== studentId));
        toast.success("Student approved!");
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
            const newFile: CurriculumFile = {
                id: crypto.randomUUID(),
                teacherId: user.id,
                teacherName: user.name,
                fileName: file.name,
                fileType: file.type,
                createdAt: new Date().toISOString()
            };
            await addCurriculumFile(newFile, file);
            setCurriculumFiles(prev => [newFile, ...prev]);
            toast.success("File uploaded successfully.");
        } catch(err: any) {
            toast.error(`Upload failed: ${err.message}`);
        } finally {
            setUploadingFile(false);
        }
    };
    
    const handleFileDelete = async (fileId: string) => {
        if(window.confirm("Are you sure you want to delete this file?")) {
            await deleteCurriculumFile(fileId);
            setCurriculumFiles(f => f.filter(file => file.id !== fileId));
            toast.success("File deleted.");
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20 text-foreground">
            <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold">Teacher Command Center</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.name}</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-4">Session Control</h2>
                        {!activeSession ? (
                            <div className="space-y-4 max-w-lg">
                                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                    <label htmlFor="location-toggle" className="font-semibold flex items-center gap-2"><MapPin size={18}/> Enforce Location</label>
                                    <button onClick={() => setLocationEnforced(!locationEnforced)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${locationEnforced ? 'bg-primary' : 'bg-input'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${locationEnforced ? 'translate-x-6' : 'translate-x-1'}`}/></button>
                                </div>
                                {locationEnforced && (
                                    <div className="p-3 bg-secondary rounded-lg">
                                        <label htmlFor="radius-slider" className="font-semibold">Check-in Radius: <span className="text-primary font-bold">{radius}m</span></label>
                                        <input id="radius-slider" type="range" min="10" max="500" step="10" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer mt-2"/>
                                    </div>
                                )}
                                <button onClick={handleStartSession} disabled={startingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {startingSession ? <><Loader className="animate-spin"/> Starting...</> : 'Start New Session'}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div className="text-center bg-gray-900 rounded-lg p-2">
                                    {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="w-full max-w-[200px] mx-auto rounded-md"/> : <Loader className="animate-spin"/>}
                                </div>
                                <div className="space-y-3">
                                    <div className="p-3 bg-secondary rounded-lg">
                                        <p className="text-sm text-muted-foreground">Session PIN</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-3xl font-mono tracking-widest">{activeSession.session_code}</p>
                                            <button onClick={() => { navigator.clipboard.writeText(activeSession.session_code); toast.success("PIN Copied!"); }} className="p-2 hover:bg-accent rounded-md"><Copy size={18}/></button>
                                        </div>
                                    </div>
                                    {activeSession.location_enforced && activeSession.location && (
                                        <div className="p-3 bg-secondary rounded-lg">
                                            <p className="text-sm font-semibold text-green-400 flex items-center gap-1"><ShieldCheck size={14}/> Location Enforcement: ON</p>
                                            <p className="text-xs font-mono text-muted-foreground">Lat: {activeSession.location.latitude.toFixed(5)}, Lon: {activeSession.location.longitude.toFixed(5)}</p>
                                        </div>
                                    )}
                                    <button onClick={handleEndSession} className="w-full bg-destructive/80 hover:bg-destructive text-destructive-foreground py-2 rounded-lg font-semibold">End Session</button>
                                </div>
                            </div>
                        )}
                    </div>
                    {activeSession && (
                        <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
                            <h2 className="text-2xl font-bold mb-4">Live Attendance Feed</h2>
                            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                <div className="bg-secondary p-3 rounded-lg"><p className="text-2xl font-bold text-primary">{liveAttendance.length}</p><p className="text-sm text-muted-foreground">Live Count</p></div>
                                <div className="bg-secondary p-3 rounded-lg"><p className="text-2xl font-bold">--</p><p className="text-sm text-muted-foreground">Total Students</p></div>
                                <div className="bg-secondary p-3 rounded-lg"><p className="text-2xl font-bold">--%</p><p className="text-sm text-muted-foreground">Check-in Rate</p></div>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {liveAttendance.length > 0 ? liveAttendance.map(att => (
                                    <div key={att.student_id} className="flex justify-between items-center p-2 bg-secondary rounded-md">
                                        <div>
                                            <p className="font-semibold">{att.student_name}</p>
                                            <p className="text-xs text-muted-foreground">{att.enrollment_id}</p>
                                        </div>
                                        <p className="text-xs text-green-400 font-mono">{new Date(att.created_at).toLocaleTimeString()}</p>
                                    </div>
                                )) : <p className="text-center text-muted-foreground py-4">Waiting for students to check in...</p>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-4 flex items-center justify-between">Pending Approvals <RefreshCw size={16} onClick={fetchDashboardData} className="cursor-pointer hover:rotate-90 transition-transform"/></h3>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {loadingApprovals ? <Loader className="animate-spin mx-auto"/> : pendingStudents.length > 0 ? pendingStudents.map(s => (
                                <div key={s.id} className="p-2 bg-secondary rounded-md">
                                    <p className="font-semibold text-sm">{s.name}</p>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-muted-foreground">{s.email}</p>
                                        <button onClick={() => handleApproveStudent(s.id)} className="p-1 bg-primary/20 text-primary rounded-md"><Check size={14}/></button>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center">No pending students.</p>}
                        </div>
                    </div>
                     <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-4">Curriculum Files</h3>
                        <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                           {curriculumFiles.map(f => (
                                <div key={f.id} className="flex justify-between items-center p-2 bg-secondary rounded-md text-sm">
                                    <p className="truncate pr-2">{f.fileName}</p>
                                    <button onClick={() => handleFileDelete(f.id)} className="text-destructive/70 hover:text-destructive flex-shrink-0"><Trash2 size={14}/></button>
                                </div>
                           ))}
                        </div>
                        <label className="w-full text-center cursor-pointer bg-primary/20 text-primary px-4 py-2 rounded-md text-sm font-semibold block disabled:opacity-50">
                            <input type="file" onChange={handleFileUpload} disabled={uploadingFile} className="hidden"/>
                            {uploadingFile ? <Loader className="animate-spin mx-auto"/> : 'Upload New File'}
                        </label>
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
    
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) {
            toast.error("Please enter a valid 6-digit code.");
            return;
        }
        setCheckingIn(true);
        try {
            const session = await getActiveSession();
            if (!session || session.session_code !== code) throw new Error("Invalid or expired session code.");

            if (session.location_enforced) {
                const studentLocation = await new Promise<{ lat: number, lon: number }>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                        (err) => reject(new Error(getGeolocationErrorMessage(err)))
                    );
                });
                const distance = getDistance(session.location!.latitude, session.location!.longitude, studentLocation.lat, studentLocation.lon);
                if (distance > session.radius!) throw new Error(`You are too far from the class (${Math.round(distance)}m). Required: <${session.radius}m.`);
            }

            const attendanceRecord = {
                session_id: session.id,
                student_id: user.id,
                student_name: user.name,
                enrollment_id: user.enrollment_id
            };
            
            await logAttendance(attendanceRecord);
            attendanceChannel.postMessage({ type: 'NEW_ATTENDANCE', payload: { record: { ...attendanceRecord, created_at: new Date().toISOString() }, sessionId: session.id } });
            toast.success("Checked in successfully!");
            setCode('');

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setCheckingIn(false);
        }
    };

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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 text-center shadow-lg">
                        <h2 className="text-2xl font-bold mb-4">Attendance Check-in</h2>
                        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Enter the 6-digit PIN provided by your teacher to mark your attendance.</p>
                        <form onSubmit={handleCheckIn} className="space-y-4 max-w-xs mx-auto">
                            <input type="text" placeholder="------" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={6} className="w-full bg-input text-center text-4xl tracking-[0.5em] font-mono rounded-lg p-4 border-2 border-transparent focus:border-primary focus:ring-0 transition-colors"/>
                            <button type="submit" disabled={checkingIn} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-lg disabled:opacity-50 transition-all active:scale-95">
                               {checkingIn ? <Loader className="animate-spin mx-auto"/> : 'Check In'}
                            </button>
                        </form>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><BarChart2 size={18}/> Attendance Summary</h3>
                        <div className="space-y-4 text-center">
                            <div className="bg-secondary p-3 rounded-lg"><p className="text-3xl font-bold text-primary">92%</p><p className="text-sm text-muted-foreground">Overall Rate</p></div>
                             <div className="bg-secondary p-3 rounded-lg"><p className="text-3xl font-bold">18/20</p><p className="text-sm text-muted-foreground">Sessions Attended</p></div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Calendar size={18}/> Today's Schedule</h3>
                         <div className="space-y-2">
                             <div className="p-3 bg-secondary rounded-lg"><p className="font-semibold">10:00 - History 101</p><p className="text-sm text-muted-foreground">Dr. Reed - Room 301</p></div>
                             <div className="p-3 bg-secondary rounded-lg"><p className="font-semibold">14:00 - Physics 204</p><p className="text-sm text-muted-foreground">Dr. Anya - Lab B</p></div>
                         </div>
                    </div>
                     <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Download size={18}/> Recent Curriculum Files</h3>
                         <div className="space-y-2">
                            <div className="p-3 bg-secondary rounded-lg flex justify-between items-center"><p className="font-semibold text-sm">Lecture_Notes_Week_5.pdf</p><button className="p-1.5 hover:bg-accent rounded-md"><Download size={16}/></button></div>
                            <div className="p-3 bg-secondary rounded-lg flex justify-between items-center"><p className="font-semibold text-sm">Midterm_Study_Guide.docx</p><button className="p-1.5 hover:bg-accent rounded-md"><Download size={16}/></button></div>
                         </div>
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
