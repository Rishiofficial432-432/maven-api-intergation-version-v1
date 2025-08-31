

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CheckCircle, Clock, Loader, LogOut, Info, WifiOff, Users, GraduationCap, User as UserIcon, XCircle, Edit, Save, Plus, Trash2, Camera, Mail, Lock, BookOpen, Smartphone, ShieldCheck, X } from 'lucide-react';
import { supabase } from './firebase-config';

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
    // FIX: Updated teacher_id to be nullable to match database schema for better type safety.
    teacher_id: number | null;
    is_active: boolean;
}

// --- SUB-COMPONENTS ---

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


// --- VIEWS ---

const TeacherDashboard: React.FC<{ teacher: User, onLogout: () => void }> = ({ teacher, onLogout }) => {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [students, setStudents] = useState<User[]>([]);
    const [presentStudents, setPresentStudents] = useState<Set<number>>(new Set());
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingPhone, setEditingPhone] = useState('');
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnrollment, setNewStudentEnrollment] = useState('');
    const [newStudentPhone, setNewStudentPhone] = useState('');
    const [error, setError] = useState<string | null>(null);

    const loadStudents = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_users').select('*').eq('role', 'student').order('name');
        if (error) { console.error("Error fetching students:", error); }
        // FIX: Cast Supabase data to the local User type to resolve role property mismatch ('string' vs. 'student' | 'teacher').
        else { setStudents((data as User[]) || []); }
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

        if (error && error.code !== 'PGRST116') { // Ignore 'not found'
            console.error("Error fetching active session:", error);
            return;
        }

        if (data && new Date(data.expires_at).getTime() > Date.now()) {
            setActiveSession(data as Session);
            const url = `${window.location.origin}${window.location.pathname}?session=${data.id}`;
            QRCode.toDataURL(url, { width: 300, margin: 1 }).then(setQrCode);
        } else if (data) {
            // Expired session found, clean it up
            endSession(data.id);
        }
    }, [endSession]);

    useEffect(() => {
        loadStudents();
        checkActiveSession();
    }, [loadStudents, checkActiveSession]);
    
    useEffect(() => {
        if (!activeSession || !supabase) return;

        const fetchInitialAttendance = async () => {
            const { data, error } = await supabase.from('portal_attendance').select('student_id').eq('session_id', activeSession.id);
            if (error) { console.error("Error fetching initial attendance:", error); return; }
            setPresentStudents(new Set(data.map(d => d.student_id)));
        };
        fetchInitialAttendance();

        const channel = supabase.channel(`attendance-${activeSession.id}`);
        const subscription = channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_attendance', filter: `session_id=eq.${activeSession.id}`}, 
            (payload) => {
                setPresentStudents(prev => new Set(prev).add((payload.new as any).student_id));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeSession]);

    const startSession = async () => {
        if (!supabase) return;
        setIsStartingSession(true);
        // Ensure any old sessions are closed before starting a new one
        await supabase.from('portal_sessions').update({ is_active: false }).eq('is_active', true);

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes session
        
        const { data, error } = await supabase.from('portal_sessions').insert({ expires_at: expiresAt.toISOString(), teacher_id: teacher.id }).select().single();
        if (error || !data) {
            setError(`Failed to start session: ${error?.message || 'Could not retrieve session data.'}`);
            setIsStartingSession(false);
            return;
        }
        
        const url = `${window.location.origin}${window.location.pathname}?session=${data.id}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
        setQrCode(qrDataUrl);
        setActiveSession(data as Session);
        setPresentStudents(new Set());
        setIsStartingSession(false);
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!supabase || !newStudentName.trim() || !newStudentEnrollment.trim()) return;

        const { error } = await supabase.from('portal_users').insert({ name: newStudentName, enrollment_id: newStudentEnrollment, phone: newStudentPhone || null, role: 'student' });
        if (error) {
            setError(`Failed to add student: ${error.message}`);
        } else {
            setNewStudentName('');
            setNewStudentEnrollment('');
            setNewStudentPhone('');
            loadStudents();
        }
    };
    
    const handleSaveEdit = async (studentId: number) => {
        if (!supabase) return;
        const { error } = await supabase.from('portal_users').update({ name: editingName, phone: editingPhone || null }).eq('id', studentId);
        if (error) {
            setError(`Failed to update student: ${error.message}`);
        } else {
            setEditingStudentId(null);
            loadStudents();
        }
    };
    
    const handleDeleteStudent = async (studentId: number) => {
        if (!supabase || !window.confirm("Are you sure you want to delete this student? All their attendance records will be removed.")) return;
        const { error } = await supabase.from('portal_users').delete().eq('id', studentId);
        if (error) {
            setError(`Failed to delete student: ${error.message}`);
        } else {
            loadStudents();
        }
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
                        <Timer endTime={activeSession.expires_at} onEnd={() => checkActiveSession()} />
                    </div>
                    <button onClick={() => endSession()} className="mt-4 w-full bg-destructive text-destructive-foreground py-2 rounded-lg hover:bg-destructive/90 transition-colors">End Session</button>
                </>
            ) : (
                <>
                    <Users size={48} className="text-muted-foreground mb-4"/>
                    <p className="text-muted-foreground mb-4">Start a new 10-minute session to take attendance.</p>
                    <button onClick={startSession} disabled={isStartingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
                                        <button onClick={() => handleDeleteStudent(s.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16}/></button>
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

const StudentDashboard: React.FC<{ student: User, onLogout: () => void }> = ({ student, onLogout }) => {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanSuccess, setScanSuccess] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = "qr-reader";

    const startScan = useCallback(async () => {
        setScanResult(null);
        setScanError(null);
        setScanSuccess(null);
        setIsScanning(true);

        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length) {
                const qrScanner = new Html5Qrcode(scannerContainerId);
                scannerRef.current = qrScanner;

                await qrScanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText, decodedResult) => {
                        setScanResult(decodedText);
                        qrScanner.stop();
                        setIsScanning(false);
                    },
                    (errorMessage) => {
                        // This callback is called frequently, so we don't set error here to avoid flickering.
                    }
                ).catch(err => {
                    setScanError("Could not start scanner. Please grant camera permissions.");
                    setIsScanning(false);
                });
            } else {
                setScanError("No camera found on this device.");
                setIsScanning(false);
            }
        } catch (err) {
            setScanError("Failed to initialize camera. Please ensure you have a camera and have granted permissions.");
            setIsScanning(false);
        }
    }, []);

    useEffect(() => {
        return () => { // Cleanup on unmount
            if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
                scannerRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
            }
        };
    }, []);

    useEffect(() => {
        if (scanResult && supabase) {
            const markAttendance = async () => {
                try {
                    const url = new URL(scanResult);
                    const sessionId = url.searchParams.get('session');

                    if (!sessionId) {
                        setScanError("Invalid QR code. This is not a valid attendance session.");
                        return;
                    }

                    // Check if session is valid and active
                    const { data: session, error: sessionError } = await supabase
                        .from('portal_sessions')
                        .select('*')
                        .eq('id', sessionId)
                        .single();

                    if (sessionError || !session) {
                        setScanError("Session not found or has expired.");
                        return;
                    }
                    if (!session.is_active || new Date(session.expires_at).getTime() < Date.now()) {
                        setScanError("This attendance session is no longer active.");
                        return;
                    }

                    // FIX: Changed from deprecated `insert` with `upsert` option to the `upsert` method.
                    // Insert attendance record
                    const { error: insertError } = await supabase
                        .from('portal_attendance')
                        .upsert({ student_id: student.id, session_id: sessionId }); // Use upsert to prevent duplicates

                    if (insertError) {
                        setScanError(`Failed to mark attendance: ${insertError.message}`);
                    } else {
                        setScanSuccess(`Attendance marked successfully for session at ${new Date(session.created_at).toLocaleTimeString()}!`);
                    }
                } catch (e) {
                    setScanError("Invalid QR code format. Please scan a valid attendance code.");
                }
            };
            markAttendance();
        }
    }, [scanResult, student.id]);
    
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
                    {!isScanning && !scanSuccess && !scanError && (
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

                    {scanSuccess && (
                        <div className="flex flex-col items-center">
                            <CheckCircle size={64} className="text-green-500 mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Success!</h2>
                            <p className="text-muted-foreground mb-6">{scanSuccess}</p>
                             <button onClick={() => { setScanSuccess(null); setScanResult(null); }} className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg hover:bg-secondary/80">Scan Again</button>
                        </div>
                    )}
                    
                    {scanError && (
                         <div className="flex flex-col items-center">
                            <XCircle size={64} className="text-destructive mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Error</h2>
                            <p className="text-muted-foreground mb-6">{scanError}</p>
                            <button onClick={() => { setScanError(null); setScanResult(null); }} className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg hover:bg-secondary/80">Try Again</button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const Login: React.FC<{ onLogin: (user: User) => void, error: string | null, setError: (err: string | null) => void }> = ({ onLogin, error, setError }) => {
    const [email, setEmail] = useState('teacher@example.com');
    const [password, setPassword] = useState('password123');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        if (!supabase) {
            setError("Database is not connected.");
            setIsSubmitting(false);
            return;
        }

        const { data, error: dbError } = await supabase.from('portal_users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (dbError || !data) {
            setError("Invalid credentials or user not found.");
            setIsSubmitting(false);
            return;
        }

        // Note: This is a simple, insecure password check for demo purposes.
        // In a real application, you should use Supabase Auth with hashed passwords.
        if (data.password === password) {
            // FIX: Cast Supabase data to the local User type to resolve role property mismatch.
            onLogin(data as User);
        } else {
            setError("Invalid credentials or user not found.");
        }
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
                {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <div className="relative mt-1">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teacher@example.com" required className="w-full bg-input border-border rounded-md pl-9 pr-3 py-2" />
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
            </div>
        </div>
    );
};

const StudentTeacherPortal: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    const handleLogin = (loggedInUser: User) => {
        setUser(loggedInUser);
        sessionStorage.setItem('portalUser', JSON.stringify(loggedInUser));
    };

    const handleLogout = () => {
        setUser(null);
        sessionStorage.removeItem('portalUser');
    };
    
    useEffect(() => {
        const checkSession = () => {
            try {
                const storedUser = sessionStorage.getItem('portalUser');
                if (storedUser) {
                    setUser(JSON.parse(storedUser));
                }
            } catch (e) {
                console.error("Failed to parse user from session storage", e);
                sessionStorage.removeItem('portalUser');
            }
            setIsLoading(false);
        };
        checkSession();
    }, []);

    if (!supabase) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-secondary/30 text-center">
                 <div className="p-8 bg-card rounded-lg shadow-lg max-w-md">
                    <ShieldCheck size={48} className="mx-auto text-destructive mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Portal Offline</h1>
                    <p className="text-muted-foreground">The real-time Student & Teacher Portal is currently offline because it has not been configured correctly. Please refer to the setup instructions in the source code to enable this feature.</p>
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

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center bg-secondary/30"><Loader className="animate-spin text-primary" size={48}/></div>
    }

    if (!user) {
        return <Login onLogin={handleLogin} setError={setError} error={error} />;
    }

    if (user.role === 'teacher') {
        return <TeacherDashboard teacher={user} onLogout={handleLogout} />;
    } else {
        return <StudentDashboard student={user} onLogout={handleLogout} />;
    }
};

export default StudentTeacherPortal;
