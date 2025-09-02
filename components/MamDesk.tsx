import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, X, Play, Pause, RotateCcw, Calendar, Clock, BookOpen, 
  Target, Calculator, Palette, Sun, Moon, Edit3, Save, Trash2,
  CheckSquare, Square, ArrowRight, Timer, TrendingUp, Heart,
  Link, FileText, Zap, Settings, Home, List, BarChart3, User,
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
                                <p className="text-xs text-muted-foreground mt-1">
                                    Requires columns for name (e.g. 'Name') and enrollment (e.g. 'Enrollment', 'No').
                                </p>
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
                <h3 className="text-lg font-bold mb-4">Events for {selectedDate.toLocaleDateString(undefined, {month: 'long', day: 'numeric'})}</h3>
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {eventsOnSelectedDate.length > 0 ? eventsOnSelectedDate.map(event => (
                        <div key={event.id} className="bg-secondary p-3 rounded-lg">
                            <p className="font-semibold">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.time}</p>
                        </div>
                    )) : (
                        <p className="text-muted-foreground text-center pt-8">No events scheduled.</p>
                    )}
                </div>
                <form onSubmit={handleAddEvent} className="mt-auto pt-4 border-t border-border">
                    <h4 className="font-semibold mb-2">Add New Event</h4>
                    <input value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Event Title" required className="w-full bg-input border-border rounded-md px-3 py-2 mb-2"/>
                    <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} required className="w-full bg-input border-border rounded-md px-3 py-2 mb-2"/>
                    <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90">Add Event</button>
                </form>
            </div>
        </div>
    );
};


