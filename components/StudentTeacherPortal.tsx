import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, Loader, LogOut, Info, Users, BookOpen, Smartphone, ShieldCheck, X, User as UserIcon, Mail, Lock, Save, Edit, Trash2, Calendar, MapPin, Copy, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle, BarChart2, Lightbulb, UserCheck, Percent, Wand2, ClipboardList, FlaskConical, PencilRuler, Users as UsersIcon } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase-config';
import { useToast } from './Toast';
import { geminiAI } from './gemini';


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
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key “${key}”:`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
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
        if (!topic.trim() || !learningObjectives.trim()) {
            toast.error("Please provide a topic and at least one learning objective.");
            return;
        }
        if (!geminiAI) {
            toast.error("AI features require a valid API key.");
            return;
        }
        setIsLoading(true);
        setGeneratedPlan('');
        
        const prompt = `
You are an expert curriculum designer for educators. Your task is to generate a detailed, structured lesson plan based on the following parameters. The plan should be practical, engaging, and logically sequenced.

**Topic:** ${topic}
**Learning Objectives:**
${learningObjectives}

**Total Class Duration:** ${duration} minutes
**Desired Teaching Styles:** ${teachingStyles.size > 0 ? [...teachingStyles].join(', ') : 'Flexible'}

Please generate a lesson plan with the following structure, including estimated timings for each section that add up to the total class duration:

### Lesson Plan: [A Creative and Relevant Title]

**🎯 Learning Objectives:**
(Reiterate the provided objectives here in a clear list)

**📋 Materials Needed:**
- [Material 1]
- [Material 2]
...

---

**⏰ Lesson Timeline**

**1. Introduction & Hook (approx. X minutes):**
*   [An engaging activity, question, or story to capture student interest and activate prior knowledge.]

**2. Instructional Phase (approx. Y minutes):**
*   [Core teaching points, concepts, or direct instruction. This is the main content delivery section.]

