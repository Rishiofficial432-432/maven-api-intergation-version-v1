



import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, FlaskConical, PencilRuler } from 'lucide-react';
import { supabase, isSupabaseConfigured, Database, initPromise } from './supabase-config';
import { useToast } from './Toast';
import { geminiAI } from './gemini';
import QRCode from 'qrcode';
import { User as SupabaseUser } from '@supabase/supabase-js';


// --- TYPES ---
type Profile = Database['public']['Tables']['portal_users']['Row'];
type Session = Database['public']['Tables']['portal_sessions']['Row'];
type Curriculum = Database['public']['Tables']['portal_curriculum']['Row'];
type AttendanceRecord = Database['public']['Tables']['portal_attendance']['Row'] & { portal_users: Profile | null };

type ViewMode = 'login' | 'signup';


// =================================================================
// HELPERS
// =================================================================

// Haversine distance formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

const getGeolocationErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Please enable it in your browser settings to check in.";
    case error.POSITION_UNAVAILABLE:
      return "Unable to retrieve your location. Please check your device's location services.";
    case error.TIMEOUT:
      return "Getting your location took too long. Please try again.";
    default:
      return "An unknown error occurred while getting your location.";
  }
};


// =================================================================
// CURRICULUM COPILOT MODAL
// =================================================================
interface CurriculumCopilotModalProps {
    isOpen: boolean;
    onClose: () => void;
    topic: string;
    onGeneratePlan: (plan: string) => void;
}

