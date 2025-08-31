import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CheckCircle, Clock, Loader, LogOut, Info, WifiOff, Users, GraduationCap, User as UserIcon, XCircle, Edit, Save, Plus, Trash2, Camera, Mail, Lock, BookOpen } from 'lucide-react';
import { supabase } from './firebase-config';

// --- TYPES ---
interface User {
    id: number;
    created_at: string;
    name: string;
    email: string | null;
    role: 'teacher' | 'student';
    enrollment_id: string | null;
    password?: string;
}

interface Session {
    id: string; // UUID
    created_at: string;
    expires_at: string;
    teacher_id: number;
    is_active: boolean;
}

// --- SUB-COMPONENTS ---

const Timer: React.FC<{ endTime: string }> = ({ endTime }) => {
    const [timeLeft, setTimeLeft] = useState(Math.max(0, new Date(endTime).getTime() - Date.now()));

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, new Date(endTime).getTime() - Date.now());
            setTimeLeft(remaining);
            if (remaining === 0) {
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime]);

    const minutes = Math.floor(timeLeft / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0');
    return <span className="font-mono">{minutes}:{seconds}</span>;
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
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnrollment, setNewStudentEnrollment] = useState('');
    const [error, setError] = useState<string | null>(null);

    const loadStudents = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_users').select('*').eq('role', 'student');
        if (error) { console.error("Error fetching students:", error); }
        else { setStudents(data || []); }
    }, []);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    const checkActiveSession = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('portal_sessions').select('*').eq('is_active', true).single();

        if (error && error.code !== 'PGRST116') { // Ignore 'not found'
            console.error("Error fetching active session:", error);
            return;
        }

        if (data && new Date(data.expires_at).getTime() > Date.now()) {
            setActiveSession(data);
            const url = `${window.location.origin}${window.location.pathname}?session=${data.id}`;
            QRCode.toDataURL(url, { width: 300, margin: 1 }).then(setQrCode);
        } else if (data) {
            await supabase.from('portal_sessions').update({ is_active: false }).eq('id', data.id);
        }
    }, []);

    useEffect(() => {
        checkActiveSession();
    }, [checkActiveSession]);
    
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
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        
        const { data, error } = await supabase.from('portal_sessions').insert({ expires_at: expiresAt.toISOString(), teacher_id: teacher.id }).select().single();
        if (error) {
            console.error("Failed to start session:", error);
            setIsStartingSession(false);
            return;
        }
        
        const url = `${window.location.origin}${window.location.pathname}?session=${data.id}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
        setQrCode(qrDataUrl);
        setActiveSession(data);
        setPresentStudents(new Set());
        setIsStartingSession(false);
    };

    const endSession = async () => {
        if (!supabase || !activeSession) return;
        await supabase.from('portal_sessions').update({ is_active: false }).eq('id', activeSession.id);
        setActiveSession(null);
        setQrCode(null);
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!supabase || !newStudentName.trim() || !newStudentEnrollment.trim()) return;

        const { error } = await supabase.from('portal_users').insert({ name: newStudentName, enrollment_id: newStudentEnrollment, role: 'student' });
        if (error) {
            setError(`Failed to add student: ${error.message}`);
            console.error(error);
        } else {
            setNewStudentName('');
            setNewStudentEnrollment('');
            loadStudents();
        }
    };
    
    const handleSaveEdit = async (studentId: number) => {
        if (!supabase) return;
        const { error } = await supabase.from('portal_users').update({ name: editingName }).eq('id', studentId);
        if(error) { console.error(error); } 
        else {
            setEditingStudentId(null);
            loadStudents();
        }
    }
    
    const handleDeleteStudent = async (studentId: number) => {
        if (!supabase || !window.confirm("Are you sure you want to delete this student? This cannot be undone.")) return;
        const { error } = await supabase.from('portal_users').delete().eq('id', studentId);
        if(error) { console.error(error); }
        else { loadStudents(); }
    }
    
    return (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-y-auto">
            <div className="relative lg:col-span-1 flex flex-col items-center justify-center bg-card border border-border rounded-xl p-6 text-center">
                <button onClick={onLogout} className="absolute top-4 right-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><LogOut size={14}/> Logout</button>
                <h2 className="text-xl font-bold mb-4">Attendance Session</h2>
                {activeSession ? (
                    <>
                        <div className="p-2 bg-white rounded-lg shadow-lg aspect-square w-full max-w-[250px] flex items-center justify-center mb-4">
                            {qrCode ? (
                                <img src={qrCode} alt="Attendance QR Code" className="w-full h-full" />
                            ) : (
                                <Loader className="animate-spin text-primary" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">Scan with any device to check in.</p>
                        <div className="my-2 flex items-center justify-center gap-2 text-lg font-semibold"><Clock size={20} /><Timer endTime={activeSession.expires_at} /></div>
                        <button onClick={endSession} className="mt-2 w-full bg-destructive text-destructive-foreground py-2 rounded-lg">End Session</button>
                    </>
                ) : isStartingSession ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader className="animate-spin text-primary w-10 h-10" />
                        <p className="text-muted-foreground">Generating Secure Session...</p>
                    </div>
                ) : (
                    <button onClick={startSession} className="bg-primary text-primary-foreground py-3 px-6 rounded-lg text-lg">Start New Session</button>
                )}
            </div>
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 flex flex-col">
                <h2 className="text-xl font-bold mb-4">Live Student Roster</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-center">
                    <div className="bg-secondary p-3 rounded-lg"><p className="text-2xl font-bold">{students.length}</p><p className="text-sm text-muted-foreground">Total Students</p></div>
                    <div className="bg-secondary p-3 rounded-lg"><p className="text-2xl font-bold text-green-500">{presentStudents.size}</p><p className="text-sm text-muted-foreground">Present</p></div>
                    <div className="bg-secondary p-3 rounded-lg"><p className="text-2xl font-bold text-destructive">{students.length - presentStudents.size}</p><p className="text-sm text-muted-foreground">Absent</p></div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
                    {students.map(student => {
                        const isPresent = presentStudents.has(student.id!);
                        const isEditing = editingStudentId === student.id;
                        return (
                            <div key={student.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-300 ${isPresent ? 'bg-green-500/10' : 'bg-secondary/50'}`}>
                                {isEditing ? (
                                    <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="bg-input border-border rounded-md px-2 py-1 text-sm" autoFocus/>
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="font-medium">{student.name}</span>
                                        <span className="text-xs text-muted-foreground">{student.enrollment_id}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <button onClick={() => handleSaveEdit(student.id)} className="p-1.5 hover:bg-accent rounded-md"><Save size={16} className="text-primary"/></button>
                                    ) : (
                                        <button onClick={() => { setEditingStudentId(student.id); setEditingName(student.name); }} className="p-1.5 hover:bg-accent rounded-md"><Edit size={16}/></button>
                                    )}
                                    <button onClick={() => handleDeleteStudent(student.id)} className="p-1.5 hover:bg-accent rounded-md"><Trash2 size={16} className="text-destructive"/></button>
                                    {isPresent ? <CheckCircle className="text-green-500" /> : <XCircle className="text-muted-foreground" />}
                                </div>
                            </div>
                        )
                    })}
                </div>
                 <form onSubmit={handleAddStudent} className="flex flex-wrap gap-2 pt-4 border-t border-border">
                    <h3 className="text-md font-semibold w-full mb-1">Add New Student</h3>
                     {error && <p className="text-destructive text-sm w-full">{error}</p>}
                    <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Student name" required className="flex-1 min-w-[150px] bg-input border-border rounded-md px-3 py-2"/>
                    <input type="text" value={newStudentEnrollment} onChange={e => setNewStudentEnrollment(e.target.value)} placeholder="Enrollment ID" required className="flex-1 min-w-[150px] bg-input border-border rounded-md px-3 py-2"/>
                    <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-1"><Plus size={16}/> Add</button>
                </form>
            </div>
        </div>
    );
};