const MamDesk: React.FC<MamDeskProps> = (props) => {
  const {
      activeTab, pages,
      tasks, onAddTask, onToggleTask, onDeleteTask,
      kanbanColumns, setKanbanColumns, onAddKanbanCard,
      quickNotes, setQuickNotes,
      events, onAddEvent,
      habits, setHabits,
      personalQuotes, setPersonalQuotes,
      moodEntries, setMoodEntries,
      expenses, setExpenses,
      goals, setGoals,
      pomodoroTime,
      pomodoroActive,
      pomodoroSessions,
      onTogglePomodoro,
      onResetPomodoro,
      theme,
      setTheme,
      classes, students, attendance,
      onAddClass, onDeleteClass, onAddStudent, onDeleteStudent, onSetAttendance,
      onAddStudentsBatch,
      onNewNote
  } = props;
  
  // Local UI State
  const [newTask, setNewTask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [draggedItem, setDraggedItem] = useState<{ item: KanbanItem; sourceColumnId: string } | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('gemini-api-key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaveState, setApiKeySaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const toast = useToast();
  
  const handleAddTaskUI = () => {
      onAddTask(newTask);
      setNewTask('');
  };

  const handleAddQuickNote = (text: string) => {
    if (text.trim()) {
        setQuickNotes(prev => [{ id: Date.now(), text, createdAt: new Date().toISOString() }, ...prev]);
    }
  };

  const addNoteUI = () => {
    if (newNote.trim()) {
        setQuickNotes(prev => [{ id: Date.now(), text: newNote, createdAt: new Date().toISOString() }, ...prev]);
        setNewNote('');
    }
  };
  const deleteNote = (id: number) => setQuickNotes(quickNotes.filter(n => n.id !== id));
  
  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const formatDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const handleDragStart = (item: KanbanItem, sourceColumnId: string) => {
        setDraggedItem({ item, sourceColumnId });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (targetColumnId: string) => {
        if (!draggedItem) return;
        const { item, sourceColumnId } = draggedItem;
        if (sourceColumnId === targetColumnId) return;

        const newColumns = { ...kanbanColumns };
        const sourceItems = newColumns[sourceColumnId].items.filter(i => i.id !== item.id);
        const targetItems = [...newColumns[targetColumnId].items, item];
        newColumns[sourceColumnId] = { ...newColumns[sourceColumnId], items: sourceItems };
        newColumns[targetColumnId] = { ...newColumns[targetColumnId], items: targetItems };
        
        setKanbanColumns(newColumns);
    };

  // Export/Import
  const exportData = () => {
    const dataToExport = Object.keys(localStorage)
      .filter(key => key.startsWith('maven-') || key.startsWith('ai-notes-') || key === 'gemini-api-key')
      .reduce((obj, key) => {
        obj[key] = localStorage.getItem(key);
        return obj;
      }, {} as {[key: string]: string | null});
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maven-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully!");
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (e.target && typeof e.target.result === 'string') {
                const importedData = JSON.parse(e.target.result);
                Object.keys(importedData).forEach(key => {
                    if ((key.startsWith('maven-') || key.startsWith('ai-notes-') || key === 'gemini-api-key') && importedData[key]) {
                        localStorage.setItem(key, importedData[key]);
                    }
                });
                toast.success('Data imported! The page will now reload.');
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error) {
            console.error('Failed to import data:', error);
            toast.error('Error importing data. Please use a valid backup file.');
        }
    };
    reader.readAsText(file);
  };
  
  const handleSaveApiKey = () => {
    setApiKeySaveState('saving');
    updateApiKey(apiKeyInput.trim());
    setTimeout(() => {
        setApiKeySaveState('saved');
        setTimeout(() => setApiKeySaveState('idle'), 2000);
    }, 500);
  };
  
  const cardClasses = "bg-card border border-border rounded-xl shadow-lg";

  const renderContent = () => {
    switch (activeTab) {
        case 'dashboard':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className={`${cardClasses} p-6 lg:col-span-2`}>
                         <h3 className="font-semibold mb-4 text-lg flex items-center gap-2"><ClipboardList /> Today's Focus</h3>
                         <div className="flex gap-2 mb-4">
                            <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddTaskUI()} placeholder="Add a new task..." className="flex-1 bg-input border-border rounded-md px-3 py-2 focus:ring-ring focus:border-primary" />
                            <button onClick={handleAddTaskUI} className="bg-primary px-4 py-2 rounded-md hover:bg-primary/90 active:scale-95 transition-transform">Add Task</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {tasks.filter(t => !t.completed).map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-secondary p-3 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => onToggleTask(t.id)}><Square /></button>
                                        <span>{t.text}</span>
                                    </div>
                                    <button onClick={() => onDeleteTask(t.id)} className="text-muted-foreground hover:text-destructive"><X size={16}/></button>
                                </div>
                            ))}
                            {tasks.filter(t => !t.completed).length === 0 && <p className="text-muted-foreground text-center py-4">No pending tasks. Well done!</p>}
                        </div>
                    </div>
                    <div className={`${cardClasses} p-6`}>
                        <h3 className="font-semibold mb-4 text-lg flex items-center gap-2"><Notebook /> Quick Notes</h3>
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Jot down a quick thought..."
                            className="w-full bg-input border-border rounded-md px-3 py-2 mb-2 focus:ring-ring focus:border-primary min-h-[60px]"
                        />
                        <button onClick={addNoteUI} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 w-full active:scale-95 transition-transform">Save Note</button>
                         <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                             {quickNotes.map(note => (
                                <div key={note.id} className="group flex justify-between items-start bg-secondary p-3 rounded-md">
                                    <p className="text-sm text-foreground/90 whitespace-pre-wrap flex-1 mr-2">{note.text}</p>
                                    <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                                </div>
                             ))}
                         </div>
                    </div>
                     <div className={`${cardClasses} p-6 flex flex-col items-center justify-center text-center`}>
                        <h3 className="font-semibold mb-2 text-lg flex items-center gap-2"><Timer /> Pomodoro Timer</h3>
                        <div className="text-7xl font-mono font-bold my-4 text-primary">{formatTime(pomodoroTime)}</div>
                        <div className="flex justify-center gap-4">
                            <button onClick={onTogglePomodoro} className={`px-5 py-2 rounded-lg text-white transition-all active:scale-95 ${pomodoroActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}>{pomodoroActive ? 'Pause' : 'Start'}</button>
                            <button onClick={onResetPomodoro} className="px-5 py-2 rounded-lg bg-secondary text-secondary-foreground active:scale-95 transition-transform">Reset</button>
                        </div>
                    </div>
                </div>
            );
        case 'braindump':
            return <AIBrainDump onAddTask={onAddTask} onAddEvent={onAddEvent} onAddQuickNote={handleAddQuickNote} onNewNote={onNewNote} />;
        case 'tasks':
             return (
                <div className={`${cardClasses} p-6`}>
                    <h2 className="text-xl font-bold mb-4">Task Management</h2>
                    <div className="flex gap-2 mb-4">
                        <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddTaskUI()} placeholder="Add new task" className="flex-1 bg-input border-border rounded-md px-3 py-2 focus:ring-ring focus:border-primary" />
                        <button onClick={handleAddTaskUI} className="bg-primary px-4 py-2 rounded-md hover:bg-primary/90">Add</button>
                    </div>
                    <div className="space-y-2">
                        {tasks.map(t => (
                            <div key={t.id} className="flex items-center justify-between bg-secondary p-3 rounded-md">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => onToggleTask(t.id)}>{t.completed ? <CheckSquare className="text-green-500" /> : <Square />}</button>
                                    <span className={t.completed ? 'line-through text-muted-foreground' : ''}>{t.text}</span>
                                </div>
                                <button onClick={() => onDeleteTask(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'kanban':
            return (
                <div className="p-1">
                    <h2 className="text-xl font-bold mb-4 px-5">Kanban Board</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.entries(kanbanColumns).map(([columnId, column]) => (
                        <div
                            key={columnId}
                            className={`${cardClasses} p-4 flex flex-col transition-all duration-200 ${dragOverColumnId === columnId ? 'bg-accent scale-[1.02]' : ''}`}
                            onDragOver={handleDragOver}
                            onDragEnter={() => setDragOverColumnId(columnId)}
                            onDragLeave={() => setDragOverColumnId(null)}
                            onDrop={() => { handleDrop(columnId); setDragOverColumnId(null); }}
                        >
                            <h3 className="font-semibold mb-4 capitalize">{column.name} ({column.items.length})</h3>
                            <div className="space-y-3 flex-1 min-h-[100px]">
                                {column.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`bg-background/80 p-3 rounded-md text-sm cursor-grab active:cursor-grabbing transition-opacity ${draggedItem?.item.id === item.id ? 'opacity-30' : 'opacity-100'}`}
                                        draggable
                                        onDragStart={() => handleDragStart(item, columnId)}
                                        onDragEnd={() => setDraggedItem(null)}
                                    >
                                        {item.text}
                                    </div>
                                ))}
                            </div>
                            <input
                                type="text"
                                placeholder="+ Add a card"
                                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                        onAddKanbanCard(columnId, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                                className="mt-4 w-full bg-transparent text-sm placeholder-muted-foreground focus:outline-none"
                            />
                        </div>
                    ))}
                    </div>
                </div>
            );
        case 'attendance':
            return <AttendanceManager 
                classes={classes}
                students={students}
                attendance={attendance}
                onAddClass={onAddClass}
                onDeleteClass={onDeleteClass}
                onAddStudent={onAddStudent}
                onDeleteStudent={onDeleteStudent}
                onSetAttendance={onSetAttendance}
                onAddStudentsBatch={onAddStudentsBatch}
            />;
        case 'timer':
            return (
                <div className={`max-w-md mx-auto text-center ${cardClasses} p-8`}>
                    <h2 className="text-xl font-bold mb-4">Pomodoro Timer</h2>
                    <div className="text-7xl font-mono font-bold my-8 text-primary">{formatTime(pomodoroTime)}</div>
                    <div className="flex justify-center gap-4">
                        <button onClick={onTogglePomodoro} className={`px-6 py-3 rounded-lg text-white ${pomodoroActive ? 'bg-destructive' : 'bg-green-600'}`}>{pomodoroActive ? 'Pause' : 'Start'}</button>
                        <button onClick={onResetPomodoro} className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground">Reset</button>
                    </div>
                    <p className="mt-8">Sessions completed: {pomodoroSessions}</p>
                </div>
            );
        case 'decision':
            return <RandomDecisionMaker 
                options={props.decisionOptions}
                setOptions={props.setDecisionOptions}
                result={props.decisionResult}
                setResult={props.setDecisionResult}
                isSpinning={props.isDecisionSpinning}
                setIsSpinning={props.setIsDecisionSpinning}
                currentSpin={props.currentDecisionSpin}
                setCurrentSpin={props.setCurrentDecisionSpin}
            />;
        case 'notes':
            return (
                <div className={`${cardClasses} p-6`}>
                    <h2 className="text-xl font-bold mb-4">Quick Notes</h2>
                    <div className="mb-4">
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    addNoteUI();
                                }
                            }}
                            placeholder="Jot down a quick thought... (Shift+Enter for new line)"
                            className="w-full bg-input border-border rounded-md px-3 py-2 focus:ring-ring focus:border-primary min-h-[80px] resize-y"
                        />
                        <button onClick={addNoteUI} className="mt-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 w-full sm:w-auto">
                            Add Note
                        </button>
                    </div>
                    <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                        {quickNotes.slice().reverse().map(note => (
                            <div key={note.id} className="group flex justify-between items-start bg-secondary p-3 rounded-md">
                                <p className="text-foreground/90 whitespace-pre-wrap flex-1 mr-4">{note.text}</p>
                                <div className="flex flex-col items-end flex-shrink-0">
                                    <span className="text-xs text-muted-foreground mb-2">{formatDate(note.createdAt)}</span>
                                    <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                         {quickNotes.length === 0 && <p className="text-muted-foreground text-center py-8">No quick notes yet.</p>}
                    </div>
                </div>
            );
        case 'habits':
            return <HabitTracker
                habits={habits}
                setHabits={setHabits}
                cardClasses={cardClasses}
            />;
        case 'calendar':
             return <CalendarView events={events} onAddEvent={onAddEvent} cardClasses={cardClasses} />;
        case 'analytics':
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.completed).length;
            const tasksLast7Days = Array(7).fill(0).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                return tasks.filter(t => t.completed && t.createdAt.startsWith(dateStr)).length;
            }).reverse();
            const maxTasks = Math.max(...tasksLast7Days, 1);
            
            return (
                 <div className="space-y-6">
                    <h1 className="text-2xl font-bold">Your Analytics</h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className={`${cardClasses} p-6 flex items-center gap-4`}><Notebook size={24} className="text-primary"/><div><p className="text-2xl font-bold">{pages.length}</p><p className="text-sm text-muted-foreground">Notes Created</p></div></div>
                        <div className={`${cardClasses} p-6 flex items-center gap-4`}><CheckSquare size={24} className="text-green-500"/><div><p className="text-2xl font-bold">{completedTasks}/{totalTasks}</p><p className="text-sm text-muted-foreground">Tasks Completed</p></div></div>
                        <div className={`${cardClasses} p-6 flex items-center gap-4`}><Target size={24} className="text-yellow-500"/><div><p className="text-2xl font-bold">{habits.length}</p><p className="text-sm text-muted-foreground">Habits Tracked</p></div></div>
                        <div className={`${cardClasses} p-6 flex items-center gap-4`}><Timer size={24} className="text-red-500"/><div><p className="text-2xl font-bold">{pomodoroSessions}</p><p className="text-sm text-muted-foreground">Pomodoros</p></div></div>
                    </div>
                     <div className={`${cardClasses} p-6`}>
                        <h3 className="font-semibold mb-4">Tasks Completed (Last 7 Days)</h3>
                        <div className="flex justify-around items-end h-48 gap-2">
                          {tasksLast7Days.map((count, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - (6 - i));
                            return <div key={i} className="flex flex-col items-center gap-2 flex-1"><div className="w-full bg-secondary rounded-t-md hover:bg-primary/80 transition-all" style={{height: `${(count/maxTasks)*100}%`}} title={`${count} tasks`}></div><p className="text-xs text-muted-foreground">{d.toLocaleDateString(undefined, {weekday: 'short'})}</p></div>
                          })}
                        </div>
                     </div>
                     <div className={`${cardClasses} p-6`}>
                        <h3 className="font-semibold mb-4">Habit Consistency</h3>
                        <div className="space-y-4">
                        {habits.map(habit => (
                            <div key={habit.id}>
                                <p className="font-medium mb-2">{habit.name}</p>
                                <div className="flex flex-wrap gap-1">
                                {Array.from({length: 90}).map((_, i) => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - i);
                                    const dateStr = d.toDateString();
                                    const completed = habit.history.some(h => h.date === dateStr);
                                    return <div key={i} className={`w-3 h-3 rounded-sm ${completed ? 'bg-green-500' : 'bg-muted'}`} title={dateStr}></div>
                                }).reverse()}
                                </div>
                            </div>
                        ))}
                        {habits.length === 0 && <p className="text-muted-foreground text-center py-4">No habits being tracked.</p>}
                        </div>
                     </div>
                </div>
            )
        case 'personal':
            return <PersonalSuite 
                moodEntries={moodEntries}
                setMoodEntries={setMoodEntries}
                personalQuotes={personalQuotes}
                setPersonalQuotes={setPersonalQuotes}
                goals={goals}
                setGoals={setGoals}
                expenses={expenses}
                setExpenses={setExpenses}
                cardClasses={cardClasses}
            />;
        case 'settings':
            const themes = [
                { id: 'dark', name: 'Dark' },
                { id: 'jetblack', name: 'Jetblack' },
                { id: 'midnight', name: 'Midnight' },
                { id: 'light', name: 'Light' },
                { id: 'midlight', name: 'Midlight' },
            ];

            return (
                <div className="space-y-8">
                     <div className={`${cardClasses} p-6`}>
                        <h2 className="text-xl font-bold mb-4">Theme</h2>
                        <p className="text-muted-foreground mb-4">Select your preferred color theme for the application.</p>
                        <div className="flex flex-wrap gap-2">
                            {themes.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        theme === t.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary hover:bg-secondary/80'
                                    }`}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={`${cardClasses} p-6`}>
                        <h2 className="text-xl font-bold mb-4">Gemini API Key</h2>
                        <p className="text-muted-foreground mb-4">
                            Your API key is stored securely in your browser's local storage and is never shared. 
                            You can get your own free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Google AI Studio</a>.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-grow">
                                <input 
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder="Enter your Google Gemini API Key"
                                    className="w-full bg-input border-border rounded-md px-3 py-2 pr-10 focus:ring-ring focus:border-primary"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)} 
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                                    aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                                >
                                    {showApiKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                            <button 
                                onClick={handleSaveApiKey} 
                                className={`bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex-shrink-0 transition-all w-24 flex items-center justify-center ${apiKeySaveState === 'saved' ? '!bg-green-600' : ''}`}
                                disabled={apiKeySaveState !== 'idle'}
                            >
                                {apiKeySaveState === 'idle' && 'Save'}
                                {apiKeySaveState === 'saving' && <Loader className="w-4 h-4 animate-spin"/>}
                                {apiKeySaveState === 'saved' && <Check size={16}/>}
                            </button>
                        </div>
                    </div>
                    <div className={`${cardClasses} p-6`}>
                        <h2 className="text-xl font-bold mb-4">Export Data</h2>
                        <p className="text-muted-foreground mb-4">Download all your MamDesk & Notes data as a single JSON file for backup.</p>
                        <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:scale-95 transition-transform">
                            <Download size={16} />
                            Export My Data
                        </button>
                    </div>
                    <div className={`${cardClasses} p-6`}>
                        <h2 className="text-xl font-bold mb-4">Import Data</h2>
                        <p className="text-muted-foreground mb-4">Import data from a backup file. This will overwrite existing data and reload the application.</p>
                        <input type="file" accept=".json" onChange={importData} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/40"/>
                    </div>
                </div>
            );
        case 'help':
            return <HelpPage />;
        default:
            return <div className={`${cardClasses} p-10 text-center`}><h2 className="text-xl font-bold mb-4">Under Construction</h2><p>This feature is coming soon!</p></div>;
    }
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto bg-background text-foreground">
        {renderContent()}
    </main>
  );
};

export default MamDesk;