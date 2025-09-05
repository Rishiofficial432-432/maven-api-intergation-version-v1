import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, FlaskConical, PencilRuler, Users as UsersIcon } from 'lucide-react';
import { supabase, isSupabaseConfigured, Database } from './supabase-config';
import { useToast } from './Toast';
import { geminiAI } from './gemini';
import QRCode from 'qrcode';
import { User as SupabaseUser } from '@supabase/supabase-js';


// --- TYPES ---
type Profile = Database['public']['Tables']['portal_users']['Row'];
type Session = Database['public']['Tables']['portal_sessions']['Row'];
type Curriculum = Database['public']['Tables']['portal_curriculum']['Row'];
type AttendanceRecord = Database['public']['Tables']['portal_attendance']['Row'];

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
        { name: 'Interactive', icon: <UsersIcon size={16}/> },
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
const AuthScreen: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<'teacher' | 'student'>('student');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (viewMode === 'login') {
                const { error } = await supabase!.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success("Logged in successfully!");
            } else { // signup
                const { error } = await supabase!.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        data: {
                            name: name.trim(),
                            role: role,
                        }
                    }
                });
                if (error) throw error;
                toast.success("Signed up successfully! Please check your email for verification.");
                setViewMode('login');
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
                        <div>
                            <label className="text-sm font-medium">I am a:</label>
                            <div className="flex gap-4 mt-2">
                                <button type="button" onClick={() => setRole('student')} className={`flex-1 p-2 rounded-md border-2 ${role === 'student' ? 'border-primary bg-primary/10' : 'border-border bg-input'}`}>Student</button>
                                <button type="button" onClick={() => setRole('teacher')} className={`flex-1 p-2 rounded-md border-2 ${role === 'teacher' ? 'border-primary bg-primary/10' : 'border-border bg-input'}`}>Teacher</button>
                            </div>
                        </div>
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
}

// =================================================================
// DASHBOARDS
// =================================================================

const TeacherDashboard: React.FC<{ user: Profile }> = ({ user }) => {
    // Teacher-specific state will go here
    return <div>Teacher Dashboard for {user.name}</div>;
};

const StudentDashboard: React.FC<{ user: Profile }> = ({ user }) => {
    // Student-specific state will go here
    return <div>Student Dashboard for {user.name}</div>;
};

// =================================================================
// MAIN PORTAL COMPONENT
// =================================================================
const StudentTeacherPortal: React.FC = () => {
    const [session, setSession] = useState<SupabaseUser | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        if (session && !profile) {
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
        await supabase!.auth.signOut();
        toast.info("You have been logged out.");
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary"/></div>;
    }
    
    if (!isSupabaseConfigured) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="p-6 bg-card border border-border rounded-lg">
                    <ShieldCheck size={32} className="mx-auto text-primary mb-4"/>
                    <h2 className="text-xl font-bold">Portal Feature requires configuration</h2>
                    <p className="text-muted-foreground mt-2 max-w-md">
                        This feature requires a database connection. Please configure your Supabase credentials on the <strong>Dashboard → Settings</strong> page to enable the Student/Teacher Portal.
                    </p>
                </div>
            </div>
        );
    }
    
    if (!session || !profile) {
        return <AuthScreen />;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground">
            <header className="p-4 border-b border-border flex items-center justify-between">
                <h1 className="text-xl font-bold">
                    {profile.role === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                </h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Welcome, {profile.name}</span>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
                        <LogOut size={16}/> Logout
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto">
                {profile.role === 'teacher' ? <TeacherDashboard user={profile} /> : <StudentDashboard user={profile} />}
            </main>
        </div>
    );
};

export default StudentTeacherPortal;