**3. Guided Practice / Activity (approx. Z minutes):**
*   [A hands-on, interactive, or group activity that aligns with the teaching styles requested and allows students to apply what they've learned.]

**4. Wrap-up & Assessment (approx. W minutes):**
*   [A summary of key takeaways and a quick, effective method to check for understanding, such as an "exit ticket" question, a quick poll, or a brief pair-and-share.]

---

Ensure the content is clear, concise, and ready for a teacher to use directly. The total time (X+Y+Z+W) should be approximately equal to the specified class duration. Format the response using markdown.
`;
        
        try {
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            setGeneratedPlan(response.text);
        } catch (error) {
            console.error("Curriculum generation error:", error);
            toast.error("Failed to generate the lesson plan. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                <header className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Wand2 className="w-6 h-6 text-primary"/>
                        <h2 className="text-xl font-bold">Curriculum Co-pilot</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors"><X/></button>
                </header>
                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    <aside className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-border p-6 space-y-6 overflow-y-auto">
                        <div>
                            <label className="font-semibold text-muted-foreground">Topic</label>
                            <p className="font-bold text-lg text-primary">{topic || "Not set"}</p>
                        </div>
                         <div>
                            <label htmlFor="objectives" className="font-semibold text-muted-foreground">Learning Objectives</label>
                            <textarea id="objectives" value={learningObjectives} onChange={e => setLearningObjectives(e.target.value)} placeholder="e.g., Students will be able to identify three causes of..." rows={4} className="mt-2 w-full bg-input border-border rounded-md px-3 py-2 text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="duration" className="font-semibold text-muted-foreground">Class Duration</label>
                            <select id="duration" value={duration} onChange={e => setDuration(e.target.value)} className="mt-2 w-full bg-input border-border rounded-md px-3 py-2 text-sm">
                                <option value="50">50 minutes</option>
                                <option value="75">75 minutes</option>
                                <option value="90">90 minutes</option>
                            </select>
                        </div>
                         <div>
                            <label className="font-semibold text-muted-foreground">Teaching Style</label>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {availableStyles.map(style => (
                                    <button key={style.name} onClick={() => toggleStyle(style.name)} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border-2 transition-colors ${teachingStyles.has(style.name) ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary hover:bg-secondary/80'}`}>
                                        {style.icon} {style.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <button onClick={handleGenerate} disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                            {isLoading ? <><Loader className="animate-spin" size={20}/> Generating...</> : <><Wand2 size={20}/> Generate Smart Plan</>}
                        </button>
                    </aside>
                     <main className="flex-1 p-6 flex flex-col overflow-y-auto">
                        {isLoading && !generatedPlan && (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <Loader className="animate-spin w-8 h-8 text-primary mb-4"/>
                                <p>Building your lesson plan...</p>
                            </div>
                        )}
                        {generatedPlan ? (
                            <div className="flex-1 flex flex-col">
                                <textarea
                                    value={generatedPlan}
                                    onChange={e => setGeneratedPlan(e.target.value)}
                                    className="w-full flex-1 bg-input border-border rounded-md p-4 resize-none text-sm leading-6"
                                />
                                <button onClick={() => onGeneratePlan(generatedPlan)} className="mt-4 w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-semibold">
                                    Insert into Activities
                                </button>
                            </div>
                        ) : !isLoading && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                                <ClipboardList size={48} className="mb-4"/>
                                <h3 className="font-semibold text-lg">Your generated lesson plan will appear here.</h3>
                                <p className="text-sm">Fill in the details on the left and let the AI build your session.</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

// =================================================================
// SUB-COMPONENTS for Teacher/Student Dashboards
// =================================================================

const TeacherDashboard: React.FC<{
    currentUser: User;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    activeSession: Session | null;
    setActiveSession: React.Dispatch<React.SetStateAction<Session | null>>;
    attendanceRecords: AttendanceRecord[];
    setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    curriculum: Curriculum[];
    setCurriculum: React.Dispatch<React.SetStateAction<Curriculum[]>>;
    allStudents: User[];
    setAllStudents: React.Dispatch<React.SetStateAction<User[]>>;
    onLogout: () => void;
}> = ({ currentUser, setCurrentUser, activeSession, setActiveSession, attendanceRecords, setAttendanceRecords, curriculum, setCurriculum, allStudents, setAllStudents, onLogout }) => {

    const [activeTab, setActiveTab] = useState<'session' | 'curriculum' | 'analytics'>('session');
    const [timeLeft, setTimeLeft] = useState(0);
    const [locationEnforced, setLocationEnforced] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [sessionLocation, setSessionLocation] = useState<{ latitude: number, longitude: number, radius: number } | null>(null);
    const [locationName, setLocationName] = useState<string | null>(null);
    const [isFetchingLocationName, setIsFetchingLocationName] = useState(false);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    const toast = useToast();

    // Curriculum state
    const today = new Date().toISOString().split('T')[0];
    const todaysCurriculum = curriculum.find(c => c.date === today && c.teacherId === currentUser.id);
    const [topic, setTopic] = useState(todaysCurriculum?.topic || '');
    const [activities, setActivities] = useState(todaysCurriculum?.activities || '');
    
    // Analytics state
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnrollment, setNewStudentEnrollment] = useState('');

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(currentUser.name);


    // Handle countdown timer for active session
    useEffect(() => {
        if (activeSession) {
            const updateTimer = () => {
                const now = new Date();
                const expiry = new Date(activeSession.expires_at);
                const secondsLeft = Math.round((expiry.getTime() - now.getTime()) / 1000);
                setTimeLeft(secondsLeft > 0 ? secondsLeft : 0);
                if (secondsLeft <= 0) {
                    endSession();
                }
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [activeSession]);
    
    const handleNameSave = () => {
        if (editedName.trim() && editedName !== currentUser.name) {
            // This updates the user object, which is then persisted by the usePersistentMockState hook
            setCurrentUser(prevUser => prevUser ? { ...prevUser, name: editedName.trim() } : null);
            toast.success("Name updated successfully!");
        }
        setIsEditingName(false);
    };

    const startSession = (locationData: { latitude: number, longitude: number, radius: number } | null, locName: string | null) => {
        const newSessionId = `sess-${Date.now()}`;
        const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
        const sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const newSession: Session = {
            id: newSessionId,
            created_at: new Date().toISOString(),
            expires_at,
            teacher_id: currentUser.id,
            is_active: true,
            session_code: sessionCode,
            location_enforced: !!locationData,
            location: locationData || undefined,
            location_name: locName || undefined,
        };
        const allSessions = JSON.parse(localStorage.getItem('maven-portal-sessions') || '[]');
        localStorage.setItem('maven-portal-sessions', JSON.stringify([...allSessions, newSession]));
        setActiveSession(newSession);
        toast.success("Attendance session started!");
        setShowLocationModal(false);
    };
    
    const fetchLocationName = async (latitude: number, longitude: number) => {
        if (!geminiAI) {
            setLocationName("Location name requires AI key.");
            return;
        }
        setIsFetchingLocationName(true);
        setLocationName(null);
        try {
            const prompt = `Based on the coordinates latitude: ${latitude} and longitude: ${longitude}, what is the name of the building, institution, park, or general area? Provide a concise, single-line name for this location. For example, "Springfield University Library" or "Central Park".`;
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            setLocationName(response.text.trim());
        } catch (error) {
            console.error("Failed to fetch location name:", error);
            setLocationName("Could not retrieve location name.");
        } finally {
            setIsFetchingLocationName(false);
        }
    };
    
    const handleStartSessionClick = () => {
        if (locationEnforced) {
            setShowLocationModal(true);
            setLocationStatus('loading');
            setLocationName(null);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setSessionLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        radius: 100 // default 100 meters
                    });
                    setLocationStatus('success');
                    fetchLocationName(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    toast.error(getGeolocationErrorMessage(error));
                    setLocationStatus('error');
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            startSession(null, null);
        }
    };

    const endSession = () => {
        if (activeSession) {
            const allSessions: Session[] = JSON.parse(localStorage.getItem('maven-portal-sessions') || '[]');
            const updatedSessions = allSessions.map(s => s.id === activeSession.id ? { ...s, is_active: false } : s);
            localStorage.setItem('maven-portal-sessions', JSON.stringify(updatedSessions));
            setActiveSession(null);
            toast.info("Attendance session has ended.");
        }
    };
    
    const saveCurriculum = () => {
        const otherCurriculum = curriculum.filter(c => !(c.date === today && c.teacherId === currentUser.id));
        const newCurriculum: Curriculum = {
            id: todaysCurriculum?.id || `curr-${Date.now()}`,
            teacherId: currentUser.id,
            date: today,
            topic,
            activities
        };
        setCurriculum([...otherCurriculum, newCurriculum]);
        toast.success("Curriculum saved!");
    };
    
    const handleAddStudent = (e: React.FormEvent) => {
        e.preventDefault();
        const name = newStudentName.trim();
        const enrollment = newStudentEnrollment.trim();
        if (!name || !enrollment) {
            toast.error("Name and Enrollment ID are required.");
            return;
        }

        if (allStudents.some(s => s.enrollment_id?.toLowerCase() === enrollment.toLowerCase())) {
            toast.error("A student with this Enrollment ID already exists.");
            return;
        }

        const newStudent: User = {
            id: Date.now(), // Mock ID
            created_at: new Date().toISOString(),
            name,
            email: null,
            role: 'student',
            enrollment_id: enrollment,
            phone: null
        };
        setAllStudents(prev => [...prev, newStudent]);
        setNewStudentName('');
        setNewStudentEnrollment('');
        toast.success(`Student ${name} added.`);
    };

    const handleDeleteStudent = (studentId: number) => {
        const studentToDelete = allStudents.find(s => s.id === studentId);
        if (window.confirm(`Are you sure you want to remove ${studentToDelete?.name}? This will also delete their attendance records.`)) {
            setAllStudents(prev => prev.filter(s => s.id !== studentId));
            // In a real app, attendance records should also be cleaned up. Mock handles this implicitly.
            toast.success(`${studentToDelete?.name} has been removed.`);
        }
    };

    const sessionAttendance = attendanceRecords.filter(rec => rec.sessionId === activeSession?.id);
    const uniqueStudents = allStudents.filter(s => s.role === 'student');
    const totalSessions = [...new Set(attendanceRecords.map(r => r.sessionId))].length;
    
    return (
        <div className="flex flex-col h-full">
            <CurriculumCopilotModal
                isOpen={isCopilotOpen}
                onClose={() => setIsCopilotOpen(false)}
                topic={topic}
                onGeneratePlan={(plan) => {
                    setActivities(plan);
                    setIsCopilotOpen(false);
                    toast.success("Lesson plan inserted successfully!");
                }}
            />
            {showLocationModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 text-center">
                        <MapPin className="w-12 h-12 text-primary mx-auto mb-4"/>
                        <h2 className="text-xl font-bold mb-2">Secure Session Setup</h2>
                        <p className="text-muted-foreground mb-6">
                            For location-aware attendance, we need to pinpoint your current location. Students must be within the specified radius to check in.
                        </p>
                        {locationStatus === 'loading' && <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader className="animate-spin" size={20}/> Getting your coordinates...</div>}
                        {locationStatus === 'error' && <div className="text-destructive">Failed to get location. Please enable it in your browser settings and try again.</div>}
                        {locationStatus === 'success' && sessionLocation && (
                            <div className="text-left space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                                    {isFetchingLocationName ? (
                                        <div className="flex items-center gap-2 p-2 bg-input rounded-md text-muted-foreground text-sm">
                                            <Loader size={14} className="animate-spin" />
                                            <span>Resolving location name...</span>
                                        </div>
                                    ) : (
                                        <p className="font-semibold text-base p-2 bg-input rounded-md">{locationName || 'Unknown Location'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Coordinates</label>
                                    <p className="font-mono text-sm p-2 bg-input rounded-md">{sessionLocation.latitude.toFixed(5)}, {sessionLocation.longitude.toFixed(5)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Attendance Radius: {sessionLocation.radius} meters</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="500"
                                        step="10"
                                        value={sessionLocation.radius}
                                        onChange={e => setSessionLocation(l => l ? { ...l, radius: parseInt(e.target.value) } : null)}
                                        className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowLocationModal(false)} className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">Cancel</button>
                            <button onClick={() => startSession(sessionLocation, locationName)} disabled={locationStatus !== 'success'} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">Confirm & Start</button>
                        </div>
                    </div>
                </div>
            )}
            <header className="p-4 border-b border-border/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 group">
                    {isEditingName ? (
                         <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setIsEditingName(false); }}
                                className="bg-input border-border rounded-md px-2 py-1 text-2xl font-bold"
                                autoFocus
                            />
                            <button onClick={handleNameSave} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors">
                                <Save size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <h1 className="text-2xl font-bold">Welcome, {currentUser.name}</h1>
                            <button onClick={() => setIsEditingName(true)} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                                <Edit size={18} />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                    <div className="p-2 bg-card border border-border rounded-lg flex items-center justify-center gap-2 text-sm">
                        <button onClick={() => setActiveTab('session')} className={`px-3 py-1.5 rounded-md transition-colors flex-1 ${activeTab === 'session' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Session</button>
                        <button onClick={() => setActiveTab('curriculum')} className={`px-3 py-1.5 rounded-md transition-colors flex-1 ${activeTab === 'curriculum' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Curriculum</button>
                        <button onClick={() => setActiveTab('analytics')} className={`px-3 py-1.5 rounded-md transition-colors flex-1 ${activeTab === 'analytics' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Analytics</button>
                    </div>
                    <button onClick={onLogout} className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>
            
            <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
                {activeTab === 'session' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-lg p-6">
                            <h3 className="text-xl font-bold mb-4">New Attendance Session</h3>
                            {activeSession ? (
                                <div className="text-center">
                                    <p className="text-muted-foreground mb-2">Session is active. Ends in:</p>
                                    <p className="text-4xl font-mono font-bold text-primary mb-2">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                                    {activeSession.location_enforced && (
                                        <div className="mb-4 text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
                                            <MapPin size={12} />
                                            <span>Location-Aware: {activeSession.location_name || 'Enabled'}</span>
                                        </div>
                                    )}
                                    <button onClick={endSession} className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">End Session</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-primary"/>
                                            <span className="font-medium text-sm">Location-Aware</span>
                                        </div>
                                        <button onClick={() => setLocationEnforced(!locationEnforced)}>{locationEnforced ? <ToggleRight size={24} className="text-primary"/> : <ToggleLeft size={24} className="text-muted-foreground"/>}</button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{locationEnforced ? "Requires students to be physically present at your location. Uses GPS." : "Students can check in from anywhere."}</p>
                                    <button onClick={handleStartSessionClick} className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Start New Session</button>
                                </div>
                            )}
                        </div>
                        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-lg p-6 flex flex-col items-center justify-center">
                            {activeSession && activeSession.session_code ? (
                                <>
                                    <h3 className="text-xl font-bold mb-2">One-Time Password</h3>
                                    <p className="text-muted-foreground mb-4">Students can enter this code to check in.</p>
                                    <div className="p-4 bg-secondary rounded-lg flex items-center justify-center gap-4">
                                        <span className="text-5xl font-mono tracking-widest text-primary">{activeSession.session_code}</span>
                                        <button onClick={() => { navigator.clipboard.writeText(activeSession.session_code!); toast.success("Code copied!"); }} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent">
                                            <Copy size={24}/>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <Users size={48} className="mx-auto mb-4"/>
                                    <p>Start a new session to generate an OTP code for attendance.</p>
                                </div>
                            )}
                        </div>
                         <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-lg p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Live Attendance ({sessionAttendance.length})</h3>
                                <button onClick={() => {
                                    const allRecs = JSON.parse(localStorage.getItem('maven-portal-attendance') || '[]');
                                    setAttendanceRecords(allRecs);
                                    toast.info("Attendance refreshed.");
                                }} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"><RefreshCw size={16}/></button>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="border-b border-border"><th className="p-2">Name</th><th className="p-2">Enrollment ID</th><th className="p-2">Time</th></tr></thead>
                                    <tbody>
                                        {sessionAttendance.map(rec => (
                                            <tr key={rec.id} className="border-b border-border/50"><td className="p-2">{rec.studentName}</td><td className="p-2">{rec.enrollmentId}</td><td className="p-2 text-sm text-muted-foreground">{new Date(rec.timestamp).toLocaleTimeString()}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                                {sessionAttendance.length === 0 && <p className="text-muted-foreground text-center py-8">No students have checked in yet.</p>}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'curriculum' && (
                     <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-lg p-8">
                        <h3 className="text-2xl font-bold mb-2">Daily Curriculum Plan</h3>
                        <p className="text-muted-foreground mb-6">Set the topic and plan activities for today's session: <span className="font-semibold text-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                        <div className="space-y-6">
                            <div>
                                <label className="font-semibold">Today's Topic</label>
                                <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Advanced JavaScript Concepts" className="mt-2 w-full bg-input border-border rounded-md px-4 py-3" />
                            </div>
                            <div>
                                 <div className="flex items-center justify-between">
                                    <label className="font-semibold">Planned Activities</label>
                                    <button onClick={() => setIsCopilotOpen(true)} disabled={!geminiAI} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50">
                                        <Wand2 size={16}/>
                                        Launch Curriculum Co-pilot
                                    </button>
                                </div>
                                <textarea value={activities} onChange={e => setActivities(e.target.value)} placeholder="List the activities for today's session, one per line. Use the Co-pilot to generate a structured plan!" rows={6} className="mt-2 w-full bg-input border-border rounded-md px-4 py-3"></textarea>
                            </div>
                            <button onClick={saveCurriculum} className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90">Save Today's Plan</button>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                     <div className="space-y-6">
                        <h3 className="text-2xl font-bold">Analytics & Student Management</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="bg-card border border-border rounded-xl shadow-lg p-6 flex items-center gap-4">
                                <Users size={24} className="text-primary"/>
                                <div>
                                    <p className="text-3xl font-bold">{uniqueStudents.length}</p>
                                    <p className="text-sm text-muted-foreground">Total Students</p>
                                </div>
                            </div>
                             <div className="bg-card border border-border rounded-xl shadow-lg p-6 flex items-center gap-4">
                                <Calendar size={24} className="text-primary"/>
                                <div>
                                    <p className="text-3xl font-bold">{totalSessions}</p>
                                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                                </div>
                            </div>
                             <div className="bg-card border border-border rounded-xl shadow-lg p-6 flex items-center gap-4">
                                <Percent size={24} className="text-primary"/>
                                <div>
                                    <p className="text-3xl font-bold">
                                        {totalSessions > 0 && uniqueStudents.length > 0 ? `${Math.round((attendanceRecords.length / (totalSessions * uniqueStudents.length)) * 100)}%` : 'N/A'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Overall Attendance</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                            <h4 className="text-xl font-bold mb-4">Student Roster</h4>
                            <div className="max-h-96 overflow-y-auto">
                                 <div className="space-y-2">
                                    {/* Header for larger screens */}
                                    <div className="hidden md:grid md:grid-cols-[2fr_1.5fr_2fr_auto] gap-4 px-3 text-sm font-medium text-muted-foreground border-b border-border pb-2">
                                        <span>Name</span>
                                        <span>Enrollment ID</span>
                                        <span>Attendance %</span>
                                        <span className="text-right">Actions</span>
                                    </div>
                                    {uniqueStudents.map(student => {
                                        const studentAttendanceCount = attendanceRecords.filter(rec => rec.enrollmentId === student.enrollment_id).length;
                                        const attendancePercent = totalSessions > 0 ? Math.round((studentAttendanceCount / totalSessions) * 100) : 0;
                                        return (
                                            <div key={student.id} className="bg-secondary/50 rounded-lg p-3 md:bg-transparent md:p-0 md:rounded-none md:grid md:grid-cols-[2fr_1.5fr_2fr_auto] gap-4 items-center md:px-3 md:py-2.5 border-b border-border/50 last:border-b-0">
                                                {/* Name */}
                                                <div className="flex justify-between items-center md:block">
                                                    <span className="font-bold md:hidden text-xs text-muted-foreground">NAME</span>
                                                    <p className="font-medium">{student.name}</p>
                                                </div>
                                                {/* Enrollment */}
                                                <div className="flex justify-between items-center md:block mt-2 md:mt-0">
                                                    <span className="font-bold md:hidden text-xs text-muted-foreground">ENROLLMENT ID</span>
                                                    <p className="text-muted-foreground">{student.enrollment_id}</p>
                                                </div>
                                                {/* Attendance */}
                                                <div className="mt-2 md:mt-0">
                                                    <span className="font-bold md:hidden text-xs text-muted-foreground mb-1 block">ATTENDANCE</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-full bg-muted rounded-full h-2.5">
                                                            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${attendancePercent}%` }}></div>
                                                        </div>
                                                        <span className="font-semibold text-sm w-12 text-right">{attendancePercent}%</span>
                                                    </div>
                                                </div>
                                                {/* Actions */}
                                                <div className="text-right mt-2 md:mt-0">
                                                     <button onClick={() => handleDeleteStudent(student.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-full hover:bg-destructive/10"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                             <div className="mt-6 pt-6 border-t border-border">
                                <h5 className="font-semibold mb-2">Add New Student</h5>
                                <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-2">
                                    <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Student Name" className="flex-1 bg-input border-border rounded-md px-3 py-2" />
                                    <input value={newStudentEnrollment} onChange={e => setNewStudentEnrollment(e.target.value)} placeholder="Enrollment ID" className="flex-1 bg-input border-border rounded-md px-3 py-2" />
                                    <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">Add</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};


const StudentDashboard: React.FC<{
    currentUser: User;
    curriculum: Curriculum[];
    attendanceRecords: AttendanceRecord[];
    onLogout: () => void;
    onAddAttendanceRecord: (record: AttendanceRecord) => void;
}> = ({ currentUser, curriculum, attendanceRecords, onLogout, onAddAttendanceRecord }) => {
    const today = new Date().toISOString().split('T')[0];
    const todaysCurriculum = curriculum.find(c => c.date === today);
    const myAttendance = attendanceRecords.filter(rec => rec.enrollmentId === currentUser.enrollment_id);
    const [otp, setOtp] = useState('');
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const toast = useToast();
    
    const handleCheckIn = (e: React.FormEvent) => {
        e.preventDefault();
        if (isCheckingIn || otp.length !== 6) return;
        
        setIsCheckingIn(true);
        
        const allSessions: Session[] = JSON.parse(localStorage.getItem('maven-portal-sessions') || '[]');
        const session = allSessions.find(s => s.session_code === otp && s.is_active && new Date(s.expires_at) > new Date());
        
        if (!session) {
            toast.error("Invalid or expired attendance code.");
            setIsCheckingIn(false);
            setOtp('');
            return;
        }
        
        const performCheckin = () => {
             if (!currentUser.enrollment_id) {
                toast.error("Your account is missing an enrollment ID.");
                setIsCheckingIn(false);
                return;
            }

            const allAttendance: AttendanceRecord[] = JSON.parse(localStorage.getItem('maven-portal-attendance') || '[]');
            const hasAlreadyCheckedIn = allAttendance.some(rec => rec.sessionId === session.id && rec.enrollmentId === currentUser.enrollment_id);

            if (hasAlreadyCheckedIn) {
                toast.error("You have already checked in for this session.");
                setIsCheckingIn(false);
                return;
            }
            
            const newRecord: AttendanceRecord = {
                id: `att-${Date.now()}`,
                sessionId: session.id,
                studentName: currentUser.name,
                enrollmentId: currentUser.enrollment_id,
                timestamp: new Date().toISOString(),
                teacherId: session.teacher_id!,
            };
            
            onAddAttendanceRecord(newRecord);
            toast.success("Checked in successfully!");
            setIsCheckingIn(false);
            setOtp('');
        };
        
        if (session.location_enforced && session.location) {
            toast.info("Location-aware session: getting coordinates...");
            const { latitude: teacherLat, longitude: teacherLon, radius } = session.location;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude: studentLat, longitude: studentLon } = position.coords;
                    const distance = getDistance(teacherLat, teacherLon, studentLat, studentLon);
                    if (distance <= radius) {
                        toast.success(`Location verified (${Math.round(distance)}m away).`);
                        performCheckin();
                    } else {
                        toast.error(`You are too far away (${Math.round(distance)}m). You must be within ${radius}m.`);
                        setIsCheckingIn(false);
                    }
                },
                (geoError) => {
                    toast.error(getGeolocationErrorMessage(geoError));
                    setIsCheckingIn(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            performCheckin();
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            <header className="p-4 border-b border-border/50 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Welcome, {currentUser.name}</h1>
                <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                    <LogOut size={16} /> Logout
                </button>
            </header>
            <main className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-6">
                <form onSubmit={handleCheckIn} className="bg-card border border-border rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold mb-4">Mark Attendance</h3>
                     <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                            className="flex-1 bg-input border-border rounded-md px-4 py-3 text-2xl font-mono tracking-[0.5em] text-center"
                            disabled={isCheckingIn}
                        />
                        <button type="submit" disabled={isCheckingIn || otp.length !== 6} className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {isCheckingIn ? <><Loader size={20} className="animate-spin" /> Verifying...</> : <>Check In</>}
                        </button>
                    </div>
                </form>

                <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen/> Today's Curriculum</h3>
                    {todaysCurriculum ? (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-primary">Topic</h4>
                                <p>{todaysCurriculum.topic}</p>
                            </div>
                             <div>
                                <h4 className="font-semibold text-primary">Activities</h4>
                                <p className="whitespace-pre-wrap text-muted-foreground">{todaysCurriculum.activities}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">The curriculum for today has not been posted yet.</p>
                    )}
                </div>

                 <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Calendar/> My Attendance History</h3>
                     <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left">
                           <thead><tr className="border-b border-border"><th className="p-2">Date</th><th className="p-2">Time</th></tr></thead>
                            <tbody>
                                {myAttendance.map(rec => {
                                    const d = new Date(rec.timestamp);
                                    return (
                                        <tr key={rec.id} className="border-b border-border/50">
                                            <td className="p-2">{d.toLocaleDateString()}</td>
                                            <td className="p-2 text-sm text-muted-foreground">{d.toLocaleTimeString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {myAttendance.length === 0 && <p className="text-muted-foreground text-center py-8">No attendance records found.</p>}
                    </div>
                </div>
            </main>
        </div>
    );
};

// =================================================================
// MAIN PORTAL COMPONENT
// =================================================================

const StudentTeacherPortal: React.FC<{}> = () => {
    const [view, setView] = useState<ViewMode>('login');
    
    // Using localStorage-based mock state
    const [users, setUsers] = usePersistentMockState<User[]>('maven-portal-users', [MOCK_TEACHER, ...MOCK_STUDENTS]);
    const [currentUser, setCurrentUser] = usePersistentMockState<User | null>('maven-portal-currentUser', null);
    const [sessions, setSessions] = usePersistentMockState<Session[]>('maven-portal-sessions', MOCK_SESSIONS);
    const [curriculum, setCurriculum] = usePersistentMockState<Curriculum[]>('maven-portal-curriculum', MOCK_CURRICULUM);
    const [attendanceRecords, setAttendanceRecords] = usePersistentMockState<AttendanceRecord[]>('maven-portal-attendance', MOCK_ATTENDANCE);
    
    // Login/Signup form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'teacher' | 'student'>('student');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [error, setError] = useState('');
    const toast = useToast();

    // Mock check for active session on load
    useEffect(() => {
        if(currentUser?.role === 'teacher') {
            const active = sessions.find(s => s.teacher_id === currentUser.id && new Date(s.expires_at) > new Date());
            if (active) {
                setActiveSession(active);
            }
        }
    }, [currentUser, sessions]);
    
    const [activeSession, setActiveSession] = useState<Session | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedEmail = email.trim().toLowerCase();
        const user = users.find(u => u.email?.trim().toLowerCase() === trimmedEmail && u.password === password);
        if (user) {
            setCurrentUser(user);
            toast.success(`Welcome back, ${user.name}!`);
        } else {
            setError('Invalid email or password.');
        }
    };
    
    const handleSignup = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedEnrollmentId = enrollmentId.trim().toLowerCase();
        const trimmedName = name.trim();

        if (users.some(u => u.email && u.email.trim().toLowerCase() === trimmedEmail)) {
            setError("An account with this email already exists.");
            return;
        }
        if (role === 'student' && trimmedEnrollmentId && users.some(u => u.enrollment_id && u.enrollment_id.trim().toLowerCase() === trimmedEnrollmentId)) {
            setError("An account with this enrollment ID already exists.");
            return;
        }

        const newUser: User = {
            id: Date.now(),
            created_at: new Date().toISOString(),
            name: trimmedName,
            email: email.trim(),
            password,
            role,
            enrollment_id: role === 'student' ? enrollmentId.trim() : null,
            phone: null,
        };
        setUsers(prev => [...prev, newUser]);
        setCurrentUser(newUser);
        toast.success("Account created successfully!");
    };
    
    const handleLogout = () => {
        setCurrentUser(null);
        toast.info("You have been logged out.");
    }
    
    const handleAddAttendanceRecord = (record: AttendanceRecord) => {
        setAttendanceRecords(prev => [...prev, record]);
    };

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isSupabaseConfigured) {
        // --- MOCK MODE ---
        if (currentUser) {
            if (currentUser.role === 'teacher') {
                return <TeacherDashboard 
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    activeSession={activeSession}
                    setActiveSession={setActiveSession}
                    attendanceRecords={attendanceRecords}
                    setAttendanceRecords={setAttendanceRecords}
                    curriculum={curriculum}
                    setCurriculum={setCurriculum}
                    allStudents={users}
                    setAllStudents={setUsers}
                    onLogout={handleLogout}
                />;
            } else {
                return <StudentDashboard 
                    currentUser={currentUser} 
                    curriculum={curriculum} 
                    attendanceRecords={attendanceRecords} 
                    onLogout={handleLogout}
                    onAddAttendanceRecord={handleAddAttendanceRecord}
                />;
            }
        }
        
        return (
            <div className="flex items-center justify-center h-full bg-background text-foreground p-4">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-primary-foreground" />
                        </div>
                        <h1 className="text-3xl font-bold">Student/Teacher Portal</h1>
                        <p className="text-muted-foreground mt-2">Access your dedicated dashboard.</p>
                        {isLocalhost && (
                            <p className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded-md mt-2">
                                <Info size={12} className="inline mr-1"/> This portal is in local-only mock mode.
                            </p>
                        )}
                    </div>

                    {view === 'login' && (
                        <div>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full bg-input border-border rounded-md px-4 py-3"/>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full bg-input border-border rounded-md px-4 py-3"/>
                                {error && <p className="text-destructive text-sm">{error}</p>}
                                <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-md">Login</button>
                                <p className="text-center text-sm">Don't have an account? <button type="button" onClick={() => setView('signup')} className="text-primary hover:underline bg-transparent border-none p-0">Sign Up</button></p>
                            </form>
                             <div className="mt-4 p-3 bg-secondary rounded-lg text-xs text-muted-foreground text-left space-y-1">
                                <p className="font-bold text-foreground/80">Quick Login (Mock Credentials):</p>
                                <p><strong>Teacher:</strong> teacher@example.com / password123</p>
                                <p><strong>Student:</strong> alex@example.com / password123</p>
                            </div>
                        </div>
                    )}
                    
                     {view === 'signup' && (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required className="w-full bg-input border-border rounded-md px-4 py-3"/>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full bg-input border-border rounded-md px-4 py-3"/>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full bg-input border-border rounded-md px-4 py-3"/>
                            <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-input border-border rounded-md px-4 py-3">
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </select>
                            {role === 'student' && <input type="text" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} placeholder="Enrollment ID" required className="w-full bg-input border-border rounded-md px-4 py-3"/>}
                            {error && <p className="text-destructive text-sm">{error}</p>}
                            <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-md">Sign Up</button>
                            <p className="text-center text-sm">Already have an account? <button type="button" onClick={() => setView('login')} className="text-primary hover:underline bg-transparent border-none p-0">Log In</button></p>
                        </form>
                    )}

                </div>
            </div>
        );
    }

    // --- REAL SUPABASE MODE ---
    return (
        <div className="flex items-center justify-center h-full bg-background text-foreground p-4">
            <div className="text-center p-8 border border-border rounded-lg bg-card/50">
                <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Supabase Mode Enabled</h2>
                <p className="text-muted-foreground max-w-sm">
                    The Student/Teacher Portal is ready to connect to your Supabase backend.
                    The UI for this mode is currently under development.
                </p>
            </div>
        </div>
    );
};

export default StudentTeacherPortal;