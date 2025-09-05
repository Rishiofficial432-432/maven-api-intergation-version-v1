import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, FlaskConical, PencilRuler, Users as UsersIcon } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase-config';
import { useToast } from './Toast';
import { geminiAI } from './gemini';
import QRCode from 'qrcode';


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
    location?: {
        latitude: number;
        longitude: number;
        radius: number; // in meters
    };
    location_name?: string;
}

interface Curriculum {
    id: string;
    teacherId: number;
    date: string; // YYYY-MM-DD
    topic: string;
    activities: string;
}

interface AttendanceRecord {
    id: string;
    sessionId: string;
    studentName: string;
    enrollmentId: string;
    timestamp: string;
    teacherId: number;
}

interface NewUser {
    name: string;
    email: string;
    password?: string;
    role: 'teacher' | 'student';
    enrollment_id: string | null;
    phone: string | null;
}

type ViewMode = 'login' | 'signup' | 'forgot_password' | 'forgot_password_confirmation';

// =================================================================
// MOCK DATA AND CONFIG
// =================================================================
const MOCK_TEACHER: User = { id: 101, created_at: new Date().toISOString(), name: 'Dr. Evelyn Reed', email: 'teacher@example.com', role: 'teacher', enrollment_id: null, phone: '555-0101', password: 'password123' };
const MOCK_STUDENTS: User[] = [
    { id: 201, created_at: new Date().toISOString(), name: 'Alex Johnson', email: 'alex@example.com', role: 'student', enrollment_id: 'S201', phone: '555-0102', password: 'password123' },
    { id: 202, created_at: new Date().toISOString(), name: 'Maria Garcia', email: 'maria@example.com', role: 'student', enrollment_id: 'S202', phone: '555-0103', password: 'password123' },
    { id: 203, created_at: new Date().toISOString(), name: 'Chen Wei', email: 'chen@example.com', role: 'student', enrollment_id: 'S203', phone: '555-0104', password: 'password123' },
];
const MOCK_SESSIONS: Session[] = [];
const MOCK_CURRICULUM: Curriculum[] = [
    { id: 'c1', teacherId: 101, date: new Date().toISOString().split('T')[0], topic: 'Introduction to React Hooks', activities: '1. useState deep dive\n2. useEffect for side effects\n3. Group project setup' }
];
const MOCK_ATTENDANCE: AttendanceRecord[] = [];

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
      return "Location permission denied. Please check your browser settings.";
    case error.POSITION_UNAVAILABLE:
      return "Unable to retrieve your location at this time.";
    case error.TIMEOUT:
      return "Getting your location took too long. Please try again.";
    default:
      return "An unknown error occurred while getting your location.";
  }
};


// =================================================================
// LOCALSTORAGE-BASED MOCK BACKEND
// =================================================================

const usePersistentMockState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(`maven-portal-${key}`);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key “${key}”:`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(`maven-portal-${key}`, JSON.stringify(state));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, state]);

    return [state, setState];
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
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300" onClick={(e) => e.stopPropagation()}>
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
                        <button onClick={handleGenerate} disabled={isLoading} className="w-full bg-primary text-primary-foreground py-2 rounded-md flex items-center justify-center gap-2">
                            {isLoading ? <Loader className="animate-spin"/> : <RefreshCw size={16}/>} Generate Plan
                        </button>
                    </div>

                    {/* Right Side: Output */}
                    <div className="bg-secondary/50 rounded-lg p-4 min-h-[300px]">
                        <h3 className="font-semibold mb-2">Generated Plan</h3>
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground"><Loader className="animate-spin mr-2"/> Thinking...</div>
                        ) : generatedPlan ? (
                            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{generatedPlan}</pre>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-center">Your generated lesson plan will appear here.</div>
                        )}
                    </div>
                </div>
                 {generatedPlan && (
                    <div className="p-6 border-t border-border text-right">
                        <button onClick={handleApplyPlan} className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold">Apply this Plan</button>
                    </div>
                )}
            </div>
        </div>
    );
};


// =================================================================
// MAIN COMPONENT
// =================================================================
const StudentTeacherPortal: React.FC = () => {
    // If Supabase is not configured, we run in a local mock mode.
    const [users, setUsers] = usePersistentMockState<User[]>('users', [MOCK_TEACHER, ...MOCK_STUDENTS]);
    const [sessions, setSessions] = usePersistentMockState<Session[]>('sessions', MOCK_SESSIONS);
    const [curriculum, setCurriculum] = usePersistentMockState<Curriculum[]>('curriculum', MOCK_CURRICULUM);
    const [attendance, setAttendance] = usePersistentMockState<AttendanceRecord[]>('attendance', MOCK_ATTENDANCE);
    const [currentUser, setCurrentUser] = usePersistentMockState<User | null>('currentUser', null);
    
    // In a real app, this would be a more robust session management.
    // For this local-first app, just persisting the user object is enough.

    if (!isSupabaseConfigured) {
        return (
            <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden">
                <div className="p-4 border-b border-border flex-shrink-0 flex items-center justify-center text-center">
                    <Info size={18} className="text-yellow-400 mr-2" />
                    <p className="text-sm text-muted-foreground">
                        Student/Teacher Portal is running in a **local-only mock mode**. To enable database features, configure your Supabase credentials in `supabase-config.ts`.
                    </p>
                </div>
                {/* We can continue with the rest of the component, which will use the mock data hooks. */}
                <div className="flex-1 flex items-center justify-center">
                    <p>Portal is under construction in mock mode.</p>
                </div>
            </div>
        );
    }
    
    // TODO: Implement the Supabase logic here when credentials are provided.
    // For now, the component will show the mock mode message and stop.
    return (
         <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="p-6 bg-card border border-border rounded-lg">
                <ShieldCheck size={32} className="mx-auto text-primary mb-4"/>
                <h2 className="text-xl font-bold">Portal Feature requires configuration</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    To use the Student/Teacher Portal, you need to set up a free Supabase account and add your project URL and public API key to the `components/supabase-config.ts` file.
                </p>
            </div>
        </div>
    )
};

export default StudentTeacherPortal;
