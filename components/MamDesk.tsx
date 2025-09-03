import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, X, Play, Pause, RotateCcw, Calendar, Clock, BookOpen, 
  Target, Calculator, Palette, Sun, Moon, Edit3, Save, Trash2,
  CheckSquare, Square, ArrowRight, Timer, TrendingUp, Heart,
  // FIX: Removed 'Settings' to avoid conflict with local component, added 'AlertTriangle' for use in a modal.
  Link, FileText, Zap, Home, List, BarChart3, User, AlertTriangle,
  PlusCircle, MinusCircle, Copy, Check, RefreshCw, Star,
  ChevronLeft, ChevronRight, Download, Upload, Search, GripVertical, HelpCircleIcon,
  Notebook, DollarSign, Trophy, Smile, Quote as QuoteIcon, CircleDot, BrainCircuit as BrainCircuitIcon, Wand2, Loader, ArrowLeft, CheckCircle, ClipboardList, Eye, EyeOff
} from 'lucide-react';
import { HelpPage } from './HelpPage';
import RandomDecisionMaker from './RandomDecisionMaker';
import { Page } from '../App';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
// Fix: Corrected useToast import path
import { useToast } from './Toast';
import { updateApiKey } from './gemini';


declare const XLSX: any;

// Type Definitions
export interface Task {
  id: number;
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
    id: number;
    text: string;
    createdAt: string;
}

export interface CalendarEvent {
    id: number;
    title: string;
    date: string;
    time: string;
}

export interface Habit {
    id: number;
    name: string;
    streak: number;
    lastCompleted: string | null;
    history: { date: string; completed: boolean }[];
}

export interface Quote {
    id: number;
    text: string;
}