const AuthScreen: React.FC<{ onLogin: (user: User) => void, onDbError: () => void }> = ({ onLogin, onDbError }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        if (!supabase) { setError("Supabase client not available."); setIsLoading(false); return; }

        const handleSupabaseError = (err: any) => {
            if (err && (err.code === '42P01' || err.message.includes('does not exist'))) {
                onDbError();
                return true; 
            }
            return false;
        };

        try {
            if (mode === 'login') {
                const { data, error: fetchError } = await supabase.from('portal_users').select('*').eq('email', email).eq('role', 'teacher').single();
                if (fetchError) throw fetchError;
                if (!data || data.password !== password) {
                    setError("Invalid credentials or user not found.");
                } else {
                    onLogin(data as User);
                }
            } else { // Register
                if (!name.trim()) {
                    setError("Name field is required for registration.");
                    setIsLoading(false);
                    return;
                }
                const { data, error: insertError } = await supabase.from('portal_users').insert({ name, email, password, role: 'teacher' }).select().single();
                if (insertError) throw insertError;
                if (data) onLogin(data);
            }
        } catch (err: any) {
            if (handleSupabaseError(err)) return; // Stop if it's a DB setup error
            if (err.code === '23505') {
                setError("An account with this email already exists.");
            } else {
                setError(`An error occurred: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(prev => prev === 'login' ? 'register' : 'login');
        setError(null);
        setName('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="flex items-center justify-center h-full">
            <div className="w-full max-w-sm bg-card border border-border rounded-xl p-8 text-center">
                <Users size={40} className="text-primary mx-auto mb-4"/>
                <h1 className="text-2xl font-bold mb-2">{mode === 'login' ? 'Teacher Portal Login' : 'Create Teacher Account'}</h1>
                <p className="text-muted-foreground mb-6">{mode === 'login' ? 'Enter your credentials to continue' : 'Fill out the form to get started'}</p>
                <form onSubmit={handleAuthAction} className="space-y-4 text-left">
                    {mode === 'register' && (
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Full Name" className="w-full bg-input border-border rounded-md pl-10 pr-3 py-2 mt-1"/>
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email Address" className="w-full bg-input border-border rounded-md pl-10 pr-3 py-2 mt-1"/>
                    </div>
                     <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" className="w-full bg-input border-border rounded-md pl-10 pr-3 py-2 mt-1"/>
                    </div>
                     {error && <p className="text-destructive text-sm text-center">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center">
                        {isLoading ? <Loader className="animate-spin"/> : (mode === 'login' ? 'Login' : 'Register')}
                    </button>
                </form>
                <div className="mt-4 text-center text-sm">
                    {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={toggleMode} className="text-primary font-semibold hover:underline">
                        {mode === 'login' ? "Register" : "Login"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const StudentCheckinFlow: React.FC = () => {
    const [view, setView] = useState<'scan' | 'register' | 'status'>('scan');
    const [statusInfo, setStatusInfo] = useState({ title: '', message: '', type: 'loading' as 'loading' | 'success' | 'info' | 'error' });
    const [scannedSessionId, setScannedSessionId] = useState<string | null>(null);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    const markAttendance = useCallback(async (student: User, sessionId: string) => {
        if(!supabase) return;
        setStatusInfo({ title: 'Marking Attendance...', message: 'Please wait...', type: 'loading' });
        setView('status');

        const { data: sessionData, error: sessionError } = await supabase.from('portal_sessions').select('id').eq('id', sessionId).eq('is_active', true).single();
        if (sessionError || !sessionData) {
            setStatusInfo({ title: 'Session Invalid', message: "This attendance session is invalid or has expired.", type: 'error' });
            return;
        }

        const { error: insertError } = await supabase.from('portal_attendance').insert({ session_id: sessionId, student_id: student.id });
        if (insertError) {
             if (insertError.code === '23505') { // unique constraint violation
                setStatusInfo({ title: 'Already Marked!', message: 'Your attendance for this session has already been recorded.', type: 'info' });
             } else {
                setStatusInfo({ title: 'Error', message: insertError.message, type: 'error' });
             }
        } else {
            setStatusInfo({ title: 'Attendance Confirmed!', message: "You're all set. Your teacher has been notified.", type: 'success' });
        }
    }, []);

    useEffect(() => {
        if (view !== 'scan' || !isScanning) {
            return;
        }

        const qrScanner = new Html5Qrcode("qr-reader");
        scannerRef.current = qrScanner;
        let didScan = false;

        const onScanSuccess = (decodedText: string) => {
            if (didScan) return;
            didScan = true;

            qrScanner.stop()
                .then(() => {
                    setIsScanning(false);
                    try {
                        const url = new URL(decodedText);
                        const sessionId = url.searchParams.get('session');
                        if (sessionId) {
                            setScannedSessionId(sessionId);
                            const storedStudent = localStorage.getItem('portal-student-profile');
                            if (storedStudent) {
                                markAttendance(JSON.parse(storedStudent), sessionId);
                            } else {
                                setView('register');
                            }
                        } else {
                             setScannerError("The scanned QR code is not a valid session link.");
                             setIsScanning(false);
                        }
                    } catch (e) {
                        console.warn("Scanned QR is not a valid URL.");
                        setScannerError("The scanned QR code is not a valid session link.");
                        setIsScanning(false);
                    }
                })
                .catch(err => {
                    console.error("Failed to stop scanner after success", err);
                    setIsScanning(false);
                });
        };
        
        qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, undefined)
            .catch(err => {
                console.error("QR Scanner Error:", err);
                let errorMessage = "An error occurred while starting the camera. Please try again.";
                if (err.name === 'NotAllowedError' || err.toString().includes('Permission')) {
                    errorMessage = "Camera permission was denied. To use the scanner, please go to your browser's site settings and grant camera access for this page.";
                } else if (err.name === 'NotFoundError') {
                     errorMessage = "No camera found on this device. Please use a device with a camera.";
                }
                setScannerError(errorMessage);
                setIsScanning(false);
            });

        return () => {
            if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
                scannerRef.current.stop().catch(e => console.error("Error stopping scanner", e));
            }
        };
    }, [view, isScanning, markAttendance]);

    const handleRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!supabase || !scannedSessionId) return;
        
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const enrollmentId = formData.get('enrollment_id') as string;

        setView('status');
        setStatusInfo({ title: 'Registering...', message: 'Creating your profile...', type: 'loading' });
        
        const { data: userData, error: userError } = await supabase.from('portal_users').upsert({ name, enrollment_id: enrollmentId, role: 'student' }, { onConflict: 'enrollment_id' }).select().single();
        
        if (userError || !userData) {
            setStatusInfo({ title: 'Registration Failed', message: userError?.message || 'Could not create or find your profile.', type: 'error' });
            return;
        }

        localStorage.setItem('portal-student-profile', JSON.stringify(userData));
        await markAttendance(userData, scannedSessionId);
    };

    const statusIcons: Record<typeof statusInfo.type, React.ReactNode> = {
        loading: <Loader className="animate-spin text-primary" />,
        success: <CheckCircle className="text-green-500" />,
        info: <Info className="text-blue-500" />,
        error: <XCircle className="text-destructive" />,
    };

    return (
        <div className="flex items-center justify-center h-full">
            <div className={`w-full max-w-sm bg-card border border-border rounded-xl p-8 text-center transition-all duration-300 ${statusInfo.type === 'success' ? 'border-green-500/50' : statusInfo.type === 'error' ? 'border-destructive/50' : ''}`}>
                {view === 'scan' && (
                    <>
                        <Camera size={40} className="text-primary mx-auto mb-4"/>
                        <h1 className="text-2xl font-bold mb-2">Scan QR Code</h1>
                        <p className="text-muted-foreground mb-4">Point your camera at the QR code displayed by your teacher.</p>
                        {isScanning ? (
                            <div id="qr-reader" className="w-full rounded-lg overflow-hidden border border-border"></div>
                        ) : (
                             <button onClick={() => { setIsScanning(true); setScannerError(null); }} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg">
                                Start Scanning
                            </button>
                        )}
                        {scannerError && (
                            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg text-center">
                                <p>{scannerError}</p>
                            </div>
                        )}
                    </>
                )}
                {view === 'register' && (
                     <>
                        <UserIcon size={40} className="text-primary mx-auto mb-4"/>
                        <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
                        <p className="text-muted-foreground mb-6">Let's get you checked in. Please enter your details.</p>
                        <form onSubmit={handleRegistration} className="space-y-4 text-left">
                            <div>
                                <label className="text-sm font-medium">Full Name</label>
                                <input name="name" type="text" required className="w-full bg-input border-border rounded-md px-3 py-2 mt-1"/>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Enrollment / Student ID</label>
                                <input name="enrollment_id" type="text" required className="w-full bg-input border-border rounded-md px-3 py-2 mt-1"/>
                            </div>
                            <button type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg">Submit & Check In</button>
                        </form>
                    </>
                )}
                {view === 'status' && (
                    <>
                        <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center text-5xl transform scale-100 transition-transform duration-500 ease-out">{statusIcons[statusInfo.type]}</div>
                        <h1 className="text-2xl font-bold mb-2">{statusInfo.title}</h1>
                        <p className="text-muted-foreground mb-6 min-h-10">{statusInfo.message}</p>
                        {statusInfo.type !== 'loading' && (
                            <button onClick={() => { setView('scan'); setIsScanning(false); setScannerError(null); }} className="w-full bg-secondary hover:bg-accent py-2.5 rounded-lg">Scan Again</button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};


const SupabaseErrorScreen: React.FC<{
    missingTables: string[],
    onCheckAgain: () => void,
    isChecking: boolean
}> = ({ missingTables, onCheckAgain, isChecking }) => (
    <div className="flex items-center justify-center h-full p-4">
        <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-8">
            <div className="text-center">
                <WifiOff size={48} className="text-destructive mx-auto mb-4"/>
                <h1 className="text-2xl font-bold mb-2">Supabase Database Setup Required</h1>
                <p className="text-muted-foreground mb-6">The application is missing required database tables. Please run the SQL script below in your Supabase project's SQL Editor to set them up.</p>
                {missingTables.length > 0 && (
                    <div className="mb-6 text-left bg-secondary p-4 rounded-lg">
                        <h3 className="font-semibold text-foreground mb-2">Detected Missing Tables:</h3>
                        <ul className="list-disc list-inside text-destructive text-sm space-y-1">
                            {missingTables.map(table => <li key={table}><code>{table}</code></li>)}
                        </ul>
                    </div>
                )}
            </div>
            <ol className="text-left text-muted-foreground space-y-4 text-sm">
                <li>
                    <strong>Run this SQL Script:</strong> Copy the entire script below and run it in your Supabase project's <a href="https://app.supabase.com/project/_/sql" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">SQL Editor</a>.
                    <pre className="text-xs bg-secondary text-left p-3 rounded-md mt-2 overflow-x-auto">
                        {`-- This script will RESET your portal database.
-- It deletes any existing portal tables and data before recreating them.

-- Drop existing tables and policies to ensure a clean slate
DROP POLICY IF EXISTS "Enable public access" ON public.portal_attendance;
DROP POLICY IF EXISTS "Enable public access" ON public.portal_sessions;
DROP POLICY IF EXISTS "Enable public access" ON public.portal_users;

DROP TABLE IF EXISTS public.portal_attendance CASCADE;
DROP TABLE IF EXISTS public.portal_sessions CASCADE;
DROP TABLE IF EXISTS public.portal_users CASCADE;

-- Create a table for users (teachers and students)
CREATE TABLE public.portal_users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  enrollment_id TEXT,
  password TEXT
);
CREATE UNIQUE INDEX idx_unique_enrollment ON public.portal_users (enrollment_id) WHERE role = 'student';

-- Create a table for attendance sessions
CREATE TABLE public.portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  teacher_id BIGINT REFERENCES public.portal_users(id),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create a table for attendance records
CREATE TABLE public.portal_attendance (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id UUID REFERENCES public.portal_sessions(id) ON DELETE CASCADE,
  student_id BIGINT REFERENCES public.portal_users(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Insert a default teacher for the demo. Password is 'password123'
INSERT INTO public.portal_users (name, email, role, password) VALUES ('Teacher Demo', 'teacher@demo.com', 'teacher', 'password123');

-- Enable Row Level Security (RLS) and create public policies for the demo
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable public access" ON public.portal_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable public access" ON public.portal_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable public access" ON public.portal_attendance FOR ALL USING (true) WITH CHECK (true);`}
                    </pre>
                </li>
            </ol>
            <div className="mt-6 text-center">
                <button
                    onClick={onCheckAgain}
                    disabled={isChecking}
                    className="bg-primary text-primary-foreground py-2.5 px-6 rounded-lg disabled:opacity-50 flex items-center justify-center w-48 mx-auto"
                >
                    {isChecking ? <Loader className="animate-spin"/> : 'Check Again'}
                </button>
            </div>
        </div>
    </div>
);

const AboutPortalView: React.FC = () => {
    const InfoCard: React.FC<{ icon: React.ReactNode, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">{icon}</div>
                <h3 className="text-xl font-bold text-foreground">{title}</h3>
            </div>
            <div className="space-y-3 text-muted-foreground">{children}</div>
        </div>
    );

    const Step: React.FC<{ num: number, title: string, children: React.ReactNode }> = ({ num, title, children }) => (
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-secondary text-secondary-foreground rounded-full font-bold">{num}</div>
            <div>
                <h4 className="font-semibold text-foreground/90">{title}</h4>
                <p className="text-sm">{children}</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-8">
            <div className="text-center">
                 <BookOpen size={48} className="text-primary mx-auto mb-4"/>
                <h1 className="text-3xl font-bold">About the Attendance Portal</h1>
                <p className="text-muted-foreground mt-2">A secure, real-time solution for classroom attendance.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InfoCard icon={<GraduationCap size={24}/>} title="For Teachers">
                    <Step num={1} title="Start a Session">Click 'Start New Session' to generate a unique, time-limited QR code.</Step>
                    <Step num={2} title="Display QR Code">Students scan this code from your screen to check in.</Step>
                    <Step num={3} title="Live Roster">Your student roster updates in real-time as students check in. Instantly see who's present.</Step>
                    <Step num={4} title="Manage Students">Easily add, edit, or remove students directly from your dashboard.</Step>
                </InfoCard>
                 <InfoCard icon={<UserIcon size={24}/>} title="For Students">
                    <Step num={1} title="Scan the Code">Use your phone's camera to scan the QR code your teacher displays.</Step>
                    <Step num={2} title="One-Time Registration">The first time, you'll enter your name and ID. The app securely remembers you on this device.</Step>
                    <Step num={3} title="Instant Check-in">After that, just scan the code, and you're instantly marked as 'Present'. You'll see a confirmation.</Step>
                    <Step num={4} title="No App Needed">Everything works in your phone's web browser, no downloads required.</Step>
                </InfoCard>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
type PortalTab = 'teacher' | 'student' | 'about';

const StudentTeacherPortal: React.FC = () => {
    const [activeTab, setActiveTab] = useState<PortalTab>('teacher');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupabaseError, setIsSupabaseError] = useState(false);
    const [missingTables, setMissingTables] = useState<string[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    const checkTables = useCallback(async () => {
        if (!supabase) {
            setIsSupabaseError(true);
            setMissingTables(['portal_users', 'portal_sessions', 'portal_attendance']);
            return false;
        }
        setIsChecking(true);

        const tableNames = ['portal_users', 'portal_sessions', 'portal_attendance'];
        const checks = await Promise.all(
            tableNames.map(name => supabase.from(name).select('id', { count: 'exact', head: true }))
        );

        const currentMissingTables: string[] = [];
        checks.forEach((result, index) => {
            if (result.error) {
                console.warn(`Table check failed for '${tableNames[index]}':`, result.error.message);
                currentMissingTables.push(tableNames[index]);
            }
        });

        setIsChecking(false);
        if (currentMissingTables.length > 0) {
            setIsSupabaseError(true);
            setMissingTables(currentMissingTables);
            return false;
        } else {
            setIsSupabaseError(false);
            setMissingTables([]);
            return true;
        }
    }, []);

    useEffect(() => {
        checkTables().then((isOk) => {
            if (isOk) {
                try {
                    const storedUser = localStorage.getItem('portal-currentUser');
                    if (storedUser) {
                        const user: User = JSON.parse(storedUser);
                        if (user.role === 'teacher') {
                            setCurrentUser(user);
                        }
                    }
                    const params = new URLSearchParams(window.location.search);
                    if(params.has('session')) {
                        setActiveTab('student');
                    }
                } catch (e) { console.error("Error reading initial state:", e); }
            }
        }).finally(() => {
            setIsLoading(false);
        });
    }, [checkTables]);

    const handleLogin = (user: User) => {
        localStorage.setItem('portal-currentUser', JSON.stringify(user));
        setCurrentUser(user);
    };

    const handleLogout = () => {
        localStorage.removeItem('portal-currentUser');
        setCurrentUser(null);
    };
    
    const navItems: { id: PortalTab; label: string; icon: React.ReactNode }[] = [
        { id: 'teacher', label: 'Teacher Portal', icon: <GraduationCap size={18}/> },
        { id: 'student', label: 'Student Check-in', icon: <UserIcon size={18}/> },
        { id: 'about', label: 'About', icon: <Info size={18}/> },
    ];
    
    const renderContent = () => {
        if (activeTab === 'student') return <StudentCheckinFlow />;
        if (activeTab === 'about') return <AboutPortalView />;
        if (activeTab === 'teacher') {
             if (currentUser?.role === 'teacher') {
                return <TeacherDashboard teacher={currentUser} onLogout={handleLogout} />;
            }
            return <AuthScreen onLogin={handleLogin} onDbError={checkTables} />;
        }
        return null;
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><Loader className="animate-spin w-8 h-8" /></div>
    }

    if (isSupabaseError) {
        return <SupabaseErrorScreen missingTables={missingTables} onCheckAgain={checkTables} isChecking={isChecking} />;
    }

    return (
        <div className="flex flex-col h-full bg-background p-4 sm:p-6">
            <div className="flex justify-center mb-6 border-b border-border">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                        ${activeTab === item.id 
                            ? 'border-primary text-primary' 
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>
        </div>
    );
};

export default StudentTeacherPortal;