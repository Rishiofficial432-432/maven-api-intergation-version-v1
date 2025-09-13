import React, { useState, useEffect, useRef } from 'react';
import { PortalUser, PortalSession, PortalAttendanceRecord } from '../types';
import { createUser, getUserByEmail, createSession, getActiveSession, endActiveSession, logAttendance, getAttendanceForSession } from './portal-db';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, Download, QrCode } from 'lucide-react';
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

// --- AUTH SCREEN ---
const AuthScreen: React.FC<{ onLogin: (user: PortalUser) => void }> = ({ onLogin }) => {
    const [viewMode, setViewMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [enrollmentId, setEnrollmentId] = useState('');
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
                const existingUser = await getUserByEmail(email);
                if (existingUser) {
                    throw new Error("An account with this email already exists.");
                }
                if (role === 'student' && !enrollmentId.trim()) {
                    toast.error("Enrollment ID is required for students.");
                    setLoading(false);
                    return;
                }
                const newUser: PortalUser = {
                    id: crypto.randomUUID(),
                    name,
                    email,
                    password,
                    role,
                    enrollment_id: role === 'student' ? enrollmentId : undefined
                };
                await createUser(newUser);
                toast.success("Signed up successfully! You can now log in.");
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
                            {role === 'student' && <input type="text" placeholder="Enrollment ID" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} required className="w-full bg-input border border-border rounded-lg px-4 py-2.5" />}
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
    const [radius, setRadius] = useState(100);
    const [startingSession, setStartingSession] = useState(false);
    const [teacherLocation, setTeacherLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const toast = useToast();

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

    const startSession = async () => {
        setStartingSession(true);
        let locationData: { latitude: number; longitude: number } | null = null;
        if (locationEnforced) {
             if (!teacherLocation) {
                 toast.error("Location has not been captured yet. Please wait.");
                 setIsFetchingLocation(true);
                 try {
                     const position = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
                     const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                     setTeacherLocation(loc);
                     locationData = loc;
                     setIsFetchingLocation(false);
                 } catch (error: any) {
                     toast.error(getGeolocationErrorMessage(error));
                     setIsFetchingLocation(false);
                     setStartingSession(false);
                     return;
                 }
             } else {
                locationData = teacherLocation;
             }
        }
        
        const newSession: PortalSession = {
            id: crypto.randomUUID(),
            teacher_id: user.id,
            session_code: Math.floor(100000 + Math.random() * 900000).toString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            is_active: true,
            location_enforced: locationEnforced,
            radius: radius,
            location: locationData,
        };

        try {
            await createSession(newSession);
            setActiveSession(newSession);
            setLiveAttendance([]);
            toast.success("Session started!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setStartingSession(false);
        }
    };

    const handleEndSession = async () => {
        try {
            await endActiveSession();
            setActiveSession(null);
            setLiveAttendance([]);
            toast.info("Session ended.");
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
            <main className="flex-1 overflow-y-auto p-6">
                {activeSession ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 flex flex-col items-center text-center">
                            <h2 className="text-xl font-bold">Session is Live</h2>
                            <p className="text-muted-foreground mt-2">Share this code with your students:</p>
                            <div className="flex items-center gap-2 my-4"><span className="text-5xl font-bold tracking-[0.2em] bg-secondary px-6 py-3 rounded-lg">{activeSession.session_code}</span><button onClick={() => { navigator.clipboard.writeText(activeSession.session_code!); toast.success("Code copied!"); }} className="p-2 bg-secondary rounded-lg hover:bg-accent"><Copy size={20}/></button></div>
                            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-lg bg-card p-2 border border-border"/>}
                            {activeSession.location_enforced && (<div className="mt-4 text-xs text-muted-foreground p-2 bg-secondary rounded-md flex items-center gap-2"><MapPin size={14} className="text-blue-400"/> Location enforced within {activeSession.radius}m</div>)}
                            <p className="text-xs text-muted-foreground mt-4">Session expires at {new Date(activeSession.expires_at).toLocaleTimeString()}</p>
                            <button onClick={handleEndSession} className="mt-6 bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-semibold w-full hover:bg-destructive/90 transition-colors">End Session</button>
                        </div>
                        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                            <h3 className="text-xl font-bold mb-4">Live Attendance ({liveAttendance.length})</h3>
                            <div className="space-y-2">
                                {liveAttendance.length === 0 ? <p className="text-muted-foreground text-center pt-8">Waiting for students to check in...</p> : liveAttendance.map(att => (
                                    <div key={att.student_id} className="p-3 bg-secondary rounded-lg flex justify-between items-center text-sm animate-fade-in-up transition-colors hover:bg-secondary/80">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                {att.student_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{att.student_name}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{att.enrollment_id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Clock size={12}/><span>{new Date(att.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><CheckCircle size={16} className="text-green-500 ml-2"/></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-xl p-6 max-w-lg mx-auto animate-fade-in-up"><h2 className="text-2xl font-bold mb-6 text-center">Start New Session</h2><div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg"><label htmlFor="loc-check" className="font-semibold flex items-center gap-2 cursor-pointer"><ShieldCheck className="text-primary"/> Enforce Location Verification</label><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={locationEnforced} onChange={e => setLocationEnforced(e.target.checked)} id="loc-check" className="sr-only peer" /><div className="w-11 h-6 bg-input peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></label></div>
                        {locationEnforced && (
                            <div className="p-4 bg-secondary rounded-lg animate-fade-in-up">
                                <label htmlFor="radius-input" className="font-semibold flex items-center gap-2 mb-2"><MapPin/> Valid Radius (meters)</label>
                                <input id="radius-input" type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full bg-input p-2 rounded-md"/>
                            </div>
                        )}
                        <button onClick={startSession} disabled={startingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors text-lg">{startingSession ? <Loader className="animate-spin"/> : <><Smartphone/> Start Session</>}</button>
                    </div></div>
                )}
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
        setCheckingIn(true);
        try {
            const session = await getActiveSession();
            if (!session || session.session_code !== code) {
                throw new Error("Invalid or expired session code.");
            }
            
            if (session.location_enforced) {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true }));
                const { latitude, longitude } = position.coords;
                const sessionLocation = session.location as { latitude: number, longitude: number };
                const dist = getDistance(latitude, longitude, sessionLocation.latitude, sessionLocation.longitude);
                if (dist > (session.radius || 100)) throw new Error(`Location check failed. You are too far (${Math.round(dist)}m).`);
            }
            
            const attendanceRecord = {
                student_id: user.id,
                session_id: session.id,
                student_name: user.name,
                enrollment_id: user.enrollment_id,
            };

            await logAttendance(attendanceRecord);

            attendanceChannel.postMessage({
                type: 'NEW_ATTENDANCE',
                payload: {
                    sessionId: session.id,
                    record: { ...attendanceRecord, created_at: new Date().toISOString() }
                }
            });

            toast.success("Checked in successfully!");
            setCode('');
        } catch (error: any) { toast.error(error.message); } finally { setCheckingIn(false); }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20 text-foreground">
             <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold">Student Dashboard</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.name} ({user.enrollment_id})</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
             <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
                 <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center animate-fade-in-up">
                    <h2 className="text-2xl font-bold mb-2">Mark Your Attendance</h2><p className="text-muted-foreground mb-6">Enter the 6-digit code provided by your teacher.</p>
                    <form onSubmit={handleCheckIn}>
                        <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="000000" className="w-full bg-input text-4xl text-center tracking-[0.5em] font-mono border-border rounded-lg p-4 mb-6 focus:ring-2 focus:ring-ring focus:border-transparent" maxLength={6} disabled={checkingIn} autoFocus/>
                        <button type="submit" disabled={checkingIn || code.length < 6} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50 text-lg hover:bg-primary/90 transition-colors">{checkingIn ? <Loader className="animate-spin"/> : <><UserCheck/> Check In</>}</button>
                    </form>
                 </div>
             </main>
        </div>
    );
};

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
    
    return user.role === 'teacher' ? <TeacherDashboard user={user} onLogout={handleLogout} /> : <StudentDashboard user={user} onLogout={handleLogout} />;
};

export default StudentTeacherPortal;