export interface MoodEntry {
    id: number;
    mood: string;
    date: string;
}
export interface Expense {
    id: number;
    description: string;
    amount: number;
    category: string;
    date: string;
}
export interface Goal {
    id: number;
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
    onToggleTask: (id: number) => void;
    onDeleteTask: (id: number) => void;
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
                                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-input border-border rounded-md px-3 py-2"/>
                                <button onClick={handleExportAttendance} className="bg-secondary text-secondary-foreground px-3 py-2 rounded-md hover:bg-secondary/80 flex items-center gap-2 text-sm active:scale-95 transition-transform" title="Export attendance for this class">
                                    <Download size={16} />
                                    Export
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-card">
                                    <tr className="border-b border-border">
                                        <th className="p-2">Name</th>
                                        <th className="p-2">Enrollment No.</th>
                                        <th className="p-2 text-center">Status</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentsInClass.map(student => (
                                        <tr key={student.id} className="border-b border-border/50 hover:bg-secondary/50">
                                            <td className="p-2 font-medium">{student.name}</td>
                                            <td className="p-2 text-muted-foreground">{student.enrollment}</td>
                                            <td className="p-2">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => onSetAttendance(selectedDate, student.id, 'Present')} className={`px-3 py-1 text-xs rounded-full transition-colors ${attendanceForDate[student.id] === 'Present' ? 'bg-green-500 text-white' : 'bg-secondary hover:bg-secondary/80'}`}>Present</button>
                                                    <button onClick={() => onSetAttendance(selectedDate, student.id, 'Absent')} className={`px-3 py-1 text-xs rounded-full transition-colors ${attendanceForDate[student.id] === 'Absent' ? 'bg-destructive text-white' : 'bg-secondary hover:bg-secondary/80'}`}>Absent</button>
                                                </div>
                                            </td>
                                            <td className="p-2 text-right">
                                                <button onClick={() => onDeleteStudent(student.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {studentsInClass.length === 0 && <p className="text-muted-foreground text-center py-8">No students in this class. Add one below.</p>}
                        </div>

                        {/* Add Student Section */}
                        <div className="mt-4 pt-4 border-t border-border">
                             {importFeedback && (
                                <div className={`mb-4 p-3 rounded-md flex items-center justify-between text-sm ${
                                    importFeedback.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        {importFeedback.type === 'success' ? <CheckCircle size={16}/> : <X size={16}/>}
                                        <span>{importFeedback.message}</span>
                                    </div>
                                    <button onClick={() => setImportFeedback(null)}><X size={16} /></button>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".xlsx, .xls"
                            />
                            <div
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                className={`mb-4 p-6 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
                                    isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                                }`}
                            >
                                <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">
                                    Drag & drop Excel file here, or{' '}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-primary font-semibold hover:underline focus:outline-none bg-transparent border-none p-0"
                                    >
                                        browse files
                                    </button>
                                    .
                                </p>
                                <div className="mt-2 text-xs text-muted-foreground bg-input/50 p-2 rounded-md inline-block">
                                    <p className="font-semibold">Required Format:</p>
                                    <p>Your Excel file must contain columns with headers like 'Name' and 'Enrollment' (or 'No').</p>
                                </div>
                            </div>

                            <form onSubmit={handleAddStudent} className="flex flex-wrap gap-2">
                                <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Student name" required className="flex-1 min-w-[150px] bg-input border-border rounded-md px-3 py-2"/>
                                <input type="text" value={newStudentEnrollment} onChange={e => setNewStudentEnrollment(e.target.value)} placeholder="Enrollment No." required className="flex-1 min-w-[150px] bg-input border-border rounded-md px-3 py-2"/>
                                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 active:scale-95 transition-transform">Add Student</button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <p>Please create and/or select a class to manage attendance.</p>
                    </div>
                )}
            </div>
        </div>
    )
}


const PersonalSuite: React.FC<{
    moodEntries: MoodEntry[];
    setMoodEntries: React.Dispatch<React.SetStateAction<MoodEntry[]>>;
    personalQuotes: Quote[];
    setPersonalQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
    goals: Goal[];
    setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
    expenses: Expense[];
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
    cardClasses: string;
}> = ({ moodEntries, setMoodEntries, personalQuotes, setPersonalQuotes, goals, setGoals, expenses, setExpenses, cardClasses }) => {
    const [newGoal, setNewGoal] = useState('');
    const [newQuote, setNewQuote] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    
    const moodOptions = ['😄', '😊', '😐', '😢', '😴'];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayMood = moodEntries.find(e => e.date === todayStr);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Personal Suite</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${cardClasses} p-6`}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><Smile /> Mood Tracker</h3>
                    <p className="text-sm text-muted-foreground mb-4">How are you feeling today?</p>
                    <div className="flex justify-around bg-secondary p-2 rounded-lg">
                        {moodOptions.map(mood => (
                            <button key={mood} onClick={() => setMoodEntries(prev => [...prev.filter(e => e.date !== todayStr), {id: Date.now(), mood, date: todayStr}])} className={`text-3xl p-2 rounded-md transition-transform hover:scale-125 ${todayMood?.mood === mood ? 'bg-primary/30' : ''}`}>{mood}</button>
                        ))}
                    </div>
                </div>
                <div className={`${cardClasses} p-6`}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><QuoteIcon /> My Quotes</h3>
                     <div className="flex gap-2 mb-2">
                        <input type="text" value={newQuote} onChange={e => setNewQuote(e.target.value)} placeholder="Add a new quote" className="flex-1 bg-input border-border rounded-md px-3 py-2"/>
                        <button onClick={() => { if(newQuote.trim()) { setPersonalQuotes(p => [...p, {id: Date.now(), text: newQuote}]); setNewQuote(''); } }} className="bg-primary px-4 py-2 rounded-md">+</button>
                    </div>
                    <div className="space-y-2 max-h-24 overflow-y-auto">
                       {personalQuotes.map(q => <div key={q.id} className="group flex justify-between items-center text-sm bg-secondary p-2 rounded-md"><i>"{q.text}"</i><button onClick={() => setPersonalQuotes(p => p.filter(pq => pq.id !== q.id))} className="text-destructive opacity-0 group-hover:opacity-100"><X size={14}/></button></div>)}
                    </div>
                </div>
                <div className={`${cardClasses} p-6`}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy /> Goal Setter</h3>
                     <div className="flex gap-2 mb-2">
                        <input type="text" value={newGoal} onChange={e => setNewGoal(e.target.value)} placeholder="Define a new goal" className="flex-1 bg-input border-border rounded-md px-3 py-2"/>
                        <button onClick={() => { if(newGoal.trim()) { setGoals(g => [...g, {id: Date.now(), text: newGoal, completed: false}]); setNewGoal(''); } }} className="bg-primary px-4 py-2 rounded-md">+</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                       {goals.map(g => <div key={g.id} className="group flex justify-between items-center bg-secondary p-2 rounded-md"><div className="flex items-center gap-2"><button onClick={() => setGoals(gs => gs.map(goal => goal.id === g.id ? {...goal, completed: !goal.completed} : goal))}>{g.completed ? <CheckSquare className="text-green-500"/> : <Square/>}</button><span className={g.completed ? 'line-through text-muted-foreground' : ''}>{g.text}</span></div><button onClick={() => setGoals(gs => gs.filter(goal => goal.id !== g.id))} className="text-destructive opacity-0 group-hover:opacity-100"><X size={14}/></button></div>)}
                    </div>
                </div>
                <div className={`${cardClasses} p-6`}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign /> Expense Tracker</h3>
                     <form onSubmit={(e) => { e.preventDefault(); if (expenseAmount) { setExpenses(ex => [{id: Date.now(), description: expenseDesc, amount: parseFloat(expenseAmount), category: 'General', date: new Date().toISOString()}, ...ex]); setExpenseDesc(''); setExpenseAmount('');} }} className="grid grid-cols-3 gap-2 mb-2">
                        <input required value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Description" className="col-span-2 bg-input border-border rounded-md px-3 py-2"/>
                        <input required value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} type="number" placeholder="Amount" className="bg-input border-border rounded-md px-3 py-2"/>
                        <button type="submit" className="col-span-3 bg-primary py-2 rounded-md">Add Expense</button>
                    </form>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                       {expenses.slice(0, 10).map(ex => <div key={ex.id} className="flex justify-between items-center text-sm bg-secondary p-2 rounded-md"><span>{ex.description}</span><span className="font-mono">${ex.amount.toFixed(2)}</span></div>)}
                    </div>
                </div>
             </div>
        </div>
    );
};

const HabitTracker: React.FC<{
    habits: Habit[];
    setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
    cardClasses: string;
}> = ({ habits, setHabits, cardClasses }) => {
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        return d;
    }).reverse();

