import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, QrCode, Copy, ToggleLeft, ToggleRight, RefreshCw, Video, VideoOff, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase-config';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
// Fix: Corrected useToast import path
import { useToast } from './Toast';


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
// HELPER FUNCTIONS
// =================================================================

const haversineDistance = (coords1: { lat: number; lon: number }, coords2: { lat: number; lon: number }): number => {
    const R = 6371e3; // metres
    const φ1 = coords1.lat * Math.PI / 180;
    const φ2 = coords2.lat * Math.PI / 180;
    const Δφ = (coords2.lat - coords1.lat) * Math.PI / 180;
    const Δλ = (coords2.lon - coords1.lon) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
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

const TeacherDashboard: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [enforceLocation, setEnforceLocation] = useState(true);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const sessionUrl = session ? `${window.location.origin}${window.location.pathname}?session_id=${session.id}` : '';
    const toast = useToast();

    const [campusLocation, setCampusLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [locationRadius, setLocationRadius] = useState(100);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    
    useEffect(() => {
        const savedLocation = localStorage.getItem(`maven-teacher-location-${user.id}`);
        if (savedLocation) {
            const parsed = JSON.parse(savedLocation);
            setCampusLocation({ lat: parsed.lat, lon: parsed.lon });
            setLocationRadius(parsed.radius || 100);
        }
    }, [user.id]);

    const handleSetCurrentLocation = () => {
        setIsFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCampusLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                });
                toast.success('Location fetched successfully!');
                setIsFetchingLocation(false);
            },
            (error: any) => {
                let message = "An unknown error occurred when fetching location.";
                if (error && typeof error === 'object' && 'code' in error) {
                    const geoError = error as GeolocationPositionError;
                    switch(geoError.code) {
                        case geoError.PERMISSION_DENIED:
                            message = "Permission to access location was denied. Please enable it in your browser settings.";
                            break;
                        case geoError.POSITION_UNAVAILABLE:
                            message = "Location information is currently unavailable. Check your connection or device settings.";
                            break;
                        case geoError.TIMEOUT:
                            message = "The request to get your location timed out. Please try again.";
                            break;
                        default:
                            message = geoError.message || "An unspecified location error occurred.";
                            break;
                    }
                } else if (error && error.message) {
                    message = error.message;
                } else if (error) {
                    message = String(error);
                }
                
                toast.error(`Geolocation error: ${message}`);
                console.error("Geolocation error object:", error);
                setIsFetchingLocation(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const saveCampusLocation = () => {
        if (campusLocation) {
            localStorage.setItem(`maven-teacher-location-${user.id}`, JSON.stringify({ ...campusLocation, radius: locationRadius }));
            toast.success('Campus location saved!');
        } else {
            toast.error('No location is set to be saved.');
        }
    };


    const handleStartSession = useCallback(async () => {
        if (session) return;
        
        const now = new Date();
        const expires = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
        const newSession: Session = {
            id: crypto.randomUUID(),
            created_at: now.toISOString(),
            expires_at: expires.toISOString(),
            teacher_id: user.id,
            is_active: true,
            session_code: Math.random().toString(36).substring(2, 7).toUpperCase(),
            location_enforced: enforceLocation,
        };
        setSession(newSession);

        const url = `${window.location.origin}${window.location.pathname}?session_id=${newSession.id}`;
        const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 2, scale: 6 });
        setQrCodeUrl(dataUrl);
    }, [session, user.id, enforceLocation]);

    const handleEndSession = useCallback(() => {
        setSession(null);
        setQrCodeUrl('');
    }, []);
    
    const copyToClipboard = (text: string, type: 'Code' | 'Link') => {
        navigator.clipboard.writeText(text).then(() => {
            setCopySuccess(`${type} copied!`);
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Failed to copy.');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    return (
        <div className="flex-1 p-6 sm:p-8 bg-background text-foreground overflow-y-auto">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user.name}!</p>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                    <LogOut size={16} /> Logout
                </button>
            </header>
            
             <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 space-y-8">
                    {/* Session Control */}
                    <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4">Attendance Session</h2>
                        {session ? (
                            <div className="flex flex-col sm:flex-row gap-6 items-center">
                                <div className="flex-1 text-center">
                                    <p className="text-muted-foreground">Session is active.</p>
                                    <div className="my-3 p-3 bg-secondary rounded-lg">
                                        <p className="text-xs text-muted-foreground">Ends in:</p>
                                        <Timer endTime={session.expires_at} onEnd={handleEndSession} />
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <p className="font-mono text-3xl tracking-widest bg-input p-2 rounded-md">{session.session_code}</p>
                                        <button onClick={() => copyToClipboard(session.session_code || '', 'Code')} title="Copy Code" className="p-2 bg-secondary rounded-md hover:bg-accent"><Copy size={16}/></button>
                                    </div>
                                    <button onClick={() => copyToClipboard(sessionUrl, 'Link')} className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto mt-2">
                                        <Copy size={12}/> Copy Check-in Link
                                    </button>
                                    {copySuccess && <p className="text-xs text-green-500 mt-1">{copySuccess}</p>}
                                    <button onClick={handleEndSession} className="mt-4 w-full bg-destructive text-destructive-foreground py-2 rounded-lg hover:bg-destructive/90">
                                        End Session
                                    </button>
                                </div>
                                <div className="flex-shrink-0">
                                     {qrCodeUrl && <img src={qrCodeUrl} alt="Session QR Code" className="w-48 h-48 mx-auto rounded-lg border-4 border-primary p-1" />}
                                     <div className={`mt-2 text-xs flex items-center justify-center gap-1 ${session.location_enforced ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {session.location_enforced ? <><ShieldCheck size={14}/> Location check is ON</> : <><ShieldCheck size={14} className="opacity-50"/> Location check is OFF</>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                                <p className="text-muted-foreground mb-4">Start a new 5-minute session for attendance.</p>
                                <div className="flex items-center gap-3 mb-6 bg-secondary p-3 rounded-lg">
                                    <label htmlFor="enforce-location" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                                        <MapPin size={16} className={`${enforceLocation ? 'text-primary' : 'text-muted-foreground'}`} />
                                        Enforce On-Campus Location
                                    </label>
                                    <button onClick={() => setEnforceLocation(!enforceLocation)}>
                                        {enforceLocation ? <ToggleRight size={32} className="text-primary"/> : <ToggleLeft size={32} className="text-muted-foreground"/>}
                                    </button>
                                </div>
                                <button onClick={handleStartSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 text-lg font-semibold">
                                    Start New Session
                                </button>
                            </div>
                        )}
                    </div>
                     {/* Location Settings */}
                    <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin /> Campus Location Settings</h2>
                        <div className="bg-secondary p-4 rounded-lg">
                            {campusLocation ? (
                                <div>
                                    <p className="text-sm font-medium text-foreground/80">Current Center Point:</p>
                                    <p className="font-mono text-xs text-muted-foreground">
                                        Lat: {campusLocation.lat.toFixed(6)}, Lon: {campusLocation.lon.toFixed(6)}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">No campus location set.</p>
                            )}

                            <div className="mt-4">
                                <label htmlFor="radius" className="text-sm font-medium text-foreground/80">Required Radius</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input id="radius" type="number" value={locationRadius} onChange={(e) => setLocationRadius(Math.max(10, parseInt(e.target.value, 10)))} className="bg-input border-border rounded-md px-3 py-1.5 w-28" />
                                    <span className="text-muted-foreground">meters</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                            <button onClick={handleSetCurrentLocation} disabled={isFetchingLocation} className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50">
                                {isFetchingLocation ? <><Loader size={16} className="animate-spin" /> Fetching...</> : <><RefreshCw size={16} /> Use My Location</>}
                            </button>
                            <button onClick={saveCampusLocation} disabled={!campusLocation} className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                                <Save size={16} /> Save Location
                            </button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-card border border-border p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold mb-4">Curriculum & Students</h2>
                    <p className="text-muted-foreground">Manage your daily topics and student roster here. (Feature coming soon)</p>
                </div>
            </div>
        </div>
    );
};

const StudentDashboard: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
    const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        // Request camera permission
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(() => setCameraPermission('granted'))
            .catch((err) => {
                console.error("Camera access error:", err);
                setCameraPermission('denied');
            });
        
        // Request location permission
        setLocationPermission('pending');
        navigator.geolocation.getCurrentPosition(
            () => {
                setLocationPermission('granted');
            },
            (error: any) => {
                let message = "An unknown error occurred while verifying location.";
                if (error && typeof error === 'object' && 'code' in error) {
                    const geoError = error as GeolocationPositionError;
                    switch(geoError.code) {
                        case geoError.PERMISSION_DENIED:
                            message = "Location access denied. Please enable location services in your browser settings to use the portal.";
                            break;
                        case geoError.POSITION_UNAVAILABLE:
                            message = "Your location is currently unavailable. Check your connection or device settings.";
                            break;
                        case geoError.TIMEOUT:
                            message = "The request to get your location timed out.";
                            break;
                        default:
                            message = geoError.message || "An unspecified location error occurred.";
                            break;
                    }
                } else if (error && error.message) {
                    message = error.message;
                } else if (error) {
                    message = String(error);
                }

                setLocationError(message);
                setLocationPermission('denied');
            },
            { enableHighAccuracy: true }
        );
    }, []);
    
    if (locationPermission === 'pending') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
                <div className="p-8 border border-border rounded-lg bg-card/50 text-center">
                    <Loader className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                    <h2 className="text-2xl font-bold mb-2">Requesting Location Access</h2>
                    <p className="text-muted-foreground max-w-sm">
                        Please grant location access. This is required for attendance check-in.
                    </p>
                </div>
            </div>
        );
    }

    if (locationPermission === 'denied') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
                <div className="p-8 border border-destructive/50 rounded-lg bg-destructive/10 text-center">
                    <MapPin className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2 text-destructive">Location Access Required</h2>
                    <p className="text-destructive/80 max-w-sm mb-4">
                        {locationError}
                    </p>
                    <p className="text-xs text-destructive/60">You may need to refresh the page after changing browser settings.</p>
                </div>
            </div>
        );
    }

    const CameraStatusIcon = () => {
        switch (cameraPermission) {
            case 'granted': return <CheckCircle className="text-green-400" />;
            case 'denied': return <AlertTriangle className="text-destructive" />;
            case 'pending':
            default: return <Loader className="animate-spin text-muted-foreground" />;
        }
    };

    const CameraStatusText = () => {
        switch (cameraPermission) {
            case 'granted': return "Camera is ready.";
            case 'denied': return "Camera access denied.";
            case 'pending':
            default: return "Requesting camera access...";
        }
    };

    return (
         <div className="flex-1 p-6 sm:p-8 bg-background text-foreground overflow-y-auto">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Student Dashboard</h1>
                    <p className="text-muted-foreground">Welcome, {user.name} ({user.enrollment_id})</p>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                    <LogOut size={16} /> Logout
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 bg-card border border-border p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold mb-4">Today's Curriculum</h2>
                     <div className="text-center py-12 text-muted-foreground">
                        <BookOpen size={32} className="mx-auto mb-4"/>
                        <p>Today's topics and activities will appear here.</p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4">Attendance Check-in</h2>
                        <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg mb-4">
                           <CameraStatusIcon />
                           <p className="text-sm font-medium"><CameraStatusText/></p>
                        </div>
                        {cameraPermission === 'granted' && (
                            <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 text-lg font-semibold">
                                <QrCode /> Scan QR Code
                            </button>
                        )}
                        {cameraPermission === 'denied' && (
                            <p className="text-xs text-destructive text-center">Please enable camera access in your browser settings to check in.</p>
                        )}
                         {cameraPermission === 'pending' && (
                            <div className="w-full bg-secondary text-muted-foreground py-3 rounded-lg flex items-center justify-center gap-2 text-lg font-semibold">
                                Waiting...
                            </div>
                        )}
                    </div>
                     <div className="bg-card border border-border p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4">My Schedule</h2>
                        <div className="text-center py-6 text-muted-foreground">
                           <Calendar size={24} className="mx-auto mb-2"/>
                            <p className="text-sm">Upcoming events will be shown here.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const StudentTeacherPortal: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [error, setError] = useState<string | null>(null);
    const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

    const handleLogin = async (email: string, pass: string): Promise<void> => {
        setError(null);
        if (!isSupabaseConfigured) {
            // Mock login
            await new Promise(res => setTimeout(res, 500)); // Simulate network delay
            const user = [MOCK_TEACHER, ...MOCK_STUDENTS].find(u => u.email === email && u.password === pass);
            if (user) {
                setCurrentUser(user);
            } else {
                setError("Invalid email or password.");
            }
            return;
        }
        // Placeholder for real Supabase logic
        setError("Supabase login not implemented.");
    };

    const handleRegister = async (details: NewUser): Promise<void> => {
         setError(null);
        if (!isSupabaseConfigured) {
            // Mock register
            await new Promise(res => setTimeout(res, 500)); // Simulate network delay
            const userExists = [MOCK_TEACHER, ...MOCK_STUDENTS].find(u => u.email === details.email);
            if (userExists) {
                setError("An account with this email already exists.");
                return;
            }
            const newUser: User = {
                id: Math.floor(Math.random() * 1000) + 300,
                created_at: new Date().toISOString(),
                ...details
            };
            setCurrentUser(newUser);
        }
        // Placeholder for real Supabase logic
        setError("Supabase registration not implemented.");
    };
    
    const handleLogout = () => {
        setCurrentUser(null);
        setViewMode('login');
    };

    if (!currentUser) {
        const AuthView = () => {
            switch(viewMode) {
                case 'signup':
                    return <SignUpView onRegister={handleRegister} error={error} setError={setError} setViewMode={setViewMode} />;
                // Add other views like 'forgot_password' here if implemented
                case 'login':
                default:
                    return <LoginView onLogin={handleLogin} error={error} setError={setError} setViewMode={setViewMode} pendingSessionId={pendingSessionId} />;
            }
        };

        return (
            <div className="flex-1 flex items-center justify-center bg-background p-4">
                <AuthView />
            </div>
        );
    }

    if (currentUser.role === 'teacher') {
        return <TeacherDashboard user={currentUser} onLogout={handleLogout} />;
    }

    if (currentUser.role === 'student') {
        return <StudentDashboard user={currentUser} onLogout={handleLogout} />;
    }

    // Fallback view, should ideally not be reached
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-4">
            <div className="text-center">
                <h2 className="text-xl font-bold">Student & Teacher Portal</h2>
                <p className="text-muted-foreground mt-2">
                    Loading portal...
                </p>
                { currentUser && <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-destructive text-destructive-foreground rounded-md">Log Out</button> }
            </div>
        </div>
    );
};