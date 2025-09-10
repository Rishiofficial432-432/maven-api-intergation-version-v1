

import React, { useState, useEffect, useRef } from 'react';
// Fix: Removed `Settings` icon import to resolve name conflict with the Settings component.
// Added `AlertTriangle` icon import for use in the data wipe confirmation modal.
import { 
  Plus, X, Play, Pause, RotateCcw, Calendar, Clock, BookOpen, 
  Target, Calculator, Palette, Sun, Moon, Edit3, Save, Trash2,
  CheckSquare, Square, ArrowRight, Timer, TrendingUp, Heart,
  Link, FileText, Zap, Home, List, BarChart3, User,
  PlusCircle, MinusCircle, Copy, Check, RefreshCw, Star,
  ChevronLeft, ChevronRight, Download, Upload, Search, GripVertical, HelpCircleIcon,
  Notebook, DollarSign, Trophy, Smile, Quote as QuoteIcon, CircleDot, BrainCircuit as BrainCircuitIcon, Wand2, Loader, ArrowLeft, CheckCircle, ClipboardList, Eye, EyeOff,
  AlertTriangle, Lightbulb, Users as UsersIcon, FlaskConical, PencilRuler, ShieldCheck
} from 'lucide-react';
import { HelpPage } from './HelpPage';
import RandomDecisionMaker from './RandomDecisionMaker';
import { Page } from '../App';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
// Fix: Corrected useToast import path
import { useToast } from './Toast';
import { updateApiKey } from './gemini';
import { updateSupabaseCredentials, connectionStatus } from './supabase-config';


declare const XLSX: any;

// Type Definitions
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface KanbanItem {
  id: string;
  text: string;
}

export interface KanbanColumn {
  name: string;
  items: KanbanItem[];
}

export interface KanbanState {
  [key: string]: KanbanColumn;
}

export interface QuickNote {
    id: string;
    text: string;
    createdAt: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
}

export interface Habit {
    id: string;
    name: string;
    streak: number;
    lastCompleted: string | null;
    history: { date: string; completed: boolean }[];
}

export interface Quote {
    id: string;
    text: string;
}

export interface MoodEntry {
    id: string;
    mood: string;
    date: string;
}
export interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
}
export interface Goal {
    id: string;
    text: string;
    completed: boolean;
    targetDate?: string;
}

export interface Class {
    id: string;
    name: string;
}
export interface Student {
    id: string;
    name: string;
    enrollment: string;
    classId: string;
}
export interface Attendance {
    [date: string]: {
        [studentId: string]: 'Present' | 'Absent';
    };
}

// Types for AI Scheduler
export interface Teacher {
    id: string;
    name: string;
    availability: string[]; // e.g., ['Monday', 'Wednesday']
    expertise: string[]; // e.g., ['Computer Science', 'Mathematics']
}
export interface Course {
    id: string;
    name: string;
    hoursPerWeek: number;
    requiredExpertise: string;
}
export interface Room {
    id: string;
    name: string;
    capacity: number;
}
export interface TimetableEntry {
    day: string;
    timeSlot: string; // e.g., "09:00 - 10:00"
    courseName: string;
    teacherName: string;
    roomName: string;
}


// --- AI BRAIN DUMP SUB-COMPONENT ---

interface AIBrainDumpProps {
    onAddTask: (text: string) => void;
    onAddEvent: (title: string, date: string, time: string) => void;
    onAddQuickNote: (text: string) => void;
    onNewNote: (title: string, content?: string) => Page;
}

interface BrainDumpResponse {
    tasks?: string[];
    events?: { title: string; date: string; time: string }[];
    quickNotes?: string[];
    newNotes?: { title: string; content?: string }[];
}

interface SaveableItems {
    tasks: { text: string; checked: boolean }[];
    events: { item: { title: string; date: string; time: string }; checked: boolean }[];
    quickNotes: { text: string; checked: boolean }[];
    newNotes: { item: { title: string; content?: string }; checked: boolean }[];
}