    const [newHabit, setNewHabit] = useState('');
    const handleAddHabit = () => {
      if (newHabit.trim()) {
          setHabits(prev => [...prev, { id: Date.now(), name: newHabit.trim(), streak: 0, lastCompleted: null, history: [] }]);
          setNewHabit('');
      }
    };
    const completeHabit = (id: number) => {
        const todayStr = new Date().toDateString();
        setHabits(habits.map(h => {
            if (h.id === id && h.lastCompleted !== todayStr) {
                 const yesterday = new Date();
                 yesterday.setDate(yesterday.getDate() - 1);
                 const isConsecutive = h.lastCompleted === yesterday.toDateString();
                 return { ...h, streak: isConsecutive ? h.streak + 1 : 1, lastCompleted: todayStr, history: [...h.history, { date: todayStr, completed: true }] };
            }
            return h;
        }));
    };
    const deleteHabit = (id: number) => setHabits(habits.filter(h => h.id !== id));

    return (
        <div className={`${cardClasses} p-6`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target />
                Habit Tracker
            </h2>
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newHabit}
                    onChange={e => setNewHabit(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddHabit()}
                    placeholder="e.g., Read for 15 minutes"
                    className="flex-1 bg-input border-border rounded-md px-3 py-2 focus:ring-ring focus:border-primary"
                />
                <button onClick={handleAddHabit} className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2">
                    <Plus size={16}/> Add
                </button>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
                {habits.length > 0 ? habits.map(habit => {
                    const isCompletedToday = habit.lastCompleted === today.toDateString();
                    return (
                        <div key={habit.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between bg-secondary p-4 rounded-lg transition-all hover:bg-secondary/80">
                            <div className="mb-3 sm:mb-0">
                                <p className="font-semibold text-foreground">{habit.name}</p>
                                <p className="text-sm text-yellow-400 flex items-center gap-1.5 mt-1">
                                    <span>🔥</span>
                                    {habit.streak} day streak
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5" title="Last 7 days">
                                    {last7Days.map((day, index) => {
                                        const dayString = day.toDateString();
                                        const completed = habit.history.some(h => h.date === dayString && h.completed);
                                        const isToday = dayString === today.toDateString();
                                        return (
                                            <div
                                                key={index}
                                                className={`w-4 h-4 rounded-sm ${completed ? 'bg-green-500' : 'bg-muted'} ${isToday ? 'ring-2 ring-offset-2 ring-offset-secondary ring-primary' : ''}`}
                                                title={`${day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} - ${completed ? 'Completed' : 'Not Completed'}`}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => completeHabit(habit.id)}
                                        disabled={isCompletedToday}
                                        className={`p-2 rounded-md transition-colors ${isCompletedToday ? 'bg-green-500 text-white cursor-not-allowed' : 'bg-muted hover:bg-green-600'}`}
                                        aria-label={`Mark habit '${habit.name}' as complete`}
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button 
                                        onClick={() => deleteHabit(habit.id)} 
                                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={`Delete habit '${habit.name}'`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                     <div className="text-center py-12 text-muted-foreground">
                        <Target size={32} className="mx-auto mb-4"/>
                        <h3 className="font-semibold text-lg text-foreground/80">Track your first habit</h3>
                        <p>Consistency is key. Add a new habit above to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarView: React.FC<{ events: CalendarEvent[]; onAddEvent: (title: string, date: string, time: string) => void; cardClasses: string; }> = ({ events, onAddEvent, cardClasses }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('12:00');

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = Array(firstDayOfMonth).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    
    const selectedDateString = formatDateToYYYYMMDD(selectedDate);
    const eventsOnSelectedDate = events.filter(e => e.date === selectedDateString).sort((a,b) => a.time.localeCompare(b.time));

    const handleAddEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if(newEventTitle.trim()) {
            onAddEvent(newEventTitle, selectedDateString, newEventTime);
            setNewEventTitle('');
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className={`lg:col-span-2 ${cardClasses} p-6 flex flex-col`}>
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-md hover:bg-accent"><ChevronLeft/></button>
                    <h2 className="text-xl font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-md hover:bg-accent"><ChevronRight/></button>
                </div>
                <div className="grid grid-cols-7 text-center text-sm text-muted-foreground mb-2">
                    {daysOfWeek.map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 flex-1">
                    {calendarDays.map((day, index) => {
                        if (!day) return <div key={`blank-${index}`}></div>;
                        const dayDate = new Date(year, month, day);
                        const dayString = formatDateToYYYYMMDD(dayDate);
                        const isToday = dayString === formatDateToYYYYMMDD(new Date());
                        const isSelected = dayString === selectedDateString;
                        const hasEvents = events.some(e => e.date === dayString);

                        return (
                            <button 
                                key={day} 
                                onClick={() => setSelectedDate(dayDate)}
                                className={`h-16 flex flex-col items-center justify-center rounded-lg transition-colors text-foreground p-1
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${!isSelected && isToday ? 'bg-accent text-accent-foreground' : ''}
                                ${!isSelected && !isToday ? 'hover:bg-accent/50' : ''}`}
                            >
                                <span className="text-sm font-medium">{day}</span>
                                {hasEvents && <CircleDot size={12} className={`mt-1 ${isSelected ? 'text-primary-foreground/80' : 'text-primary'}`} />}
                            </button>
                        );
                    })}
                </div>
            </div>
             <div className={`${cardClasses} p-6 flex flex-col`}>
                <h3 className="text-lg font-bold mb-4">Events on {selectedDate.toLocaleDateString(undefined, {month: 'long', day: 'numeric'})}</h3>
                <div className="flex-1 space-y-3 overflow-y-auto">
                    {eventsOnSelectedDate.length > 0 ? eventsOnSelectedDate.map(event => (
                        <div key={event.id} className="p-3 bg-secondary rounded-lg">
                            <p className="font-semibold">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.time}</p>
                        </div>
                    )) : <p className="text-muted-foreground text-sm">No events scheduled.</p>}
                </div>
                 <form onSubmit={handleAddEvent} className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-semibold mb-2">Add New Event</h4>
                    <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Event title" required className="w-full bg-input border-border rounded-md px-3 py-2 mb-2"/>
                    <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} required className="w-full bg-input border-border rounded-md px-3 py-2 mb-2"/>
                    <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md">Add Event</button>
                </form>
            </div>
        </div>
    );
};


const Settings: React.FC<{
    theme: string;
    setTheme: (theme: string) => void;
    pages: Page[];
}> = ({ theme, setTheme, pages }) => {
    const toast = useToast();
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini-api-key') || '');
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleApiKeySave = () => {
        updateApiKey(apiKey);
        toast.success("API Key updated successfully!");
    };
    
    const handleExport = () => {
        try {
            const dataToExport: { [key: string]: any } = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('maven-')) {
                    dataToExport[key] = JSON.parse(localStorage.getItem(key)!);
                }
            }
            // Manually add pages since their key doesn't follow the pattern
            dataToExport['ai-notes-pages'] = JSON.parse(localStorage.getItem('ai-notes-pages')!);
            
            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `maven_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Data exported successfully!");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export data.");
        }
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                Object.keys(data).forEach(key => {
                    localStorage.setItem(key, JSON.stringify(data[key]));
                });
                toast.success("Data imported successfully! The app will now reload.");
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                 console.error("Import failed:", error);
                toast.error("Failed to import data. The file may be invalid.");
            }
        };
        reader.readAsText(file);
    };
    
     const handleWipeData = () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('maven-') || key.startsWith('ai-notes-')) {
                localStorage.removeItem(key);
            }
        });
        toast.success("All data has been wiped. The app will now reload.");
        setTimeout(() => window.location.reload(), 2000);
    };

    const themes = [
        { id: 'dark', name: 'Dark', bg: 'bg-gray-800' },
        { id: 'light', name: 'Light', bg: 'bg-gray-100' },
        { id: 'midlight', name: 'Midlight', bg: 'bg-cyan-900' },
        { id: 'midnight', name: 'Midnight', bg: 'bg-blue-900' },
    ];

    return (
        <div className="p-6 space-y-8 max-w-4xl mx-auto">
             {showConfirmation && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-destructive rounded-xl shadow-lg w-full max-w-md p-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4"/>
                        <h2 className="text-xl font-bold mb-2">Are you absolutely sure?</h2>
                        <p className="text-muted-foreground mb-6">
                            This action is irreversible and will permanently delete all your notes, tasks, settings, and other data from this browser.
                        </p>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowConfirmation(false)} className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">Cancel</button>
                            <button onClick={handleWipeData} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">Yes, Wipe All Data</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Theme</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {themes.map(t => (
                        <button key={t.id} onClick={() => setTheme(t.id)} className={`p-4 rounded-lg border-2 transition-colors ${theme === t.id ? 'border-primary' : 'border-transparent'}`}>
                            <div className={`w-full h-16 rounded-md ${t.bg} mb-2`}></div>
                            <p className="font-semibold">{t.name}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                 <h2 className="text-xl font-bold mb-4">API Configuration</h2>
                 <p className="text-sm text-muted-foreground mb-4">
                    Enter your Google Gemini API key to enable AI features like the Chatbot and AI Brain Dump. Your key is stored locally and never sent anywhere except to Google's API.
                 </p>
                 <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type={apiKeyVisible ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key"
                            className="w-full bg-input border-border rounded-md px-4 py-2 pr-10"
                        />
                        <button onClick={() => setApiKeyVisible(!apiKeyVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground">
                            {apiKeyVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                        </button>
                    </div>
                    <button onClick={handleApiKeySave} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">Save Key</button>
                 </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                 <h2 className="text-xl font-bold mb-4">Data Management</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-secondary rounded-lg">
                        <h3 className="font-semibold mb-2">Export Data</h3>
                        <p className="text-sm text-muted-foreground mb-4">Download a JSON file containing all your notes, tasks, and settings.</p>
                        <button onClick={handleExport} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md">Export All Data</button>
                    </div>
                     <div className="p-4 bg-secondary rounded-lg">
                        <h3 className="font-semibold mb-2">Import Data</h3>
                        <p className="text-sm text-muted-foreground mb-4">Import data from a previously exported JSON file. This will overwrite existing data.</p>
                        <label className="w-full block cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-md text-center">
                            Import Data File
                            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                        </label>
                    </div>
                 </div>
                 <div className="mt-6 pt-6 border-t border-destructive/20">
                     <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
                     <p className="text-sm text-muted-foreground mb-4">This action will permanently delete all your data from this browser. This cannot be undone.</p>
                     <button onClick={() => setShowConfirmation(true)} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md">Wipe All Local Data</button>
                 </div>
            </div>
        </div>
    );
};


const Analytics: React.FC<{
    tasks: Task[];
    pages: Page[];
    habits: Habit[];
}> = ({ tasks, pages, habits }) => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalPages = pages.length;

    const totalHabitCompletions = habits.reduce((acc, h) => acc + h.history.filter(day => day.completed).length, 0);

    return (
        <div className="p-6 space-y-8 max-w-4xl mx-auto">
             <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Productivity Overview</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-secondary rounded-lg text-center">
                        <p className="text-3xl font-bold">{totalTasks}</p>
                        <p className="text-sm text-muted-foreground">Total Tasks Created</p>
                    </div>
                     <div className="p-4 bg-secondary rounded-lg text-center">
                        <p className="text-3xl font-bold">{taskCompletionRate}%</p>
                        <p className="text-sm text-muted-foreground">Task Completion Rate</p>
                    </div>
                     <div className="p-4 bg-secondary rounded-lg text-center">
                        <p className="text-3xl font-bold">{totalPages}</p>
                        <p className="text-sm text-muted-foreground">Total Notes</p>
                    </div>
                     <div className="p-4 bg-secondary rounded-lg text-center">
                        <p className="text-3xl font-bold">{habits.length}</p>
                        <p className="text-sm text-muted-foreground">Habits Tracked</p>
                    </div>
                     <div className="p-4 bg-secondary rounded-lg text-center">
                        <p className="text-3xl font-bold">{totalHabitCompletions}</p>
                        <p className="text-sm text-muted-foreground">Total Habit Completions</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


const KanbanBoard: React.FC<{
    columns: KanbanState;
    setColumns: React.Dispatch<React.SetStateAction<KanbanState>>;
    onAddCard: (columnId: string, text: string) => void;
}> = ({ columns, setColumns, onAddCard }) => {
    const [draggedItem, setDraggedItem] = useState<{ colId: string; item: KanbanItem } | null>(null);
    const [newCardText, setNewCardText] = useState<{ [key: string]: string }>({});

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: KanbanItem, colId: string) => {
        setDraggedItem({ colId, item });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColId: string) => {
        e.preventDefault();
        if (!draggedItem) return;

        const { colId: sourceColId, item } = draggedItem;

        if (sourceColId === targetColId) {
            setDraggedItem(null);
            return;
        }

        const newColumns = { ...columns };
        // Remove from source
        newColumns[sourceColId].items = newColumns[sourceColId].items.filter(i => i.id !== item.id);
        // Add to target
        newColumns[targetColId].items.push(item);
        
        setColumns(newColumns);
        setDraggedItem(null);
    };

    const handleAddCard = (colId: string) => {
        const text = newCardText[colId]?.trim();
        if (text) {
            onAddCard(colId, text);
            setNewCardText(prev => ({ ...prev, [colId]: '' }));
        }
    };
    
    return (
        <div className="p-6 flex gap-6 h-full overflow-x-auto">
            {Object.entries(columns).map(([columnId, column]) => (
                <div key={columnId} className="w-80 flex-shrink-0 bg-card border border-border rounded-xl shadow-lg flex flex-col">
                    <h3 className="text-lg font-semibold p-4 border-b border-border">{column.name}</h3>
                    <div 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, columnId)}
                        className="flex-1 p-4 space-y-3 overflow-y-auto"
                    >
                        {column.items.map(item => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item, columnId)}
                                className="p-3 bg-secondary rounded-lg shadow cursor-grab active:cursor-grabbing"
                            >
                                <p className="text-sm">{item.text}</p>
                            </div>
                        ))}
                    </div>
                     <div className="p-4 border-t border-border">
                        <div className="flex gap-2">
                             <input
                                type="text"
                                value={newCardText[columnId] || ''}
                                onChange={e => setNewCardText(prev => ({ ...prev, [columnId]: e.target.value }))}
                                onKeyPress={e => e.key === 'Enter' && handleAddCard(columnId)}
                                placeholder="Add new card..."
                                className="flex-1 bg-input border-border rounded-md px-3 py-2"
                            />
                            <button onClick={() => handleAddCard(columnId)} className="px-4 py-2 bg-primary text-primary-foreground rounded-md"><Plus size={16}/></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};


const TaskList: React.FC<{
    tasks: Task[];
    onAddTask: (text: string) => void;
    onToggleTask: (id: number) => void;
    onDeleteTask: (id: number) => void;
}> = ({ tasks, onAddTask, onToggleTask, onDeleteTask }) => {
    const [newTask, setNewTask] = useState('');
    const handleAddTask = () => {
        if (newTask.trim()) {
            onAddTask(newTask);
            setNewTask('');
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto bg-card border border-border rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><CheckSquare /> My Tasks</h2>
             <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddTask()}
                    placeholder="e.g., Finish Q3 report"
                    className="flex-1 bg-input border-border rounded-md px-4 py-3 focus:ring-ring focus:border-primary"
                />
                <button onClick={handleAddTask} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Add Task</button>
            </div>
            <div className="space-y-3">
                {tasks.filter(t => !t.completed).map(task => (
                    <div key={task.id} className="group flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                            <button onClick={() => onToggleTask(task.id)} className="flex-shrink-0"><Square size={20} className="text-muted-foreground" /></button>
                            <span className="text-foreground/90">{task.text}</span>
                        </div>
                        <button onClick={() => onDeleteTask(task.id)} className="text-destructive opacity-0 group-hover:opacity-100"><X size={16}/></button>
                    </div>
                ))}
            </div>
             {tasks.some(t => t.completed) && (
                <div className="mt-6 pt-4 border-t border-border">
                    <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Completed</h3>
                    <div className="space-y-3">
                        {tasks.filter(t => t.completed).map(task => (
                            <div key={task.id} className="group flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => onToggleTask(task.id)} className="flex-shrink-0"><CheckSquare size={20} className="text-green-500" /></button>
                                    <span className="text-muted-foreground line-through">{task.text}</span>
                                </div>
                                <button onClick={() => onDeleteTask(task.id)} className="text-destructive opacity-0 group-hover:opacity-100"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
             )}
        </div>
    );
};

const QuickNotes: React.FC<{
    notes: QuickNote[];
    setNotes: React.Dispatch<React.SetStateAction<QuickNote[]>>;
}> = ({ notes, setNotes }) => {
    const [newNote, setNewNote] = useState('');
    
    const addNote = () => {
        if(newNote.trim()){
            setNotes(prev => [{id: Date.now(), text: newNote, createdAt: new Date().toISOString()}, ...prev]);
            setNewNote('');
        }
    }
    
    const deleteNote = (id: number) => {
        setNotes(prev => prev.filter(n => n.id !== id));
    }

    return (
         <div className="p-6 max-w-2xl mx-auto bg-card border border-border rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><FileText /> Quick Notes</h2>
            <div className="flex gap-2 mb-6">
                <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyPress={e => e.key === 'Enter' && addNote()} placeholder="Jot something down..." className="flex-1 bg-input border-border rounded-md px-4 py-3"/>
                <button onClick={addNote} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">Add Note</button>
            </div>
             <div className="space-y-3 max-h-96 overflow-y-auto">
                {notes.map(note => (
                    <div key={note.id} className="group flex items-start justify-between p-3 bg-secondary rounded-lg">
                        <p className="flex-1 text-foreground/90">{note.text}</p>
                        <button onClick={() => deleteNote(note.id)} className="ml-4 text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0"><X size={16}/></button>
                    </div>
                ))}
            </div>
        </div>
    )
}

const PomodoroTimer: React.FC<{
    time: number;
    active: boolean;
    sessions: number;
    onToggle: () => void;
    onReset: () => void;
}> = ({ time, active, sessions, onToggle, onReset }) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    return (
        <div className="p-6 max-w-sm mx-auto bg-card border border-border rounded-xl shadow-lg text-center">
            <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><Timer /> Pomodoro Timer</h2>
            <p className="text-7xl font-mono font-bold text-primary mb-6">{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</p>
            <div className="flex justify-center gap-4 mb-4">
                <button onClick={onToggle} className="w-24 px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center justify-center gap-2">
                    {active ? <><Pause size={16}/> Pause</> : <><Play size={16}/> Start</>}
                </button>
                <button onClick={onReset} className="w-24 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center justify-center gap-2">
                    <RotateCcw size={16}/> Reset
                </button>
            </div>
             <p className="text-sm text-muted-foreground">Completed sessions: {sessions}</p>
        </div>
    )
};

// FIX: Changed to a named export to resolve circular dependency.
export const MamDesk: React.FC<MamDeskProps> = ({
  activeTab, tasks, onAddTask, onToggleTask, onDeleteTask, kanbanColumns, setKanbanColumns, onAddKanbanCard,
  quickNotes, setQuickNotes, events, onAddEvent, habits, setHabits, pomodoroTime, pomodoroActive, pomodoroSessions, onTogglePomodoro, onResetPomodoro,
  decisionOptions, setDecisionOptions, decisionResult, setDecisionResult, isDecisionSpinning, setIsDecisionSpinning, currentDecisionSpin, setCurrentDecisionSpin, theme, setTheme, pages,
  classes, students, attendance, onAddClass, onDeleteClass, onAddStudent, onDeleteStudent, onSetAttendance, onAddStudentsBatch, onNewNote,
  personalQuotes, setPersonalQuotes, moodEntries, setMoodEntries, expenses, setExpenses, goals, setGoals
}) => {
    const cardClasses = "bg-card border border-border rounded-xl shadow-lg";

    return (
      <div className="flex-1 flex flex-col bg-background overflow-y-auto">
        {activeTab === 'dashboard' ? (
           <AIBrainDump onAddTask={onAddTask} onAddEvent={onAddEvent} onAddQuickNote={(text) => setQuickNotes(prev => [{id: Date.now(), text, createdAt: new Date().toISOString()}, ...prev])} onNewNote={onNewNote} />
        ) : activeTab === 'braindump' ? (
           <AIBrainDump onAddTask={onAddTask} onAddEvent={onAddEvent} onAddQuickNote={(text) => setQuickNotes(prev => [{id: Date.now(), text, createdAt: new Date().toISOString()}, ...prev])} onNewNote={onNewNote} />
        ) : activeTab === 'tasks' ? (
           <TaskList tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} />
        ) : activeTab === 'kanban' ? (
           <KanbanBoard columns={kanbanColumns} setColumns={setKanbanColumns} onAddCard={onAddKanbanCard} />
        ) : activeTab === 'attendance' ? (
           <div className="p-6 h-full"><AttendanceManager classes={classes} students={students} attendance={attendance} onAddClass={onAddClass} onDeleteClass={onDeleteClass} onAddStudent={onAddStudent} onDeleteStudent={onDeleteStudent} onSetAttendance={onSetAttendance} onAddStudentsBatch={onAddStudentsBatch}/></div>
        ) : activeTab === 'calendar' ? (
           <div className="p-6 h-full"><CalendarView events={events} onAddEvent={onAddEvent} cardClasses={cardClasses}/></div>
        ) : activeTab === 'timer' ? (
           <div className="p-6"><PomodoroTimer time={pomodoroTime} active={pomodoroActive} sessions={pomodoroSessions} onToggle={onTogglePomodoro} onReset={onResetPomodoro} /></div>
        ) : activeTab === 'decision' ? (
            <div className="p-6"><RandomDecisionMaker options={decisionOptions} setOptions={setDecisionOptions} result={decisionResult} setResult={setDecisionResult} isSpinning={isDecisionSpinning} setIsSpinning={setIsDecisionSpinning} currentSpin={currentDecisionSpin} setCurrentSpin={setCurrentDecisionSpin} /></div>
        ) : activeTab === 'notes' ? (
            <div className="p-6"><QuickNotes notes={quickNotes} setNotes={setQuickNotes}/></div>
        ) : activeTab === 'habits' ? (
            <div className="p-6 h-full"><HabitTracker habits={habits} setHabits={setHabits} cardClasses={cardClasses} /></div>
        ) : activeTab === 'analytics' ? (
            <Analytics tasks={tasks} pages={pages} habits={habits}/>
        ) : activeTab === 'personal' ? (
            <div className="p-6"><PersonalSuite moodEntries={moodEntries} setMoodEntries={setMoodEntries} personalQuotes={personalQuotes} setPersonalQuotes={setPersonalQuotes} goals={goals} setGoals={setGoals} expenses={expenses} setExpenses={setExpenses} cardClasses={cardClasses}/></div>
        ) : activeTab === 'settings' ? (
            <Settings theme={theme} setTheme={setTheme} pages={pages} />
        ) : activeTab === 'help' ? (
            <div className="p-6"><HelpPage /></div>
        ) : null}
      </div>
    );
};