const CurriculumCopilotModal: React.FC<CurriculumCopilotModalProps> = ({ isOpen, onClose, topic, onGeneratePlan }) => {
    const [learningObjectives, setLearningObjectives] = useState('');
    const [duration, setDuration] = useState('50');
    const [teachingStyles, setTeachingStyles] = useState<Set<string>>(new Set());
    const [generatedPlan, setGeneratedPlan] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    const availableStyles = [
        { name: 'Interactive', icon: <Users size={16}/> },
        { name: 'Lecture', icon: <UserIcon size={16}/> },
        { name: 'Hands-on', icon: <FlaskConical size={16}/> },
        { name: 'Project-based', icon: <PencilRuler size={16}/> },
    ];

    const toggleStyle = (style: string) => {
        const newStyles = new Set(teachingStyles);
        if (newStyles.has(style)) {
            newStyles.delete(style);
        } else {
            newStyles.add(style);
        }
        setTeachingStyles(newStyles);
    };

    const handleGenerate = async () => {
        if (!geminiAI) {
            toast.error("AI features are disabled. Please configure your API key in settings.");
            return;
        }
        if (!topic) {
            toast.error("Please provide a topic for the curriculum.");
            return;
        }
        setIsLoading(true);
        setGeneratedPlan('');
        try {
            const styles = Array.from(teachingStyles).join(', ') || 'a standard, balanced approach';
            const prompt = `Generate a structured lesson plan for a ${duration}-minute class on the topic: "${topic}". The learning objectives are: "${learningObjectives}". The desired teaching style is: ${styles}. The plan should be formatted as a list of activities with estimated timings. For example:
- (5 mins) Introduction & Icebreaker
- (15 mins) Core Concept Lecture
- (20 mins) Group Activity: ...
- (10 mins) Q&A and Wrap-up`;

            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const plan = response.text;
            if (!plan) throw new Error("AI returned an empty response.");
            setGeneratedPlan(plan);
        } catch (err) {
            console.error("Curriculum generation failed:", err);
            toast.error("Failed to generate curriculum plan.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleApplyPlan = () => {
        onGeneratePlan(generatedPlan);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-border">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Wand2 size={20} className="text-primary"/> Curriculum Copilot</h2>
                        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent"><X size={20}/></button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">AI-powered lesson planning for: <span className="font-semibold text-foreground">{topic}</span></p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                    {/* Left Side: Inputs */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Learning Objectives</label>
                            <textarea value={learningObjectives} onChange={e => setLearningObjectives(e.target.value)} placeholder="e.g., Understand state management, Differentiate between props and state" className="w-full mt-1 bg-input border-border rounded-md p-2 text-sm min-h-[100px]"></textarea>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Class Duration (minutes)</label>
                            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full mt-1 bg-input border-border rounded-md p-2 text-sm"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Teaching Style</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {availableStyles.map(style => (
                                    <button key={style.name} onClick={() => toggleStyle(style.name)} className={`flex items-center gap-2 p-2 text-sm rounded-md border-2 transition-colors ${teachingStyles.has(style.name) ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary hover:bg-secondary/80'}`}>
                                        {style.icon} {style.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleGenerate} disabled={isLoading || !topic.trim()} className="w-full bg-primary text-primary-foreground py-2 rounded-md flex items-center justify-center gap-2 disabled:opacity-50">
                            {isLoading ? <Loader className="animate-spin"/> : <RefreshCw size={16}/>} Generate Plan
                        </button>
                    </div>

                    {/* Right Side: Output */}
                    <div className="bg-secondary/50 rounded-lg p-4 min-h-[300px] flex flex-col">
                        <h3 className="font-semibold mb-2">Generated Plan</h3>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground"><Loader className="animate-spin mr-2"/> Thinking...</div>
                            ) : generatedPlan ? (
                                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{generatedPlan}</pre>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-center">Your generated lesson plan will appear here.</div>
                            )}
                        </div>
                    </div>
                </div>
                 {generatedPlan && !isLoading && (
                    <div className="p-6 border-t border-border text-right">
                        <button onClick={handleApplyPlan} className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700 transition-colors">Apply this Plan</button>
                    </div>
                 )}
            </div>
             <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

// =================================================================
// AUTHENTICATION SCREEN
// =================================================================
const AuthScreen: React.FC<{ onDemoLogin: (profile: Profile) => void }> = ({ onDemoLogin }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('login');
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

        // Demo mode check
        if ((email === 'teacher@example.com' || email === 'student@example.com') && password === 'password123') {
            const isTeacher = email === 'teacher@example.com';
            const demoProfile: Profile = {
                id: isTeacher ? 'demo-teacher-id' : 'demo-student-id',
                created_at: new Date().toISOString(),
                email: email,
                enrollment_id: isTeacher ? null : 'DEMO-001',
                name: isTeacher ? 'Demo Teacher' : 'Demo Student',
                phone: null,
                role: isTeacher ? 'teacher' : 'student',
                teacher_id: null
            };
            toast.success(`Logged in as ${demoProfile.name}!`);
            onDemoLogin(demoProfile);
            setLoading(false);
            return;
        }

        if (!isSupabaseConfigured) {
            toast.error("Database not configured. Please use demo credentials or set up Supabase in settings.");
            setLoading(false);
            return;
        }

        try {
            if (viewMode === 'login') {
                const { error } = await supabase!.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success("Logged in successfully!");
            } else { // signup
                const signupData: { name: string; role: string; enrollment_id?: string } = {
                    name: name.trim(),
                    role: role,
                };
                
                if (role === 'student') {
                    if (!enrollmentId.trim()) {
                        toast.error("Enrollment ID is required for students.");
                        setLoading(false);
                        return;
                    }
                    signupData.enrollment_id = enrollmentId.trim();
                }

                const { error } = await supabase!.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        data: signupData
                    }
                });
                if (error) throw error;
                toast.success("Signed up successfully! Please check your email for verification.");
                setViewMode('login');
                setName('');
                setEmail('');
                setPassword('');
                setEnrollmentId('');
            }
        } catch (error: any) {
            toast.error(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Student & Teacher Portal</h1>
                    <p className="text-muted-foreground">{viewMode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
                </div>
                
                {!isSupabaseConfigured && viewMode === 'login' && (
                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg p-4 mb-6 text-sm">
                        <h4 className="font-semibold text-blue-200 mb-2 flex items-center gap-2">
                            <Info size={16} /> Demo Mode Available
                        </h4>
                        <p className="text-xs">Database not configured. You can log in with demo accounts to explore the UI.</p>
                        <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1 text-xs">
                             <p><strong>Teacher:</strong> <code className="bg-background px-1 rounded">teacher@example.com</code></p>
                             <p><strong>Student:</strong> <code className="bg-background px-1 rounded">student@example.com</code></p>
                             <p><strong>Password:</strong> <code className="bg-background px-1 rounded">password123</code></p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleAuthAction} className="space-y-4">
                    {viewMode === 'signup' && (
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" />
                    </div>
                    {viewMode === 'signup' && (
                        <>
                            <div>
                                <label className="text-sm font-medium">I am a:</label>
                                <div className="flex gap-4 mt-2">
                                    <button type="button" onClick={() => setRole('student')} className={`flex-1 p-2 rounded-md border-2 ${role === 'student' ? 'border-primary bg-primary/10' : 'border-border bg-input'}`}>Student</button>
                                    <button type="button" onClick={() => setRole('teacher')} className={`flex-1 p-2 rounded-md border-2 ${role === 'teacher' ? 'border-primary bg-primary/10' : 'border-border bg-input'}`}>Teacher</button>
                                </div>
                            </div>

                            {role === 'student' && (
                                <div className="relative">
                                    <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input type="text" placeholder="Enrollment ID" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} required className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5" />
                                </div>
                            )}
                        </>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50">
                        {loading && <Loader className="animate-spin mr-2"/>}
                        {viewMode === 'login' ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>
                <div className="text-center mt-4">
                    <button onClick={() => setViewMode(viewMode === 'login' ? 'signup' : 'login')} className="text-sm text-primary hover:underline">
                        {viewMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
};
// =================================================================
// DASHBOARDS
// =================================================================

const TeacherDashboard: React.FC<{ user: Profile }> = ({ user }) => {
    const [view, setView] = useState<'sessions' | 'curriculum' | 'analytics' | 'students'>('sessions');
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [liveAttendance, setLiveAttendance] = useState<AttendanceRecord[]>([]);
    const [locationEnforced, setLocationEnforced] = useState(false);
    const [startingSession, setStartingSession] = useState(false);
    const [todayCurriculum, setTodayCurriculum] = useState<Curriculum | null>(null);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);
    const [topic, setTopic] = useState('');
    const [activities, setActivities] = useState('');
    const toast = useToast();
    const isDemoMode = user.id.startsWith('demo-');

    // Fetch active session and curriculum on mount
    useEffect(() => {
        if (isDemoMode || !isSupabaseConfigured) return;
        const fetchActiveSession = async () => {
            const { data, error } = await supabase!
                .from('portal_sessions')
                .select('*')
                .eq('teacher_id', user.id)
                .eq('is_active', true)
                .single();
            if (data) setActiveSession(data);
        };
        const fetchCurriculum = async () => {
            const date = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase!
                .from('portal_curriculum')
                .select('*')
                .eq('teacher_id', user.id)
                .eq('date', date)
                .single();
            if (data) {
                setTodayCurriculum(data);
                setTopic(data.topic || '');
                setActivities(data.activities || '');
            }
        };
        fetchActiveSession();
        fetchCurriculum();
    }, [user.id, isDemoMode]);
    
    // Generate QR Code when session changes
    useEffect(() => {
        if (activeSession?.session_code) {
            QRCode.toDataURL(activeSession.session_code, { width: 256, margin: 2 }, (err, url) => {
                if (err) console.error(err);
                setQrCodeUrl(url);
            });
            // Fetch initial attendance list
            const fetchAttendance = async () => {
                if (isDemoMode || !isSupabaseConfigured) return;
                 const { data, error } = await supabase!.from('portal_attendance').select('*, portal_users!student_id(*)').eq('session_id', activeSession.id);
                 if (error) toast.error("Could not fetch attendance");
                 else setLiveAttendance(data as AttendanceRecord[]);
            }
            fetchAttendance();
        } else {
            setQrCodeUrl('');
            setLiveAttendance([]);
        }
    }, [activeSession, toast, isDemoMode]);

    // Real-time subscription for attendance
    useEffect(() => {
        if (!activeSession || isDemoMode || !isSupabaseConfigured) return;
        const channel = supabase!
            .channel(`public:portal_attendance:session_id=eq.${activeSession.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_attendance', filter: `session_id=eq.${activeSession.id}` },
                async (payload) => {
                    const { data: newUser, error } = await supabase!.from('portal_users').select('*').eq('id', (payload.new as any).student_id).single();
                    if(error) console.error(error);
                    else {
                        const newRecord = {...payload.new, portal_users: newUser} as AttendanceRecord;
                        setLiveAttendance(prev => [...prev, newRecord]);
                        toast.success(`${newUser?.name} just checked in!`);
                    }
                }
            )
            .subscribe();
        return () => { supabase!.removeChannel(channel); };
    }, [activeSession, toast, isDemoMode]);

    const startSession = async () => {
        if (isDemoMode) { toast.info("Starting sessions is disabled in demo mode."); return; }
        setStartingSession(true);
        let locationData: { latitude: number; longitude: number } | null = null;
        if (locationEnforced) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }));
                locationData = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            } catch (error: any) {
                toast.error(getGeolocationErrorMessage(error));
                setStartingSession(false);
                return;
            }
        }

        const sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins expiry

        const { data, error } = await supabase!.from('portal_sessions').insert({
            teacher_id: user.id,
            expires_at,
            session_code: sessionCode,
            location_enforced: locationEnforced,
            location: locationData
        }).select().single();

        if (error) {
            toast.error(error.message);
        } else {
            setActiveSession(data);
            toast.success("Session started!");
        }
        setStartingSession(false);
    };

    const endSession = async () => {
        if (isDemoMode) { toast.info("Ending sessions is disabled in demo mode."); return; }
        if (!activeSession) return;
        const { error } = await supabase!.from('portal_sessions').update({ is_active: false }).eq('id', activeSession.id);
        if (error) toast.error(error.message);
        else {
            setActiveSession(null);
            toast.info("Session ended.");
        }
    };
    
    const handleSaveCurriculum = async () => {
        if (isDemoMode) { toast.info("Saving curriculum is disabled in demo mode."); return; }
        const date = new Date().toISOString().split('T')[0];
        if (!topic.trim()) {
            toast.error("Please enter a topic for the curriculum.");
            return;
        }
        const { error } = await supabase!.from('portal_curriculum').upsert({
            teacher_id: user.id,
            date,
            topic,
            activities
        }, { onConflict: 'teacher_id, date' });
        if (error) toast.error(error.message);
        else {
            toast.success("Today's curriculum saved!");
            setTodayCurriculum({id: todayCurriculum?.id || 0, created_at: todayCurriculum?.created_at || new Date().toISOString(), teacher_id: user.id, date, topic, activities});
        }
    };
    
    const navItems = [
        { id: 'sessions', label: 'Live Session', icon: Smartphone },
        { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
        { id: 'students', label: 'Students', icon: Users },
        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    ];

    return (
        <div>
            <CurriculumCopilotModal
                isOpen={isCopilotOpen}
                onClose={() => setIsCopilotOpen(false)}
                topic={topic}
                onGeneratePlan={(plan) => setActivities(plan)}
            />

            <nav className="flex items-center gap-2 bg-secondary p-1.5 rounded-lg mb-6 max-w-max">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            view === item.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <item.icon size={16} />
                        {item.label}
                    </button>
                ))}
            </nav>

            {view === 'sessions' && (
                <div className="bg-card border border-border rounded-xl p-6">
                    {activeSession ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h2 className="text-xl font-bold">Session is Live</h2>
                                <p className="text-muted-foreground">Session Code:</p>
                                <div className="flex items-center gap-2 my-2">
                                    <span className="text-4xl font-bold tracking-widest bg-secondary px-4 py-2 rounded-lg">{activeSession.session_code}</span>
                                    <button onClick={() => navigator.clipboard.writeText(activeSession.session_code || '')} className="p-2 text-muted-foreground hover:bg-accent rounded-md"><Copy size={20}/></button>
                                </div>
                                {qrCodeUrl && <img src={qrCodeUrl} alt="Session QR Code" className="w-48 h-48 rounded-lg" />}
                                <button onClick={endSession} className="mt-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-semibold w-full">End Session</button>
                            </div>
                            <div>
                                <h3 className="font-bold mb-2">Live Attendance ({liveAttendance.length})</h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {liveAttendance.map(att => (
                                        <div key={att.id} className="p-2 bg-secondary rounded-md flex justify-between items-center text-sm">
                                            <span>
                                                <p className="font-medium">{att.portal_users?.name}</p>
                                                <p className="text-xs text-muted-foreground">{att.portal_users?.enrollment_id}</p>
                                            </span>
                                            <CheckCircle size={16} className="text-green-500"/>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Start New Attendance Session</h2>
                            <div className="flex items-center gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                     {locationEnforced ? <ToggleRight size={24} className="text-primary"/> : <ToggleLeft size={24}/>}
                                    Location-Aware (GPS)
                                </label>
                                <input type="checkbox" checked={locationEnforced} onChange={e => setLocationEnforced(e.target.checked)} className="hidden"/>
                            </div>
                             <button onClick={startSession} disabled={startingSession} className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold w-full max-w-xs flex items-center justify-center disabled:opacity-50">
                                {startingSession ? <Loader className="animate-spin mr-2"/> : <Smartphone className="mr-2"/>} Start Session
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {view === 'curriculum' && (
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-4">Today's Curriculum Plan</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="space-y-4">
                                 <div>
                                    <label className="text-sm font-medium">Topic</label>
                                    <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Introduction to React Hooks" className="w-full mt-1 bg-input border-border rounded-md p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Lesson Plan & Activities</label>
                                    <textarea value={activities} onChange={e => setActivities(e.target.value)} placeholder="- (5 mins) Icebreaker..." className="w-full mt-1 bg-input border-border rounded-md p-2 text-sm min-h-[200px]"></textarea>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="bg-secondary/50 rounded-lg p-4 flex-1">
                                <h3 className="font-semibold mb-2 flex items-center gap-2 text-primary"><Wand2 size={16}/> Curriculum Copilot</h3>
                                <p className="text-sm text-muted-foreground mb-4">Stuck? Use AI to generate a structured lesson plan for today's topic.</p>
                                 <button onClick={() => setIsCopilotOpen(true)} disabled={!topic.trim()} className="w-full bg-primary/20 text-primary py-2 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                                    Launch AI Copilot
                                </button>
                            </div>
                            <button onClick={handleSaveCurriculum} className="mt-4 bg-primary text-primary-foreground py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                                <Save size={16}/> Save Today's Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'students' && (
                <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col items-center justify-center text-center">
                    <Users size={48} className="text-primary mb-4" />
                    <h2 className="text-2xl font-bold">Student Management</h2>
                    <p className="text-muted-foreground mt-2 max-w-lg">
                        This section will allow you to manage your student rosters, assign students to your classes, and view individual profiles.
                        <br/><br/>
                        (Feature under construction)
                    </p>
                </div>
            )}

            {view === 'analytics' && (
                <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col items-center justify-center text-center">
                    <BarChart2 size={48} className="text-primary mb-4" />
                    <h2 className="text-2xl font-bold">Attendance Analytics</h2>
                    <p className="text-muted-foreground mt-2 max-w-lg">
                        This dashboard will provide powerful insights into class attendance trends, helping to identify at-risk students and improve engagement.
                        <br/><br/>
                        (Feature under construction)
                    </p>
                </div>
            )}
        </div>
    );
};

const StudentDashboard: React.FC<{ user: Profile }> = ({ user }) => {
    const [code, setCode] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const [attendanceHistory, setAttendanceHistory] = useState<(Session & { checked_in: boolean })[]>([]);
    const [todayCurriculum, setTodayCurriculum] = useState<Curriculum | null>(null);
    const toast = useToast();
    const isDemoMode = user.id.startsWith('demo-');
    
    useEffect(() => {
        if (isDemoMode || !isSupabaseConfigured) return;
        const fetchHistory = async () => {
            const { data: sessions, error } = await supabase!.from('portal_sessions').select('*').order('created_at', { ascending: false }).limit(10);
            if (error) { toast.error("Could not fetch session history"); return; }

            const { data: myAttendance } = await supabase!.from('portal_attendance').select('session_id').eq('student_id', user.id);
            const attendedSessionIds = new Set(myAttendance?.map(a => a.session_id));
            
            setAttendanceHistory(sessions.map(s => ({ ...s, checked_in: attendedSessionIds.has(s.id) })));
        }
        fetchHistory();
    }, [user.id, toast, isDemoMode]);
    
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDemoMode) { toast.info("Checking in is disabled in demo mode."); return; }
        setCheckingIn(true);
        try {
            const { data: session, error: sessionError } = await supabase!.from('portal_sessions').select('*').eq('session_code', code).single();
            if (sessionError || !session) throw new Error("Invalid or expired session code.");
            if (!session.is_active) throw new Error("This session is no longer active.");

            let studentLocation: { latitude: number, longitude: number } | null = null;
            if (session.location_enforced) {
                 const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true }));
                 studentLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                 const teacherLocation = session.location as any;
                 const distance = getDistance(studentLocation.latitude, studentLocation.longitude, teacherLocation.latitude, teacherLocation.longitude);
                 if (distance > 100) { // 100 meters radius
                     throw new Error(`You are too far away from the class location (${Math.round(distance)}m).`);
                 }
            }

            const { error: attendanceError } = await supabase!.from('portal_attendance').insert({
                session_id: session.id,
                student_id: user.id,
                student_name: user.name,
                enrollment_id: user.enrollment_id,
                teacher_id: session.teacher_id,
            });
            
            if (attendanceError) {
                if (attendanceError.code === '23505') throw new Error("You have already checked in for this session.");
                throw attendanceError;
            }
            
            toast.success("Checked in successfully!");
            // Fetch curriculum for that day
            const { data: curriculum } = await supabase!.from('portal_curriculum').select('*').eq('teacher_id', session.teacher_id).eq('date', new Date(session.created_at).toISOString().split('T')[0]).single();
            setTodayCurriculum(curriculum);

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setCheckingIn(false);
            setCode('');
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>
                <form onSubmit={handleCheckIn}>
                    <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Enter 6-digit session code"
                        className="w-full bg-input text-2xl text-center tracking-[0.5em] font-mono border-border rounded-lg p-4 mb-4"
                        maxLength={6}
                    />
                    <button type="submit" disabled={checkingIn || code.length < 6} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50">
                        {checkingIn ? <Loader className="animate-spin mr-2"/> : <CheckCircle className="mr-2"/>} Check In
                    </button>
                </form>
                 {todayCurriculum && (
                    <div className="mt-6 p-4 bg-secondary rounded-lg">
                        <h3 className="font-bold mb-2 flex items-center gap-2"><BookOpen size={18}/> Today's Curriculum</h3>
                        <p className="font-semibold text-primary">{todayCurriculum.topic}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{todayCurriculum.activities}</p>
                    </div>
                 )}
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
                 <h2 className="text-xl font-bold mb-4">My Attendance History</h2>
                 <div className="space-y-2 max-h-80 overflow-y-auto">
                    {attendanceHistory.map(session => (
                        <div key={session.id} className="p-3 bg-secondary rounded-lg flex justify-between items-center text-sm">
                           <div>
                                <p className="font-medium">{new Date(session.created_at).toLocaleDateString()}</p>
                                <p className="text-xs text-muted-foreground">{new Date(session.created_at).toLocaleTimeString()}</p>
                           </div>
                           {session.checked_in ? (
                               <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-500/20 text-green-300 rounded-full">
                                   <CheckCircle size={12}/> Present
                               </span>
                           ) : (
                               <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-red-500/20 text-red-300 rounded-full">
                                   <X size={12}/> Absent
                               </span>
                           )}
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};

// =================================================================
// MAIN PORTAL COMPONENT
// =================================================================
const StudentTeacherPortal: React.FC = () => {
    const [isClientInitialized, setIsClientInitialized] = useState(false);
    const [session, setSession] = useState<SupabaseUser | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [demoProfile, setDemoProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        // Wait for the async initialization to complete
        initPromise.then(() => {
            setIsClientInitialized(true);

            if (!isSupabaseConfigured) {
                setLoading(false);
                return;
            }

            const fetchSession = async () => {
                const { data: { session } } = await supabase!.auth.getSession();
                setSession(session?.user ?? null);
                setLoading(false);
            };
            fetchSession();

            const { data: authListener } = supabase!.auth.onAuthStateChange((_event, session) => {
                setSession(session?.user ?? null);
                if (_event === 'SIGNED_OUT') {
                    setProfile(null);
                }
            });

            return () => {
                authListener.subscription.unsubscribe();
            };
        });
    }, []);

    useEffect(() => {
        if (session && !profile && isSupabaseConfigured) {
            const fetchProfile = async () => {
                const { data, error } = await supabase!
                    .from('portal_users')
                    .select('*')
                    .eq('id', session.id)
                    .single();
                if (error) {
                    toast.error("Could not fetch user profile.");
                    console.error(error);
                } else {
                    setProfile(data);
                }
            };
            fetchProfile();
        }
    }, [session, profile, toast]);

    const handleLogout = async () => {
        if (demoProfile) {
            setDemoProfile(null);
            toast.info("You have been logged out of demo mode.");
            return;
        }
        if (!isSupabaseConfigured) return;
        await supabase!.auth.signOut();
        toast.info("You have been logged out.");
    };

    if (loading || !isClientInitialized) {
        return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary"/></div>;
    }
    
    if (!isSupabaseConfigured && !demoProfile) {
        return <AuthScreen onDemoLogin={setDemoProfile} />;
    }
    
    const userProfile = profile || demoProfile;

    if (!session && !demoProfile) {
        return <AuthScreen onDemoLogin={setDemoProfile} />;
    }

    if (!userProfile) {
         return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary"/></div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground">
            <header className="p-4 border-b border-border flex items-center justify-between">
                <h1 className="text-xl font-bold">
                    {userProfile.role === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                </h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Welcome, {userProfile.name}</span>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
                        <LogOut size={16}/> Logout
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6">
                {userProfile.role === 'teacher' ? <TeacherDashboard user={userProfile} /> : <StudentDashboard user={userProfile} />}
            </main>
        </div>
    );
};

export default StudentTeacherPortal;