const AIBrainDump: React.FC<AIBrainDumpProps> = ({ onAddTask, onAddEvent, onAddQuickNote, onNewNote }) => {
    const [input, setInput] = useState('');
    const [result, setResult] = useState<BrainDumpResponse | null>(null);
    const [itemsToSave, setItemsToSave] = useState<SaveableItems | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleProcess = async () => {
        if (!input.trim() || !geminiAI) return;
        setIsProcessing(true);
        setError(null);
        setResult(null);

        const today = new Date().toISOString().split('T')[0];
        const prompt = `You are an automated text processing engine for an app called Maven. Analyze the following unstructured text, which is a 'brain dump' from a user. Your sole function is to extract actionable items and categorize them according to the provided JSON schema.

- Identify specific to-do items and list them as tasks.
- Identify calendar events. Infer dates and times where possible. If a specific date isn't mentioned (e.g., "tomorrow", "next Wednesday"), calculate the date based on today's date, which is ${today}. If no time is mentioned, use a sensible default like "12:00". Format dates as YYYY-MM-DD and times as HH:MM (24-hour).
- Identify short, fleeting thoughts or reminders and list them as quick notes.
- Identify larger, more substantial ideas that should become new, separate notes. For these, provide a concise title and, if possible, some initial content.

The user's text is:
---
${input}
---

Structure your response strictly as a JSON object matching the provided schema. Do not add any conversational text, greetings, or explanations. Behave as a silent, efficient text processor. If a category has no items, you can omit the key or provide an empty array.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                events: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, time: { type: Type.STRING } } } },
                quickNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                newNotes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } }
            }
        };

        try {
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema }
            });
            
            const jsonStr = response.text.trim();
            const parsedResult: BrainDumpResponse = JSON.parse(jsonStr);
            setResult(parsedResult);

            // Initialize itemsToSave with everything checked
            setItemsToSave({
                tasks: (parsedResult.tasks || []).map(text => ({ text, checked: true })),
                events: (parsedResult.events || []).map(item => ({ item, checked: true })),
                quickNotes: (parsedResult.quickNotes || []).map(text => ({ text, checked: true })),
                newNotes: (parsedResult.newNotes || []).map(item => ({ item, checked: true })),
            });

        } catch (err: any) {
            console.error("Brain Dump AI error:", err);
            setError("Sorry, I couldn't process that. The AI might be unavailable or the request was invalid. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleItem = (category: keyof SaveableItems, index: number) => {
        if (!itemsToSave) return;
        const newItemsToSave = { ...itemsToSave };
        (newItemsToSave[category] as any[])[index].checked = !(newItemsToSave[category] as any[])[index].checked;
        setItemsToSave(newItemsToSave);
    };

    const handleSave = () => {
        if (!itemsToSave) return;
        let itemsAdded = 0;
        
        itemsToSave.tasks.forEach(t => { if (t.checked) { onAddTask(t.text); itemsAdded++; } });
        itemsToSave.events.forEach(e => { if (e.checked) { onAddEvent(e.item.title, e.item.date, e.item.time); itemsAdded++; } });
        itemsToSave.quickNotes.forEach(qn => { if (qn.checked) { onAddQuickNote(qn.text); itemsAdded++; } });
        itemsToSave.newNotes.forEach(nn => { if (nn.checked) { onNewNote(nn.item.title, nn.item.content); itemsAdded++; } });
        
        setSuccessMessage(`${itemsAdded} items have been added to your workspace!`);
        setTimeout(() => setSuccessMessage(null), 4000);
        handleStartOver();
    };

    const handleStartOver = () => {
        setResult(null);
        setItemsToSave(null);
        setInput('');
    };

    const cardClasses = "bg-card border border-border rounded-xl shadow-lg";

    if (result && itemsToSave) {
        return (
            <div className={`${cardClasses} p-6`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle size={24}/> AI Suggestions</h2>
                    <div className="flex items-center gap-2">
                         <button onClick={handleStartOver} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 active:scale-95 transition-transform">
                            <ArrowLeft size={16}/> Start Over
                        </button>
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:scale-95 transition-transform">
                            <Save size={16}/> Save Selected Items
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                    {Object.entries(itemsToSave).map(([category, items]) => {
                        if (items.length === 0) return null;
                        const categoryTitles = { tasks: "Tasks", events: "Calendar Events", quickNotes: "Quick Notes", newNotes: "New Note Ideas" };
                        return (
                            <div key={category}>
                                <h3 className="font-semibold mb-2 capitalize">{categoryTitles[category as keyof typeof categoryTitles]}</h3>
                                <div className="space-y-2">
                                    {items.map((item: any, index: number) => (
                                        <div key={index} className={`p-3 rounded-lg flex items-start gap-3 cursor-pointer transition-colors ${item.checked ? 'bg-primary/10' : 'bg-secondary/50'}`} onClick={() => handleToggleItem(category as keyof SaveableItems, index)}>
                                            <div className="mt-1">
                                                {item.checked ? <CheckSquare size={18} className="text-primary"/> : <Square size={18} className="text-muted-foreground"/>}
                                            </div>
                                            <div className="text-sm">
                                                {category === 'tasks' && <p>{item.text}</p>}
                                                {category === 'quickNotes' && <p>{item.text}</p>}
                                                {category === 'events' && <><p className="font-medium">{item.item.title}</p><p className="text-muted-foreground">{item.item.date} at {item.item.time}</p></>}
                                                {category === 'newNotes' && <><p className="font-medium">{item.item.title}</p><p className="text-muted-foreground italic line-clamp-2">{item.item.content || 'A new note will be created.'}</p></>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className={`${cardClasses} p-6 flex flex-col items-center justify-center text-center h-full`}>
            {successMessage && <div className="animate-fade-in-out absolute top-8 bg-green-500/20 text-green-300 px-4 py-2 rounded-lg text-sm">{successMessage}</div>}
            <BrainCircuitIcon size={48} className="text-primary mb-4"/>
            <h1 className="text-3xl font-bold">AI Brain Dump</h1>
            <p className="text-muted-foreground mt-2 mb-6 max-w-xl">Turn your scattered thoughts into organized actions. Write anything below—tasks, ideas, appointments—and let the AI sort it out for you.</p>
            <div className="w-full max-w-2xl">
                 <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., Remind me to call John tomorrow at 2pm about the project, buy groceries after work, also I had a cool idea for a new blog post about productivity..."
                    className="w-full bg-input border-border rounded-lg p-4 text-base focus:ring-2 focus:ring-ring min-h-[150px] resize-y"
                    disabled={isProcessing}
                />
                <button
                    onClick={handleProcess}
                    disabled={isProcessing || !input.trim()}
                    className="mt-4 w-full max-w-xs flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg text-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    {isProcessing ? <><Loader className="animate-spin"/> Processing...</> : <><Wand2/> Process with AI</>}
                </button>
                {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
            </div>
        </div>
    );
};

interface MamDeskProps {
    activeTab: string;
    tasks: Task[];
    onAddTask: (text: string) => void;
    onToggleTask: (id: string) => void;
    onDeleteTask: (id: string) => void;
    kanbanColumns: KanbanState;
    setKanbanColumns: React.Dispatch<React.SetStateAction<KanbanState>>;
    onAddKanbanCard: (columnId: string, text: string) => void;
    quickNotes: QuickNote[];
    setQuickNotes: React.Dispatch<React.SetStateAction<QuickNote[]>>;
    events: CalendarEvent[];
    onAddEvent: (title: string, date: string, time: string) => void;
    habits: Habit[];
    setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
    personalQuotes: Quote[];
    setPersonalQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
    moodEntries: MoodEntry[];
    setMoodEntries: React.Dispatch<React.SetStateAction<MoodEntry[]>>;
    expenses: Expense[];
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
    goals: Goal[];
    setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
    pomodoroTime: number;
    pomodoroActive: boolean;
    pomodoroSessions: number;
    onTogglePomodoro: () => void;
    onResetPomodoro: () => void;
    decisionOptions: string[];
    setDecisionOptions: React.Dispatch<React.SetStateAction<string[]>>;
    decisionResult: string;
    setDecisionResult: React.Dispatch<React.SetStateAction<string>>;
    isDecisionSpinning: boolean;
    setIsDecisionSpinning: React.Dispatch<React.SetStateAction<boolean>>;
    currentDecisionSpin: string;
    setCurrentDecisionSpin: React.Dispatch<React.SetStateAction<string>>;
    theme: string;
    setTheme: (theme: string) => void;
    pages: Page[];
    classes: Class[];
    students: Student[];
    attendance: Attendance;
    onAddClass: (name: string) => void;
    onDeleteClass: (id: string) => void;
    onAddStudent: (name: string, enrollment: string, classId: string) => void;
    onDeleteStudent: (id: string) => void;
    onSetAttendance: (date: string, studentId: string, status: 'Present' | 'Absent') => void;
    onAddStudentsBatch: (students: { name: string; enrollment: string; classId: string }[]) => string;
    onNewNote: (title: string, content?: string) => Page;
}

const formatDateToYYYYMMDD = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const AttendanceManager: React.FC<{
    classes: Class[];
    students: Student[];
    attendance: Attendance;
    onAddClass: (name: string) => void;
    onDeleteClass: (id: string) => void;
    onAddStudent: (name: string, enrollment: string, classId: string) => void;
    onDeleteStudent: (id: string) => void;
    onSetAttendance: (date: string, studentId: string, status: 'Present' | 'Absent') => void;
    onAddStudentsBatch: (students: { name: string; enrollment: string; classId: string }[]) => string;
}> = ({ classes, students, attendance, onAddClass, onDeleteClass, onAddStudent, onDeleteStudent, onSetAttendance, onAddStudentsBatch }) => {
    const [activeClassId, setActiveClassId] = useState<string | null>(classes[0]?.id || null);
    const [selectedDate, setSelectedDate] = useState(formatDateToYYYYMMDD(new Date()));
    const [isDragging, setIsDragging] = useState(false);
    const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    useEffect(() => {
        if (!activeClassId && classes.length > 0) {
            setActiveClassId(classes[0].id);
        }
    }, [classes, activeClassId]);

    const [newClassName, setNewClassName] = useState('');
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnrollment, setNewStudentEnrollment] = useState('');
    
    const studentsInClass = students.filter(s => s.classId === activeClassId);

    const handleAddClass = (e: React.FormEvent) => {
        e.preventDefault();
        onAddClass(newClassName);
        setNewClassName('');
    };
    
    const handleAddStudent = (e: React.FormEvent) => {
        e.preventDefault();
        if(activeClassId) {
            onAddStudent(newStudentName, newStudentEnrollment, activeClassId);
            setNewStudentName('');
            setNewStudentEnrollment('');
        }
    };
    
    const attendanceForDate = attendance[selectedDate] || {};

    const handleDateChange = (offset: number) => {
        // Adding T00:00:00 ensures the date is parsed in local time, avoiding timezone-related off-by-one-day errors.
        const currentDate = new Date(selectedDate + 'T00:00:00');
        currentDate.setDate(currentDate.getDate() + offset);
        setSelectedDate(formatDateToYYYYMMDD(currentDate));
    };

    const goToToday = () => {
        setSelectedDate(formatDateToYYYYMMDD(new Date()));
    };

    const handleExportAttendance = () => {
        if (!activeClassId) {
            toast.error("Please select a class to export.");
            return;
        }

        const activeClass = classes.find(c => c.id === activeClassId);
        if (!activeClass) return;

        const studentsInClass = students.filter(s => s.classId === activeClassId);
        if (studentsInClass.length === 0) {
            toast.info("This class has no students to export.");
            return;
        }
        
        // Sort students by enrollment number for consistency
        studentsInClass.sort((a, b) => a.enrollment.localeCompare(b.enrollment));

        // Get all unique dates for which any student in this class has a record
        const studentIdsInClass = new Set(studentsInClass.map(s => s.id));
        const allDates = new Set<string>();
        Object.entries(attendance).forEach(([date, studentRecords]) => {
            if (Object.keys(studentRecords).some(studentId => studentIdsInClass.has(studentId))) {
                allDates.add(date);
            }
        });

        if (allDates.size === 0) {
            toast.info("No attendance data recorded for this class yet.");
            return;
        }

        const sortedDates = Array.from(allDates).sort();

        // Create header row
        const headers = ['Enrollment No.', 'Student Name', ...sortedDates];

        // Create data rows
        const dataRows = studentsInClass.map(student => {
            const row = [student.enrollment, student.name];
            sortedDates.forEach(date => {
                const status = attendance[date]?.[student.id] || ''; // Empty string if not marked
                row.push(status);
            });
            return row;
        });

        // Combine headers and data
        const sheetData = [headers, ...dataRows];

        // Create worksheet and workbook
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

        // Generate and download the file
        const fileName = `${activeClass.name}_Attendance_${formatDateToYYYYMMDD(new Date())}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success("Attendance exported successfully!");
    };

    const processFile = (file: File) => {
        if (!activeClassId) {
            setImportFeedback({ type: 'error', message: "Please select a class before importing students." });
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    setImportFeedback({ type: 'error', message: "The Excel file is empty or invalid." });
                    return;
                }
                
                const headers = Object.keys(json[0]);
                const nameKeys = ['name', 'student name', 'student'];
                const enrollmentKeys = ['enrollment', 'enrollment no', 'no', 'enrollment number', 'reg no', 'registration number'];

                let nameHeader = '';
                let enrollmentHeader = '';

                for (const header of headers) {
                    const lowerHeader = header.toLowerCase().trim();
                    if (!nameHeader && nameKeys.includes(lowerHeader)) {
                        nameHeader = header;
                    }
                    if (!enrollmentHeader && enrollmentKeys.includes(lowerHeader)) {
                        enrollmentHeader = header;
                    }
                }

                if (!nameHeader || !enrollmentHeader) {
                     setImportFeedback({ type: 'error', message: "Could not find required columns. Please ensure your file has headers for both student names (e.g., 'Name') and enrollment numbers (e.g., 'Enrollment' or 'No')." });
                    return;
                }

                const newStudents = json
                    .map(row => ({
                        name: row[nameHeader]?.toString().trim() || '',
                        enrollment: row[enrollmentHeader]?.toString().trim() || '',
                        classId: activeClassId,
                    }))
                    .filter(student => student.name && student.enrollment);

                if (newStudents.length > 0) {
                    const feedbackMessage = onAddStudentsBatch(newStudents);
                    setImportFeedback({ type: 'success', message: feedbackMessage });
                } else {
                    setImportFeedback({ type: 'error', message: "No valid student data found in the file." });
                }
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                setImportFeedback({ type: 'error', message: "Failed to parse the Excel file. Please ensure it's a valid format." });
            }
        };

        reader.onerror = () => {
             setImportFeedback({ type: 'error', message: "Failed to read the file." });
        }

        reader.readAsArrayBuffer(file);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setImportFeedback(null);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setImportFeedback(null);
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
            e.target.value = ''; // Reset input to allow selecting the same file again
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            {/* Class list and management */}
            <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-lg p-6 flex flex-col">
                <h2 className="text-xl font-bold mb-4">Classes</h2>
                <form onSubmit={handleAddClass} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="New class name"
                        className="flex-1 bg-input border-border rounded-md px-3 py-2 focus:ring-ring focus:border-primary"
                    />
                    <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 active:scale-95 transition-transform">Add</button>
                </form>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {classes.map(c => (
                        <div key={c.id} className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${activeClassId === c.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`} onClick={() => setActiveClassId(c.id)}>
                            <span className="font-medium">{c.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteClass(c.id); if(activeClassId === c.id) setActiveClassId(classes.find(cls => cls.id !== c.id)?.id || null); }} className={`p-1 rounded-full transition-colors ${activeClassId === c.id ? 'text-primary-foreground/70 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}><Trash2 size={16}/></button>
                        </div>
                    ))}
                    {classes.length === 0 && <p className="text-muted-foreground text-center py-8">No classes created yet.</p>}
                </div>
            </div>

            {/* Attendance and Student management */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-lg p-6 flex flex-col">
                {activeClassId ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                            <h2 className="text-xl font-bold">Manage Attendance: <span className="text-primary">{classes.find(c=>c.id === activeClassId)?.name}</span></h2>
                             <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
                                    <button onClick={() => handleDateChange(-1)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" title="Previous day">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button onClick={goToToday} className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
                                        Today
                                    </button>
                                    <button onClick={() => handleDateChange(1)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" title="Next day">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-secondary text-foreground border-none rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-ring" />
                                 <button onClick={handleExportAttendance} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 active:scale-95 transition-transform" title="Export Attendance to Excel">
                                    <Download size={16}/> Export
                                </button>
                            </div>
                        </div>

                        {studentsInClass.length === 0 ? (
                             <div className="flex-1 flex flex-col items-center justify-center">
                                 <p className="text-muted-foreground mb-4">No students in this class yet. Add them below or import from Excel.</p>
                             </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {studentsInClass.map(student => {
                                        const status = attendanceForDate[student.id];
                                        return (
                                            <div key={student.id} className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-sm">{student.name}</p>
                                                    <p className="text-xs text-muted-foreground">{student.enrollment}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                     <button onClick={() => onSetAttendance(selectedDate, student.id, 'Present')} className={`px-2 py-1 text-xs rounded-md ${status === 'Present' ? 'bg-green-500 text-white' : 'bg-accent hover:bg-green-500/50'}`}>P</button>
                                                     <button onClick={() => onSetAttendance(selectedDate, student.id, 'Absent')} className={`px-2 py-1 text-xs rounded-md ${status === 'Absent' ? 'bg-red-500 text-white' : 'bg-accent hover:bg-red-500/50'}`}>A</button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Student Management Section */}
                        <div className="mt-6 pt-6 border-t border-border/50">
                            <h3 className="text-lg font-bold mb-4">Manage Students</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Add Student Form */}
                                <div>
                                    <h4 className="font-semibold mb-2">Add New Student</h4>
                                    <form onSubmit={handleAddStudent} className="space-y-2">
                                        <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Student's full name" required className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                                        <input type="text" value={newStudentEnrollment} onChange={e => setNewStudentEnrollment(e.target.value)} placeholder="Enrollment/ID number" required className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                                        <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold">Add Student</button>
                                    </form>
                                </div>
                                {/* Import Students */}
                                <div>
                                    <h4 className="font-semibold mb-2">Import from Excel</h4>
                                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".xlsx, .xls, .csv" />
                                    <div
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer h-full transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <Upload size={24} className="text-muted-foreground mb-2"/>
                                        <p className="text-sm text-center text-muted-foreground">
                                            {isDragging ? 'Drop the file here' : 'Drag & drop or click to upload an Excel file (.xlsx)'}
                                        </p>
                                        <p className="text-xs text-center text-muted-foreground/70 mt-1">
                                            (Must contain 'Name' and 'Enrollment' columns)
                                        </p>
                                    </div>
                                     {importFeedback && (
                                        <div className={`mt-2 p-2 text-xs rounded-md ${importFeedback.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                            {importFeedback.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <UsersIcon size={48} className="text-muted-foreground mb-4"/>
                        <h2 className="text-xl font-bold">No Class Selected</h2>
                        <p className="text-muted-foreground">Please create or select a class from the left panel to manage attendance.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


// FIX: Changed from default export to named export to resolve circular dependency with App.tsx.
export const MamDesk: React.FC<MamDeskProps> = ({
  activeTab,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  kanbanColumns,
  setKanbanColumns,
  onAddKanbanCard,
  quickNotes,
  setQuickNotes,
  events,
  onAddEvent,
  habits,
  setHabits,
  personalQuotes,
  setPersonalQuotes,
  moodEntries,
  setMoodEntries,
  expenses,
  setExpenses,
  goals,
  setGoals,
  pomodoroTime,
  pomodoroActive,
  pomodoroSessions,
  onTogglePomodoro,
  onResetPomodoro,
  decisionOptions,
  setDecisionOptions,
  decisionResult,
  setDecisionResult,
  isDecisionSpinning,
  setIsDecisionSpinning,
  currentDecisionSpin,
  setCurrentDecisionSpin,
  theme,
  setTheme,
  pages,
  classes,
  students,
  attendance,
  onAddClass,
  onDeleteClass,
  onAddStudent,
  onDeleteStudent,
  onSetAttendance,
  onAddStudentsBatch,
  onNewNote
}) => {
  const [newTask, setNewTask] = useState('');
  const [newKanbanTexts, setNewKanbanTexts] = useState({ todo: '', progress: '', done: '' });
  const [newNote, setNewNote] = useState('');
  const [draggedItem, setDraggedItem] = useState<{ colId: string; item: KanbanItem } | null>(null);

  // Fix: Add a handler for adding quick notes to pass to the AIBrainDump component.
  const handleAddQuickNote = (text: string) => {
    setQuickNotes(prev => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...prev]);
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTask(newTask);
    setNewTask('');
  };

  const handleKanbanSubmit = (e: React.FormEvent, colId: string) => {
    e.preventDefault();
    const text = newKanbanTexts[colId as keyof typeof newKanbanTexts];
    if (text.trim()) {
      onAddKanbanCard(colId, text);
      setNewKanbanTexts(prev => ({ ...prev, [colId]: '' }));
    }
  };
  
  const handleNoteSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(newNote.trim()) {
          setQuickNotes(prev => [{ id: crypto.randomUUID(), text: newNote, createdAt: new Date().toISOString() }, ...prev]);
          setNewNote('');
      }
  }

  const handleDragStart = (e: React.DragEvent, colId: string, item: KanbanItem) => {
    setDraggedItem({ colId, item });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    if (!draggedItem) return;
    const { colId: sourceColId, item } = draggedItem;

    if (sourceColId !== targetColId) {
      // Remove from source
      const newSourceItems = kanbanColumns[sourceColId].items.filter(i => i.id !== item.id);
      // Add to target
      const newTargetItems = [...kanbanColumns[targetColId].items, item];

      setKanbanColumns(prev => ({
        ...prev,
        [sourceColId]: { ...prev[sourceColId], items: newSourceItems },
        [targetColId]: { ...prev[targetColId], items: newTargetItems },
      }));
    }
    setDraggedItem(null);
  };
  
   const cardClasses = "bg-card border border-border rounded-xl shadow-lg";

  // Sub-components for each tab
 const Dashboard = () => (
    <div className={`p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 ${cardClasses}`}>
        {/* Quick Stats */}
        <div className="lg:col-span-2 xl:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-secondary p-4 rounded-lg text-center">
                <h3 className="text-2xl font-bold">{tasks.filter(t => !t.completed).length}</h3>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
            </div>
            <div className="bg-secondary p-4 rounded-lg text-center">
                 <h3 className="text-2xl font-bold">{events.filter(e => e.date === new Date().toISOString().slice(0, 10)).length}</h3>
                 <p className="text-sm text-muted-foreground">Events Today</p>
            </div>
            <div className="bg-secondary p-4 rounded-lg text-center">
                <h3 className="text-2xl font-bold">{pomodoroSessions}</h3>
                <p className="text-sm text-muted-foreground">Pomodoros</p>
            </div>
             <div className="bg-secondary p-4 rounded-lg text-center">
                <h3 className="text-2xl font-bold">{pages.length}</h3>
                <p className="text-sm text-muted-foreground">Notes</p>
            </div>
        </div>
    </div>
);

  const Tasks = () => (
    <div className={`p-6 ${cardClasses}`}>
      <h2 className="text-xl font-bold mb-4">Tasks</h2>
      <form onSubmit={handleTaskSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 bg-input border-border rounded-md px-3 py-2"
        />
        <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">Add</button>
      </form>
      <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center gap-3 p-2 bg-secondary rounded-md">
            <button onClick={() => onToggleTask(task.id)}>
              {task.completed ? <CheckSquare className="text-green-500" /> : <Square className="text-muted-foreground" />}
            </button>
            <span className={`flex-1 ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.text}</span>
            <button onClick={() => onDeleteTask(task.id)} className="text-muted-foreground hover:text-destructive"><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );

  const Kanban = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {Object.entries(kanbanColumns).map(([colId, col]) => (
        <div key={colId} className={`p-4 rounded-lg ${cardClasses}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, colId)}>
          <h3 className="font-bold mb-4 text-center">{col.name}</h3>
          <div className="space-y-3 min-h-[100px] max-h-[calc(100vh-300px)] overflow-y-auto">
            {col.items.map(item => (
              <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, colId, item)} className="p-3 bg-secondary rounded-md cursor-grab active:cursor-grabbing flex items-center gap-2">
                <GripVertical size={16} className="text-muted-foreground" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => handleKanbanSubmit(e, colId)} className="flex gap-2 mt-4">
            <input
              type="text"
              value={newKanbanTexts[colId as keyof typeof newKanbanTexts]}
              onChange={(e) => setNewKanbanTexts(p => ({ ...p, [colId]: e.target.value }))}
              placeholder="Add card..."
              className="flex-1 bg-input border-border rounded-md px-2 py-1 text-sm"
            />
            <button type="submit" className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-sm"><Plus size={16}/></button>
          </form>
        </div>
      ))}
    </div>
  );
  
  const CalendarComponent = () => {
    // Basic implementation - can be expanded
    return (
        <div className={`p-6 ${cardClasses}`}>
            <h2 className="text-xl font-bold mb-4">Calendar - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
            <div className="space-y-2">
                {events.length > 0 ? (
                    events
                        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map(event => (
                            <div key={event.id} className="p-3 bg-secondary rounded-lg">
                                <p className="font-semibold">{event.title}</p>
                                <p className="text-sm text-muted-foreground">{new Date(event.date + 'T' + event.time).toLocaleString()}</p>
                            </div>
                        ))
                ) : (
                    <p className="text-muted-foreground text-center py-4">No events scheduled.</p>
                )}
            </div>
        </div>
    );
  };
  
    const Pomodoro = () => (
      <div className={`p-8 text-center ${cardClasses}`}>
          <h2 className="text-2xl font-bold mb-4">Pomodoro Timer</h2>
          <div className="text-7xl font-mono font-bold mb-6 tabular-nums">
              {Math.floor(pomodoroTime / 60).toString().padStart(2, '0')}:
              {(pomodoroTime % 60).toString().padStart(2, '0')}
          </div>
          <div className="flex justify-center gap-4">
              <button onClick={onTogglePomodoro} className="w-24 bg-primary text-primary-foreground py-3 rounded-lg text-lg font-semibold flex items-center justify-center gap-2">
                  {pomodoroActive ? <><Pause size={20}/> Pause</> : <><Play size={20}/> Start</>}
              </button>
              <button onClick={onResetPomodoro} className="w-24 bg-secondary py-3 rounded-lg text-lg font-semibold flex items-center justify-center gap-2">
                  <RotateCcw size={20}/> Reset
              </button>
          </div>
          <p className="mt-6 text-muted-foreground">Completed sessions: {pomodoroSessions}</p>
      </div>
  );
  
  const QuickNotes = () => (
    <div className={`p-6 ${cardClasses}`}>
        <h2 className="text-xl font-bold mb-4">Quick Notes</h2>
        <form onSubmit={handleNoteSubmit} className="flex gap-2 mb-4">
            <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Jot down a quick thought..."
                className="flex-1 bg-input border-border rounded-md px-3 py-2"
            />
            <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">Save</button>
        </form>
        <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
            {quickNotes.map(note => (
                <div key={note.id} className="p-3 bg-secondary rounded-lg flex justify-between items-start">
                    <p className="flex-1 pr-2">{note.text}</p>
                    <button onClick={() => setQuickNotes(prev => prev.filter(n => n.id !== note.id))} className="text-muted-foreground hover:text-destructive"><X size={16}/></button>
                </div>
            ))}
        </div>
    </div>
  );
  
  const HabitTracker = () => {
    const [newHabit, setNewHabit] = useState('');
    
    const handleAddHabit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newHabit.trim()) {
            setHabits(prev => [...prev, { id: crypto.randomUUID(), name: newHabit, streak: 0, lastCompleted: null, history: [] }]);
            setNewHabit('');
        }
    };
    
    const handleToggleHabit = (id: string) => {
        const todayStr = new Date().toDateString();
        setHabits(prev => prev.map(h => {
            if (h.id === id) {
                if (h.lastCompleted === todayStr) return h; // Already completed today
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const isConsecutive = h.lastCompleted === yesterday.toDateString();
                return { ...h, streak: isConsecutive ? h.streak + 1 : 1, lastCompleted: todayStr };
            }
            return h;
        }));
    };

    return (
        <div className={`p-6 ${cardClasses}`}>
            <h2 className="text-xl font-bold mb-4">Habit Tracker</h2>
            <form onSubmit={handleAddHabit} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newHabit}
                    onChange={(e) => setNewHabit(e.target.value)}
                    placeholder="Add a new habit..."
                    className="flex-1 bg-input border-border rounded-md px-3 py-2"
                />
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">Add</button>
            </form>
             <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {habits.map(habit => {
                    const todayCompleted = habit.lastCompleted === new Date().toDateString();
                    return (
                         <div key={habit.id} className="p-3 bg-secondary rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{habit.name}</p>
                                <p className="text-sm text-muted-foreground">Streak: {habit.streak} days</p>
                            </div>
                            <button 
                                onClick={() => handleToggleHabit(habit.id)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${todayCompleted ? 'bg-green-500 text-white' : 'bg-accent hover:bg-green-500/50'}`}
                            >
                               <Check size={20} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
  
  const Personal = () => (
    <div className={`p-6 grid grid-cols-1 md:grid-cols-2 gap-6 ${cardClasses}`}>
        {/* Goals */}
        <div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Trophy size={20}/> Goals</h3>
            <div className="space-y-2">
                {goals.map(g => <div key={g.id} className="p-2 bg-secondary rounded-md">{g.text}</div>)}
            </div>
        </div>
        {/* Mood */}
        <div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Smile size={20}/> Mood Tracker</h3>
             <div className="space-y-2">
                {moodEntries.slice(0, 5).map(m => <div key={m.id} className="p-2 bg-secondary rounded-md">{m.date}: {m.mood}</div>)}
            </div>
        </div>
        {/* Expenses */}
        <div className="md:col-span-2">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><DollarSign size={20}/> Recent Expenses</h3>
             <div className="space-y-2">
                {expenses.slice(0, 5).map(e => <div key={e.id} className="p-2 bg-secondary rounded-md flex justify-between"><span>{e.description} ({e.category})</span> <span>${e.amount.toFixed(2)}</span></div>)}
            </div>
        </div>
        {/* Quotes */}
        <div className="md:col-span-2">
             <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><QuoteIcon size={20}/> Personal Quotes</h3>
             <div className="space-y-2 italic">
                {personalQuotes.map(q => <blockquote key={q.id} className="p-2 bg-secondary rounded-md border-l-4 border-primary">"{q.text}"</blockquote>)}
            </div>
        </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'braindump': return <AIBrainDump onAddTask={onAddTask} onAddEvent={onAddEvent} onAddQuickNote={handleAddQuickNote} onNewNote={onNewNote} />;
      case 'tasks': return <Tasks />;
      case 'kanban': return <Kanban />;
      case 'attendance': return <AttendanceManager classes={classes} students={students} attendance={attendance} onAddClass={onAddClass} onDeleteClass={onDeleteClass} onAddStudent={onAddStudent} onDeleteStudent={onDeleteStudent} onSetAttendance={onSetAttendance} onAddStudentsBatch={onAddStudentsBatch}/>;
      case 'calendar': return <CalendarComponent />;
      case 'timer': return <Pomodoro />;
      case 'decision': return <RandomDecisionMaker options={decisionOptions} setOptions={setDecisionOptions} result={decisionResult} setResult={setDecisionResult} isSpinning={isDecisionSpinning} setIsSpinning={setIsDecisionSpinning} currentSpin={currentDecisionSpin} setCurrentSpin={setCurrentDecisionSpin} />;
      case 'notes': return <QuickNotes />;
      case 'habits': return <HabitTracker />;
      case 'analytics': return <div className={`p-6 ${cardClasses}`}><h2 className="text-xl font-bold">Analytics</h2><p className="text-muted-foreground">Coming soon!</p></div>;
      case 'personal': return <Personal />;
      default: return <Dashboard />;
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-accent/20 overflow-y-auto p-4 sm:p-6 lg:p-8">
      {renderContent()}
    </main>
  );
};