
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, Download } from 'lucide-react';
import { useToast } from './Toast';
import QRCode from 'qrcode';
import { PortalUser, PortalSession, PortalAttendanceRecord } from '../types';
import { initPortalDB, registerUser, loginUser, getUserById, createSession, getActiveSession, endSession, logAttendance, getAttendanceForSession } from './portal-db';

declare const XLSX: any;

// --- HELPERS ---
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

const getGeolocationErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED: return "Location permission denied. Please enable it in your browser settings.";
    case error.POSITION_UNAVAILABLE: return "Unable to retrieve your location. Please check your device's location services.";
    case error.TIMEOUT: return "Getting your location took too long. Please try again.";
    default: return "An unknown error occurred while getting your location.";
  }
};


// --- AUTH SCREEN ---
const AuthScreen: React.FC<{ onLogin: (user: PortalUser) => void }> = ({ onLogin }) => {
    const [viewMode, setViewMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [role, setRole] = useState<'teacher' | 'student'>('student');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (viewMode === 'login') {
                const user = await loginUser(email, password);
                onLogin(user);
                toast.success("Logged in successfully!");
            } else {
                if (role === 'student' && !enrollmentId.trim()) {
                    toast.error("Enrollment ID is required for students.");
                    setLoading(false);
                    return;
                }
                const newUser: Omit<PortalUser, 'id'> = { name, email, password, role, enrollmentId: role === 'student' ? enrollmentId : undefined };
                await registerUser(newUser);
                toast.success("Signed up successfully! Please log in.");
                setViewMode('login');
            }
        } catch (error: any) {
            toast.error(error.toString());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Local Student & Teacher Portal</h1>
                    <p className="text-muted-foreground">{viewMode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
                </div>
                <form onSubmit={handleAuthAction} className="space-y-4">
                    {viewMode === 'signup' && <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />}
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />
                    {viewMode === 'signup' && (
                        <>
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setRole('student')} className={`flex-1 p-2 rounded-md border-2 ${role === 'student' ? 'border-primary bg-primary/10' : 'border-border bg-input'}`}>Student</button>
                                <button type="button" onClick={() => setRole('teacher')} className={`flex-1 p-2 rounded-md border-2 ${role === 'teacher' ? 'border-primary bg-primary/10' : 'border-border bg-input'}`}>Teacher</button>
                            </div>
                            {role === 'student' && <input type="text" placeholder="Enrollment ID" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />}
                        </>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50">
                        {loading && <Loader className="animate-spin mr-2"/>}
                        {viewMode === 'login' ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>
                <div className="text-center mt-4">
                    <button onClick={() => setViewMode(v => v === 'login' ? 'signup' : 'login')} className="text-sm text-primary hover:underline">
                        {viewMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
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
    const [radius, setRadius] = useState(100); // Default 100 meters
    const [startingSession, setStartingSession] = useState(false);
    const toast = useToast();
    const channel = useRef(new BroadcastChannel('portal-updates'));

    useEffect(() => {
        getActiveSession().then(session => {
            if (session && session.teacherId === user.id) {
                setActiveSession(session);
                getAttendanceForSession(session.id).then(setLiveAttendance);
            }
        });

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'NEW_ATTENDANCE' && activeSession) {
                toast.success(`${event.data.student.name} checked in!`);
                getAttendanceForSession(activeSession.id).then(setLiveAttendance);
            }
        };
        
        channel.current.addEventListener('message', handleMessage);
        return () => channel.current.removeEventListener('message', handleMessage);
    }, [user.id, toast, activeSession]);
    
    useEffect(() => {
        if (activeSession?.otp) {
            QRCode.toDataURL(activeSession.otp, { width: 256, margin: 2 }, (err, url) => {
                if (err) console.error(err);
                setQrCodeUrl(url);
            });
        }
    }, [activeSession]);

    const startSession = async () => {
        setStartingSession(true);
        let location: { latitude: number; longitude: number } | null = null;
        if (locationEnforced) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true }));
                location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            } catch (error: any) {
                toast.error(getGeolocationErrorMessage(error));
                setStartingSession(false);
                return;
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const newSession = await createSession({ teacherId: user.id, otp, location, radius, locationEnforced });
        setActiveSession(newSession);
        toast.success("Session started!");
        setStartingSession(false);
    };

    const handleEndSession = async () => {
        await endSession();
        setActiveSession(null);
        setLiveAttendance([]);
        toast.info("Session ended.");
    };

    const handleExport = () => {
        if (liveAttendance.length === 0) {
            toast.info("No attendance data to export.");
            return;
        }
        const data = liveAttendance.map(a => ({
            "Enrollment ID": a.student.enrollmentId,
            "Name": a.student.name,
            "Check-in Time": new Date(a.timestamp).toLocaleString(),
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `attendance_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground">
            <header className="p-4 border-b border-border flex items-center justify-between">
                <h1 className="text-xl font-bold">Teacher Dashboard</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Welcome, {user.name}</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6">
                <div className="bg-card border border-border rounded-xl p-6">
                    {activeSession ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h2 className="text-xl font-bold">Session is Live</h2>
                                <p className="text-muted-foreground">Session Code:</p>
                                <div className="flex items-center gap-2 my-2">
                                    <span className="text-4xl font-bold tracking-widest bg-secondary px-4 py-2 rounded-lg">{activeSession.otp}</span>
                                    <button onClick={() => navigator.clipboard.writeText(activeSession.otp)}><Copy size={20}/></button>
                                </div>
                                {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-lg"/>}
                                <button onClick={handleEndSession} className="mt-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-semibold w-full">End Session</button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold">Live Attendance ({liveAttendance.length})</h3>
                                    <button onClick={handleExport} className="flex items-center gap-2 text-sm text-primary"><Download size={16}/> Export XLS</button>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {liveAttendance.map(att => (
                                        <div key={att.id} className="p-2 bg-secondary rounded-md flex justify-between items-center text-sm">
                                            <span>
                                                <p className="font-medium">{att.student.name}</p>
                                                <p className="text-xs text-muted-foreground">{att.student.enrollmentId}</p>
                                            </span>
                                            <CheckCircle size={16} className="text-green-500"/>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Start New Session</h2>
                            <div className="space-y-4 max-w-sm">
                                <div className="flex items-center gap-2"><input type="checkbox" checked={locationEnforced} onChange={e => setLocationEnforced(e.target.checked)} id="loc-check"/><label htmlFor="loc-check" className="cursor-pointer">Enforce location verification</label></div>
                                {locationEnforced && (
                                    <div>
                                        <label>Valid Radius (meters)</label>
                                        <input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full bg-input p-2 rounded-md mt-1"/>
                                    </div>
                                )}
                                <button onClick={startSession} disabled={startingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold flex items-center justify-center disabled:opacity-50">
                                    {startingSession ? <Loader className="animate-spin"/> : <Smartphone/>} Start Session
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const StudentDashboard: React.FC<{ user: PortalUser, onLogout: () => void }> = ({ user, onLogout }) => {
    const [code, setCode] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'verified' | 'error'>('idle');
    const [locationMessage, setLocationMessage] = useState('');
    const [activeSession, setActiveSession] = useState<PortalSession | null>(null);
    const toast = useToast();
    const channel = useRef(new BroadcastChannel('portal-updates'));

    useEffect(() => {
        getActiveSession().then(session => {
            setActiveSession(session);
            if (session?.locationEnforced) {
                setLocationStatus('checking');
                setLocationMessage('Verifying your location...');
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        const dist = getDistance(latitude, longitude, session.location!.latitude, session.location!.longitude);
                        if (dist <= session.radius) {
                            setLocationStatus('verified');
                            setLocationMessage(`Location verified. You are ${Math.round(dist)}m away.`);
                        } else {
                            setLocationStatus('error');
                            setLocationMessage(`Location check failed. You are too far (${Math.round(dist)}m).`);
                        }
                    },
                    (error) => {
                        setLocationStatus('error');
                        setLocationMessage(getGeolocationErrorMessage(error));
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            } else if (session) {
                setLocationStatus('verified'); // No location needed
            }
        });
    }, []);

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setCheckingIn(true);
        try {
            if (!activeSession) throw new Error("No active session found.");
            if (activeSession.otp !== code) throw new Error("Invalid session code.");

            const attendance = await logAttendance({ sessionId: activeSession.id, student: user, timestamp: new Date().toISOString() });
            toast.success("Checked in successfully!");
            channel.current.postMessage({ type: 'NEW_ATTENDANCE', student: user });
            setCode('');
        } catch (error: any) {
            toast.error(error.toString());
        } finally {
            setCheckingIn(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground">
             <header className="p-4 border-b border-border flex items-center justify-between">
                <h1 className="text-xl font-bold">Student Dashboard</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Welcome, {user.name} ({user.enrollmentId})</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
             <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
                 <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm">
                    <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>
                    {!activeSession ? (
                        <p className="text-muted-foreground text-center">No active session found.</p>
                    ) : (
                        <>
                            {activeSession.locationEnforced && (
                                <div className={`p-2 rounded-md text-sm mb-4 flex items-center gap-2 ${
                                    locationStatus === 'checking' ? 'bg-amber-500/20 text-amber-300' :
                                    locationStatus === 'verified' ? 'bg-green-500/20 text-green-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                    {locationStatus === 'checking' && <Loader className="animate-spin" size={16}/>}
                                    {locationStatus === 'verified' && <CheckCircle size={16}/>}
                                    {locationStatus === 'error' && <X size={16}/>}
                                    {locationMessage}
                                </div>
                            )}
                            <form onSubmit={handleCheckIn}>
                                <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="Enter 6-digit code" className="w-full bg-input text-2xl text-center tracking-[0.5em] font-mono border-border rounded-lg p-4 mb-4" maxLength={6} disabled={locationStatus !== 'verified'} />
                                <button type="submit" disabled={checkingIn || code.length < 6 || locationStatus !== 'verified'} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50">
                                    {checkingIn ? <Loader className="animate-spin"/> : <CheckCircle/>} Check In
                                </button>
                            </form>
                        </>
                    )}
                 </div>
             </main>
        </div>
    );
};


// --- MAIN PORTAL COMPONENT ---
const StudentTeacherPortal: React.FC = () => {
    const [isDbInitialized, setIsDbInitialized] = useState(false);
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        initPortalDB().then(success => {
            setIsDbInitialized(success);
            if (success) {
                const loggedInUserId = sessionStorage.getItem('portal-user-id');
                if (loggedInUserId) {
                    getUserById(loggedInUserId).then(setUser).finally(() => setLoading(false));
                } else {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    }, []);

    const handleLogin = (loggedInUser: PortalUser) => {
        setUser(loggedInUser);
        sessionStorage.setItem('portal-user-id', loggedInUser.id);
    };

    const handleLogout = () => {
        setUser(null);
        sessionStorage.removeItem('portal-user-id');
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary"/></div>;
    }

    if (!isDbInitialized) {
        return <div className="flex-1 flex items-center justify-center text-destructive">Failed to initialize local portal database.</div>;
    }

    if (!user) {
        return <AuthScreen onLogin={handleLogin} />;
    }

    return user.role === 'teacher' ? <TeacherDashboard user={user} onLogout={handleLogout} /> : <StudentDashboard user={user} onLogout={handleLogout} />;
};

export default StudentTeacherPortal;
