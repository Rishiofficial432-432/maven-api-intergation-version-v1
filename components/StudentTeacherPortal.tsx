import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PortalUser, CurriculumFile } from '../types';
import * as Portal from './portal-supabase';
import * as LocalPortal from './portal-db';
import { supabase } from './supabase-config';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, Download, QrCode, UploadCloud, FileText, Check, GraduationCap } from 'lucide-react';
import { useToast } from './Toast';
import QRCode from 'qrcode';
import { Session } from '@supabase/supabase-js';

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

const isGpsLocation = (location: any): location is { latitude: number; longitude: number } => {
    return location && typeof location.latitude === 'number' && typeof location.longitude === 'number';
};


// --- DASHBOARDS ---
const TeacherDashboard: React.FC<{ user: PortalUser, onLogout: () => void, isDemo?: boolean }> = ({ user, onLogout, isDemo }) => {
    const [activeSession, setActiveSession] = useState<Portal.Session | LocalPortal.PortalSession | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [liveAttendance, setLiveAttendance] = useState<(Portal.AttendanceRecord | LocalPortal.PortalAttendanceRecord)[]>([]);
    const [locationEnforced, setLocationEnforced] = useState(false);
    const [radius, setRadius] = useState(50);
    const [startingSession, setStartingSession] = useState(false);
    const [pendingStudents, setPendingStudents] = useState<PortalUser[]>([]);
    const [loadingApprovals, setLoadingApprovals] = useState(true);
    const [curriculumFiles, setCurriculumFiles] = useState<any[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const toast = useToast();
    const PortalAPI = isDemo ? LocalPortal : Portal;

    const fetchDashboardData = useCallback(async () => {
        setLoadingApprovals(true);
        try {
            const [students, files, session] = await Promise.all([
                PortalAPI.getPendingStudents(),
                PortalAPI.getCurriculumFiles(),
                PortalAPI.getActiveSession()
            ]);
            setPendingStudents(students);
            setCurriculumFiles(files);
            if (session) {
                setActiveSession(session);
                const attendance = await PortalAPI.getAttendanceForSession(session.id);
                setLiveAttendance(attendance);
            }
        } catch (error: any) {
            toast.error(`Failed to load data: ${error.message}`);
        } finally {
            setLoadingApprovals(false);
        }
    }, [toast, isDemo, PortalAPI]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
     useEffect(() => {
        if (!activeSession || !supabase || isDemo) return;

        const channel = supabase.channel(`attendance-${activeSession.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_attendance', filter: `session_id=eq.${activeSession.id}`}, 
            (payload) => {
                const newRecord = payload.new as Portal.AttendanceRecord;
                toast.success(`${newRecord.student_name} just checked in!`);
                setLiveAttendance(prev => [newRecord, ...prev]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeSession, toast, isDemo]);


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
            
            if (isDemo) {
                const sessionData: LocalPortal.PortalSession = {
                    id: crypto.randomUUID(),
                    teacher_id: user.id,
                    session_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                    is_active: true,
                    location_enforced: locationEnforced,
                    radius: radius,
                    location: location
                };
                await (PortalAPI as typeof LocalPortal).createSession(sessionData);
                setActiveSession(sessionData);
                setLiveAttendance([]);
            } else {
                const newSession = await (PortalAPI as typeof Portal).startSession({ teacherId: user.id, locationEnforced, radius, location });
                setActiveSession(newSession);
            }

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
            await PortalAPI.endActiveSession();
            setActiveSession(null);
            setLiveAttendance([]);
            setQrCodeUrl('');
            toast.info("Session has been ended.");
        } catch (error: any) {
            toast.error(error.message);
        }
    };
    
    const handleApproveStudent = async (studentId: string) => {
        try {
            await PortalAPI.approveStudent(studentId);
            setPendingStudents(p => p.filter(s => s.id !== studentId));
            toast.success("Student approved!");
        } catch (error: any) {
            toast.error(`Failed to approve student: ${error.message}`);
        }
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
            if (isDemo) {
                const fileInfo = { id: crypto.randomUUID(), teacherId: user.id, teacherName: user.name, fileName: file.name, fileType: file.type, createdAt: new Date().toISOString() };
                await (PortalAPI as typeof LocalPortal).addCurriculumFile(fileInfo, file);
            } else {
                await (PortalAPI as typeof Portal).uploadCurriculumFile(user.id, user.name, file);
            }
            const files = await PortalAPI.getCurriculumFiles();
            setCurriculumFiles(files);
            toast.success("File uploaded successfully.");
        } catch(err: any) {
            toast.error(`Upload failed: ${err.message}`);
        } finally {
            setUploadingFile(false);
        }
    };
    
    const handleFileDelete = async (fileId: string, storagePath?: string) => {
        if(window.confirm("Are you sure you want to delete this file?")) {
            try {
                if(isDemo) {
                     await (PortalAPI as typeof LocalPortal).deleteCurriculumFile(fileId);
                } else {
                     await (PortalAPI as typeof Portal).deleteCurriculumFile(fileId, storagePath!);
                }
                setCurriculumFiles(f => f.filter(file => file.id !== fileId));
                toast.success("File deleted.");
            } catch (error: any) {
                toast.error(`Failed to delete file: ${error.message}`);
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20 text-foreground">
            <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold">Teacher Command Center {isDemo && <span className="text-sm font-normal text-primary">(Demo Mode)</span>}</h1>
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
                                {locationEnforced && ( <div className="p-3 bg-secondary rounded-lg"><label htmlFor="radius-slider" className="font-semibold">Check-in Radius: <span className="text-primary font-bold">{radius}m</span></label><input id="radius-slider" type="range" min="10" max="500" step="10" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer mt-2"/></div>)}
                                <button onClick={handleStartSession} disabled={startingSession} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {startingSession ? <><Loader className="animate-spin"/> Starting...</> : 'Start New Session'}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div className="text-center bg-gray-900 rounded-lg p-2"><img src={qrCodeUrl} alt="QR Code" className="w-full max-w-[200px] mx-auto rounded-md"/></div>
                                <div className="space-y-3">
                                    <div className="p-3 bg-secondary rounded-lg"><p className="text-sm text-muted-foreground">Session PIN</p><div className="flex items-center justify-between"><p className="text-3xl font-mono tracking-widest">{activeSession.session_code}</p><button onClick={() => { activeSession.session_code && navigator.clipboard.writeText(activeSession.session_code); toast.success("PIN Copied!"); }} className="p-2 hover:bg-accent rounded-md"><Copy size={18}/></button></div></div>
                                    {activeSession.location_enforced && isGpsLocation(activeSession.location) && (<div className="p-3 bg-secondary rounded-lg"><p className="text-sm font-semibold text-green-400 flex items-center gap-1"><ShieldCheck size={14}/> Location Enforcement: ON</p><p className="text-xs font-mono text-muted-foreground">Lat: {activeSession.location.latitude.toFixed(5)}, Lon: {activeSession.location.longitude.toFixed(5)}</p></div>)}
                                    <button onClick={handleEndSession} className="w-full bg-destructive/80 hover:bg-destructive text-destructive-foreground py-2 rounded-lg font-semibold">End Session</button>
                                </div>
                            </div>
                        )}
                    </div>
                    {activeSession && (
                        <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
                            <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">Live Attendance Feed {isDemo && <button onClick={fetchDashboardData} className="text-primary text-sm p-1 rounded-md hover:bg-accent"><RefreshCw size={14}/></button>}</h2>
                            <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                                <div className="bg-secondary p-3 rounded-lg">
                                    <p className="text-2xl font-bold text-green-400">{liveAttendance.length}</p>
                                    <p className="text-xs text-muted-foreground">Checked In</p>
                                </div>
                                <div className="bg-secondary p-3 rounded-lg">
                                    <p className="text-2xl font-bold text-yellow-400">{pendingStudents.length}</p>
                                    <p className="text-xs text-muted-foreground">Pending Approval</p>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                {liveAttendance.length > 0 ? liveAttendance.map(record => (
                                    <div key={(record as any).id} className="bg-secondary p-3 rounded-md flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-semibold">{record.student_name}</p>
                                            <p className="text-xs text-muted-foreground">{record.enrollment_id}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{new Date(record.created_at).toLocaleTimeString()}</span>
                                    </div>
                                )) : <p className="text-center text-muted-foreground py-4">Waiting for students to check in...</p>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-4">Pending Approvals</h2>
                        {loadingApprovals ? <Loader className="animate-spin" /> : (
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                {pendingStudents.length > 0 ? pendingStudents.map(student => (
                                    <div key={student.id} className="bg-secondary p-3 rounded-md flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{student.name}</p>
                                            <p className="text-xs text-muted-foreground">{student.email}</p>
                                        </div>
                                        <button onClick={() => handleApproveStudent(student.id)} className="px-3 py-1 bg-green-500/20 text-green-300 rounded-md text-xs">Approve</button>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center">No students pending approval.</p>}
                            </div>
                        )}
                    </div>
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-4">Curriculum Files</h2>
                        <label className={`w-full text-center cursor-pointer bg-primary/10 text-primary px-4 py-3 rounded-md text-sm font-semibold block mb-4 border-2 border-dashed border-primary/20 hover:bg-primary/20`}>
                            <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploadingFile} />
                            {uploadingFile ? <><Loader size={16} className="animate-spin inline-block mr-2"/> Uploading...</> : <><UploadCloud size={16} className="inline-block mr-2"/> Upload New File</>}
                        </label>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                            {curriculumFiles.map(file => (
                                <div key={file.id} className="bg-secondary p-3 rounded-md flex justify-between items-center text-sm">
                                    <div className="overflow-hidden">
                                        <p className="font-semibold truncate">{file.file_name}</p>
                                        <p className="text-xs text-muted-foreground">by {file.teacher_name}</p>
                                    </div>
                                    <button onClick={() => handleFileDelete(file.id, file.storage_path)} className="text-destructive/70 hover:text-destructive flex-shrink-0 ml-2"><Trash2 size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const StudentDashboard: React.FC<{ user: PortalUser, onLogout: () => void, isDemo?: boolean }> = ({ user, onLogout, isDemo }) => {
    const [sessionCode, setSessionCode] = useState('');
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [curriculumFiles, setCurriculumFiles] = useState<any[]>([]);
    const toast = useToast();
    const PortalAPI = isDemo ? LocalPortal : Portal;

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const files = await PortalAPI.getCurriculumFiles();
                setCurriculumFiles(files);
            } catch (error: any) {
                toast.error(`Failed to load files: ${error.message}`);
            }
        };
        fetchFiles();
    }, [toast, isDemo, PortalAPI]);

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionCode.trim()) {
            toast.error("Please enter a session code.");
            return;
        }
        setIsCheckingIn(true);

        try {
            const activeSession = await PortalAPI.getActiveSession();
            if (!activeSession || activeSession.session_code?.toLowerCase() !== sessionCode.trim().toLowerCase()) {
                throw new Error("Invalid or expired session code.");
            }
            if (activeSession.location_enforced) {
                const studentLocation = await new Promise<{ latitude: number, longitude: number }>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        (err) => reject(new Error(getGeolocationErrorMessage(err)))
                    );
                });
                
                if (isGpsLocation(activeSession.location)) {
                     const distance = getDistance(
                        studentLocation.latitude, studentLocation.longitude,
                        activeSession.location.latitude, activeSession.location.longitude
                    );
                    if (distance > (activeSession.radius || 100)) {
                        throw new Error(`You are too far from the class. (${Math.round(distance)}m away)`);
                    }
                } else {
                     throw new Error("Teacher's location is not available for this session.");
                }
            }
            
            await PortalAPI.logAttendance({
                session_id: activeSession.id,
                student_id: user.id,
                student_name: user.name,
                enrollment_id: user.enrollment_id
            });

            toast.success("Successfully checked in!");
            setSessionCode('');

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsCheckingIn(false);
        }
    };
    
    const handleFileDownload = async (file: any) => {
        try {
            if (isDemo) {
                const blob = await (PortalAPI as typeof LocalPortal).getCurriculumFileBlob(file.id);
                 if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.file_name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } else {
                    toast.error("File data not found in local demo.");
                }
            } else {
                // FIX: Changed PortalAPI access to the directly imported supabase client.
                 const { data } = await supabase!.storage.from('curriculum_uploads').getPublicUrl(file.storage_path);
                 window.open(data.publicUrl, '_blank');
            }
        } catch (error: any) {
            toast.error(`Download failed: ${error.message}`);
        }
    };


    return (
         <div className="flex-1 flex flex-col h-full bg-accent/20 text-foreground">
            <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold">Student Portal {isDemo && <span className="text-sm font-normal text-primary">(Demo Mode)</span>}</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.name}</span>
                    <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut size={16}/> Logout</button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-center items-center text-center">
                    <h2 className="text-2xl font-bold mb-4">Attendance Check-in</h2>
                    <form onSubmit={handleCheckIn} className="w-full max-w-xs space-y-4">
                        <input type="text" value={sessionCode} onChange={e => setSessionCode(e.target.value)}
                               placeholder="Enter 6-Digit PIN"
                               className="w-full bg-input text-center text-3xl font-mono tracking-widest p-3 rounded-lg border border-border"/>
                        <button type="submit" disabled={isCheckingIn} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                             {isCheckingIn ? <><Loader className="animate-spin"/> Checking in...</> : 'Check In'}
                        </button>
                    </form>
                </div>
                <div className="bg-card border border-border rounded-xl p-6">
                     <h2 className="text-2xl font-bold mb-4">Shared Curriculum Files</h2>
                     <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                         {curriculumFiles.map(file => (
                            <div key={file.id} className="bg-secondary p-3 rounded-md flex justify-between items-center text-sm">
                                <div className="overflow-hidden">
                                    <p className="font-semibold truncate">{file.file_name}</p>
                                    <p className="text-xs text-muted-foreground">by {file.teacher_name}</p>
                                </div>
                                <button onClick={() => handleFileDownload(file)} className="text-primary hover:underline flex-shrink-0 ml-2"><Download size={16}/></button>
                            </div>
                        ))}
                     </div>
                </div>
            </main>
        </div>
    );
};

const AuthView: React.FC<{ onLogin: (user: PortalUser) => void, isDemo: boolean, onSelectDemo: (role: 'teacher' | 'student') => void }> = ({ onLogin, isDemo, onSelectDemo }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();
    const PortalAPI = isDemo ? LocalPortal : Portal;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (isLogin) {
                if(isDemo) { // Cannot login in demo, this button should not be shown
                    toast.error("Please select a demo role to proceed.");
                } else {
                    const user = await (PortalAPI as typeof Portal).signInUser(email, password);
                    onLogin(user);
                }
            } else {
                if (isDemo) {
                     const userData = { id: crypto.randomUUID(), name, email, password, role, enrollment_id: enrollmentId, approved: role === 'teacher' };
                     await (PortalAPI as typeof LocalPortal).createUser(userData);
                     toast.success("Account created in demo mode! You can now log in.");
                } else {
                    const userData = { name, email, password, role, enrollment_id: enrollmentId };
                    await (PortalAPI as typeof Portal).signUpUser(userData);
                    toast.success("Sign up successful! Please check your email to verify.");
                }
                setIsLogin(true);
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    if(isDemo) {
         return (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
                 <div className="p-8 border border-border rounded-lg bg-card/50 max-w-md">
                     <GraduationCap className="w-12 h-12 text-primary mx-auto mb-4" />
                     <h2 className="text-2xl font-bold mb-2">Welcome to the Portal Demo</h2>
                     <p className="text-muted-foreground mb-6">Select a role to explore the Student/Teacher Portal. All data is stored locally in your browser and is reset when you clear your cache.</p>
                     <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => onSelectDemo('teacher')} className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Enter as Teacher</button>
                        <button onClick={() => onSelectDemo('student')} className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors">Enter as Student</button>
                    </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-card border border-border rounded-xl p-8">
                <h2 className="text-3xl font-bold text-center mb-6">{isLogin ? 'Login' : 'Sign Up'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required className="w-full bg-input p-3 rounded-md"/>}
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full bg-input p-3 rounded-md"/>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full bg-input p-3 rounded-md"/>
                    {!isLogin && (
                        <>
                            <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-input p-3 rounded-md">
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </select>
                            {role === 'student' && <input type="text" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} placeholder="Enrollment ID" required className="w-full bg-input p-3 rounded-md"/>}
                        </>
                    )}
                    <button type="submit" disabled={isLoading} className="w-full bg-primary text-primary-foreground py-3 rounded-md font-semibold disabled:opacity-50">
                        {isLoading ? <Loader className="animate-spin mx-auto"/> : (isLogin ? 'Login' : 'Create Account')}
                    </button>
                </form>
                <p className="text-center text-sm text-muted-foreground mt-6">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline ml-1">
                        {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export const StudentTeacherPortal: React.FC = () => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(true); // Default to demo mode
    const toast = useToast();

    useEffect(() => {
        // In cloud mode, check for an existing session
        if (!isDemo) {
            const checkSession = async () => {
                try {
                    const { data: { session } } = await supabase!.auth.getSession();
                    if (session?.user) {
                        const profile = await Portal.getUserProfile(session.user.id);
                        setUser(profile);
                    }
                } catch (error: any) {
                   toast.error(error.message);
                } finally {
                   setLoading(false);
                }
            };
            checkSession();
        } else {
             // In demo mode, check session storage
            const demoRole = sessionStorage.getItem('demo-role');
            if (demoRole === 'teacher' || demoRole === 'student') {
                LocalPortal.getDemoUser(demoRole).then(demoUser => {
                    setUser(demoUser);
                    setLoading(false);
                });
            } else {
                 setLoading(false);
            }
        }
    }, [isDemo, toast]);
    
    const handleLogout = async () => {
        if(isDemo) {
            sessionStorage.removeItem('demo-role');
            setUser(null);
        } else {
            // FIX: Changed Portal.supabase access to the directly imported supabase client.
            const { error } = await supabase!.auth.signOut();
            if (error) toast.error(error.message);
            else setUser(null);
        }
    };
    
    const handleSelectDemo = (role: 'teacher' | 'student') => {
        sessionStorage.setItem('demo-role', role);
        setLoading(true);
        LocalPortal.getDemoUser(role).then(demoUser => {
            setUser(demoUser);
            setLoading(false);
        });
    }

    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary" size={48}/></div>;

    return (
        <div className="flex-1 flex flex-col h-full bg-background">
            {user ? (
                user.role === 'teacher' ? <TeacherDashboard user={user} onLogout={handleLogout} isDemo={isDemo}/> : <StudentDashboard user={user} onLogout={handleLogout} isDemo={isDemo}/>
            ) : (
                <AuthView onLogin={setUser} isDemo={isDemo} onSelectDemo={handleSelectDemo} />
            )}
        </div>
    );
};
