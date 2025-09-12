

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
// FIX: Changed to a named import for Editor to resolve a circular dependency.
import { Editor } from './components/Editor';
// FIX: Changed to named import for MamDesk to resolve circular dependency.
import { MamDesk } from './components/MamDesk';
import { WelcomePlaceholder } from './components/WelcomePlaceholder';
import { Chatbot } from './components/Chatbot';
import JournalView from './components/JournalView';
import InteractiveMindMap from './components/InteractiveMindMap';
import GoogleWorkspace from './components/GoogleWorkspace';
import { geminiAI, updateApiKey } from './components/gemini';
import AcademicView from './components/AcademicView';
import { ToastProvider, useToast } from './components/Toast';
import SearchPalette from './components/SearchPalette';
import LandingPage from './components/LandingPage';
import AboutPage from './components/AboutPage';
import { HelpPage } from './components/HelpPage';
import { MapPin, Loader, BrainCircuit as BrainCircuitIcon, Save, Download, Upload, AlertTriangle, Eye, EyeOff, Users as UsersIcon } from 'lucide-react';
import { updateSupabaseCredentials, getSupabaseCredentials, connectionStatus as supabaseConnectionStatus } from './components/supabase-config';
import {
  View, Page, JournalEntry, DriveFile, WorkspaceHistoryEntry, Task, KanbanState, QuickNote, CalendarEvent, Habit, Quote,
  MoodEntry, Expense, Goal, KanbanItem, Class, Student, Attendance
} from './types';


// --- IndexedDB Utility for Banners ---
const DB_NAME = 'MavenDB';
const DB_VERSION = 1; // Downgraded: Portal no longer uses IndexedDB
const STORE_NAME = 'files';

let db: IDBDatabase;


const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(true);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };
  });
};

export const setBannerData = (key: string, value: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('DB not initialized');
      return;
    }
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      console.error('Transaction error:', transaction.error);
      reject(transaction.error);
    };
  });
};

export const getBannerData = (key: string): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        reject('DB not initialized');
        return;
    }
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => {
      console.error('Transaction error:', request.error);
      reject(request.error);
    };
  });
};

export const deleteBannerData = (key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('DB not initialized');
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            reject(transaction.error);
        };
    });
};

// Custom hook for persisting state to localStorage, moved here for centralization
const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item, (k, v) => {
        // A reviver function to restore dates
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) {
          return new Date(v);
        }
        return v;
      }) : defaultValue;
    } catch (error) {
      console.error(error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  }, [key, value]);

  return [value, setValue];
};

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [pages, setPages] = usePersistentState<Page[]>('maven-pages', []);
  const [journalEntries, setJournalEntries] = usePersistentState<JournalEntry[]>('maven-journal', []);
  const [activePageId, setActivePageId] = useState<string | null>(localStorage.getItem('maven-last-page-id'));
  const [view, setView] = usePersistentState<View>('maven-view', 'notes');
  const [activeDashboardTab, setActiveDashboardTab] = usePersistentState<string>('maven-dashboard-tab', 'dashboard');
  
  // Dashboard states
  const [tasks, setTasks] = usePersistentState<Task[]>('maven-tasks', []);
  const [kanbanColumns, setKanbanColumns] = usePersistentState<KanbanState>('maven-kanban', {
    todo: { name: 'To Do', items: [] },
    progress: { name: 'In Progress', items: [] },
    done: { name: 'Done', items: [] },
  });
  const [quickNotes, setQuickNotes] = usePersistentState<QuickNote[]>('maven-quicknotes', []);
  const [events, setEvents] = usePersistentState<CalendarEvent[]>('maven-events', []);
  const [habits, setHabits] = usePersistentState<Habit[]>('maven-habits', []);
  const [personalQuotes, setPersonalQuotes] = usePersistentState<Quote[]>('maven-quotes', []);
  const [moodEntries, setMoodEntries] = usePersistentState<MoodEntry[]>('maven-moods', []);
  const [expenses, setExpenses] = usePersistentState<Expense[]>('maven-expenses', []);
  const [goals, setGoals] = usePersistentState<Goal[]>('maven-goals', []);
  
  // Pomodoro Timer
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroSessions, setPomodoroSessions] = usePersistentState<number>('maven-pomodoro-sessions', 0);
  const timerRef = useRef<number | null>(null);
  
  // Decision Maker
  const [decisionOptions, setDecisionOptions] = usePersistentState<string[]>('maven-decision-options', []);
  const [decisionResult, setDecisionResult] = useState('');
  const [isDecisionSpinning, setIsDecisionSpinning] = useState(false);
  const [currentDecisionSpin, setCurrentDecisionSpin] = useState('');
  
  // Theme
  const [theme, setTheme] = usePersistentState<string>('maven-theme', 'theme-dark');

  // Sidebar & Chatbot Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentState<boolean>('maven-sidebar-collapsed', false);
  const [isChatbotCollapsed, setIsChatbotCollapsed] = usePersistentState<boolean>('maven-chatbot-collapsed', false);
  
  // Google Workspace State
  const [googleAuthToken, setGoogleAuthToken] = usePersistentState<any | null>('maven-google-token', null);
  const [workspaceHistory, setWorkspaceHistory] = usePersistentState<WorkspaceHistoryEntry[]>('maven-workspace-history', []);
  
  // Search Palette State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Attendance Manager State
  const [classes, setClasses] = usePersistentState<Class[]>('maven-classes', []);
  const [students, setStudents] = usePersistentState<Student[]>('maven-students', []);
  const [attendance, setAttendance] = usePersistentState<Attendance>('maven-attendance', {});
  
  // App Load State
  const [hasEntered, setHasEntered] = useState(sessionStorage.getItem('maven-has-entered') === 'true');
  const toast = useToast();
  
  const [isDataWipeModalOpen, setIsDataWipeModalOpen] = useState(false);
  const [dataWipeConfirmation, setDataWipeConfirmation] = useState('');
  
  // Settings page state
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini-api-key') || 'AIzaSyCPdOt5TakRkdDSv1V3IIBeB9HyId60ZIo');
  const [supabaseUrl, setSupabaseUrl] = useState(getSupabaseCredentials().url);
  const [supabaseKey, setSupabaseKey] = useState(getSupabaseCredentials().key);
  const [supabaseStatus, setSupabaseStatus] = useState(supabaseConnectionStatus);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);

  // --- LIFECYCLE & INITIALIZATION ---

  useEffect(() => {
    initDB().then(success => {
      if (!success) {
        toast.error("Failed to initialize local database. Banners may not work correctly.");
      }
    });
  }, [toast]);
  
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);
  
  // Pomodoro Timer Effect
  useEffect(() => {
    if (pomodoroActive) {
      timerRef.current = window.setInterval(() => {
        setPomodoroTime(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setPomodoroActive(false);
            setPomodoroSessions(s => s + 1);
            new Notification("Pomodoro session complete!");
            return 25 * 60;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pomodoroActive, setPomodoroSessions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
            e.preventDefault();
            setIsSearchOpen(isOpen => !isOpen);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const handleEnterApp = () => {
    setHasEntered(true);
    sessionStorage.setItem('maven-has-entered', 'true');
  };

  const handleGoToLandingPage = () => {
    setHasEntered(false);
    sessionStorage.removeItem('maven-has-entered');
  };

  // --- PAGE & CONTENT MANAGEMENT ---
  const activePage = pages.find(p => p.id === activePageId);

  const handleNewPage = (title: string = 'Untitled Page', content: string = ''): Page => {
    const newPage: Page = {
      id: crypto.randomUUID(),
      title,
      content,
      createdAt: new Date(),
    };
    setPages(prev => [newPage, ...prev]);
    setActivePageId(newPage.id);
    setView('notes');
    return newPage;
  };

  const onUpdatePage = (id: string, updates: Partial<Omit<Page, 'id'>>) => {
    setPages(pages.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const onDeletePage = async (id: string) => {
    const pageToDelete = pages.find(p => p.id === id);
    if (!pageToDelete) return;
    
    // Delete associated banner from IndexedDB if it exists
    if (pageToDelete.bannerUrl && !pageToDelete.bannerUrl.startsWith('data:')) {
        try {
            await deleteBannerData(pageToDelete.bannerUrl);
        } catch (error) {
            console.error("Failed to delete banner from DB:", error);
        }
    }

    const remainingPages = pages.filter(p => p.id !== id);
    setPages(remainingPages);
    if (activePageId === id) {
      setActivePageId(remainingPages.length > 0 ? remainingPages[0].id : null);
    }
  };

  const onSelectPage = (id: string) => {
    setActivePageId(id);
    localStorage.setItem('maven-last-page-id', id);
    setView('notes');
  };

  // --- JOURNAL MANAGEMENT ---
  const onUpdateJournal = (date: string, content: string) => {
    const existingEntry = journalEntries.find(e => e.date === date);
    if (existingEntry) {
      if (content.trim() === '') {
        // If content is empty, delete the entry
        onDeleteJournal(date);
      } else {
        setJournalEntries(prev => prev.map(e => e.date === date ? { ...e, content } : e));
      }
    } else if (content.trim() !== '') {
      // Create new entry only if content is not empty
      const newEntry: JournalEntry = { id: crypto.randomUUID(), date, content, createdAt: new Date() };
      setJournalEntries(prev => [...prev, newEntry]);
    }
  };

  const onDeleteJournal = (date: string) => {
    setJournalEntries(prev => prev.filter(e => e.date !== date));
  };
  
  // --- GOOGLE WORKSPACE ---
  const handleFileImport = (data: { file: DriveFile; htmlContent: string }) => {
    const newNote = handleNewPage(data.file.name, data.htmlContent);
    const historyEntry: WorkspaceHistoryEntry = {
        fileId: data.file.id,
        fileName: data.file.name,
        fileType: data.file.mimeType.includes('spreadsheet') ? 'sheet' : 'doc',
        noteTitle: newNote.title,
        importedAt: new Date().toISOString()
    };
    setWorkspaceHistory(prev => [historyEntry, ...prev]);
    toast.success(`Imported "${data.file.name}" into a new note.`);
  };


  // --- CHATBOT FUNCTION HANDLERS ---
  const onAddTask = (text: string): string => {
    const newTask: Task = { id: crypto.randomUUID(), text, completed: false, createdAt: new Date().toISOString() };
    setTasks(prev => [newTask, ...prev]);
    return `✅ Task added: "${text}"`;
  };

  const onAddEvent = (title: string, date: string, time: string): string => {
    const newEvent: CalendarEvent = { id: crypto.randomUUID(), title, date, time };
    setEvents(prev => [...prev, newEvent]);
    return `🗓️ Event scheduled: "${title}" on ${date} at ${time}.`;
  };
  
   const onCompleteTaskByText = (text: string): string => {
    let found = false;
    let taskText = '';
    setTasks(prev => prev.map(t => {
        if (!t.completed && t.text.toLowerCase().includes(text.toLowerCase())) {
            found = true;
            taskText = t.text;
            return { ...t, completed: true };
        }
        return t;
    }));
    return found ? `✅ Marked task "${taskText}" as complete.` : `🤔 Task containing "${text}" not found or already complete.`;
  };

  const onDeleteTaskByText = (text: string): string => {
    let found = false;
    let originalLength = tasks.length;
    setTasks(prev => prev.filter(t => {
        const match = t.text.toLowerCase().includes(text.toLowerCase());
        if(match) found = true;
        return !match;
    }));
    return found ? `🗑️ Task containing "${text}" deleted.` : `🤔 Task containing "${text}" not found.`;
  };
  
  const onListTasks = (): string => {
    const completed = tasks.filter(t => t.completed);
    const pending = tasks.filter(t => !t.completed);
    if (tasks.length === 0) return "You have no tasks.";
    let response = "";
    if (pending.length > 0) {
        response += "Pending Tasks:\n" + pending.map(t => `- ${t.text}`).join('\n');
    }
    if (completed.length > 0) {
        response += "\n\nCompleted Tasks:\n" + completed.map(t => `- ${t.text}`).join('\n');
    }
    return response.trim();
  };
  
  const onDeleteNoteByTitle = async (title: string): Promise<string> => {
    const noteToDelete = pages.find(p => p.title.toLowerCase() === title.toLowerCase());
    if (noteToDelete) {
      await onDeletePage(noteToDelete.id);
      return `✅ Note titled "${noteToDelete.title}" has been deleted.`;
    }
    return `❌ Note titled "${title}" was not found.`;
  };

  const onGetDailyBriefing = (): string => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = events.filter(e => e.date === today);
    const pendingTasks = tasks.filter(t => !t.completed);
    
    let briefing = "Here's your daily briefing:\n";
    
    if (todayEvents.length > 0) {
      briefing += "\nToday's Events:\n" + todayEvents.map(e => `- ${e.time}: ${e.title}`).join('\n');
    } else {
      briefing += "\nNo events scheduled for today.";
    }
    
    if (pendingTasks.length > 0) {
      briefing += "\n\nPending Tasks:\n" + pendingTasks.map(t => `- ${t.text}`).join('\n');
    } else {
      briefing += "\n\nYou have no pending tasks. Great job!";
    }
    
    return briefing;
  };
  
  const onGenerateCreativeContent = (content: string): string => {
      if (!activePage) {
          handleNewPage("Creative Content", content);
          return "I've created a new page for your content as you didn't have one open.";
      }
      onUpdatePage(activePage.id, { content: activePage.content + `<p>${content}</p>` });
      return "I've added the generated content to your current note.";
  };
  
   const onMoveKanbanCard = (cardText: string, targetColumn: 'To Do' | 'In Progress' | 'Done'): string => {
    const columnMap = { 'To Do': 'todo', 'In Progress': 'progress', 'Done': 'done' };
    const targetColId = columnMap[targetColumn];
    if (!targetColId) return `Invalid column: "${targetColumn}".`;

    let card: KanbanItem | undefined;
    let sourceColId: string | undefined;
    
    for (const [colId, col] of Object.entries(kanbanColumns)) {
        card = col.items.find(item => item.text.toLowerCase().includes(cardText.toLowerCase()));
        if (card) {
            sourceColId = colId;
            break;
        }
    }

    if (!card || !sourceColId) return `Card "${cardText}" not found.`;
    if (sourceColId === targetColId) return `Card "${card.text}" is already in "${targetColumn}".`;

    // Remove from source
    const newSourceItems = kanbanColumns[sourceColId as keyof KanbanState].items.filter(i => i.id !== card!.id);
    // Add to target
    const newTargetItems = [...kanbanColumns[targetColId as keyof KanbanState].items, card];

    setKanbanColumns(prev => ({
      ...prev,
      [sourceColId as keyof KanbanState]: { ...prev[sourceColId as keyof KanbanState], items: newSourceItems },
      [targetColId as keyof KanbanState]: { ...prev[targetColId as keyof KanbanState], items: newTargetItems },
    }));

    return `✅ Moved card "${card.text}" to "${targetColumn}".`;
  };

  const onAddQuickNote = (text: string): string => {
    setQuickNotes(prev => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...prev]);
    return "✅ Quick note added.";
  };

  const onListQuickNotes = (): string => {
    if (quickNotes.length === 0) return "You have no quick notes.";
    return "Here are your quick notes:\n" + quickNotes.map(n => `- ${n.text}`).join('\n');
  };
  
  const onAddHabit = (name: string): string => {
    if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
        return `You are already tracking the habit "${name}".`;
    }
    const newHabit: Habit = { id: crypto.randomUUID(), name, streak: 0, lastCompleted: null, history: [] };
    setHabits(prev => [...prev, newHabit]);
    return `💪 New habit added: "${name}". Let's get started!`;
  };

  const onCompleteHabit = (name: string): string => {
    const todayStr = new Date().toDateString();
    let habitFound = false;
    let alreadyCompleted = false;
    setHabits(prev => prev.map(h => {
      if (h.name.toLowerCase() === name.toLowerCase()) {
        habitFound = true;
        if (h.lastCompleted === todayStr) {
            alreadyCompleted = true;
            return h;
        }
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isConsecutive = h.lastCompleted === yesterday.toDateString();
        return { ...h, streak: isConsecutive ? h.streak + 1 : 1, lastCompleted: todayStr };
      }
      return h;
    }));
    if (!habitFound) return `Habit "${name}" not found.`;
    if (alreadyCompleted) return `You've already completed "${name}" today. Great job!`;
    return `✅ Habit "${name}" marked as complete for today! Keep it up!`;
  };
  
  const onDeleteHabit = (name: string): string => {
    let found = false;
    setHabits(prev => prev.filter(h => {
        const match = h.name.toLowerCase() === name.toLowerCase();
        if (match) found = true;
        return !match;
    }));
    return found ? `🗑️ Habit "${name}" has been deleted.` : `🤔 Habit "${name}" not found.`;
  };
  
  const onListHabits = (): string => {
    if (habits.length === 0) return "You are not tracking any habits yet.";
    return "Your current habits:\n" + habits.map(h => `- ${h.name} (Streak: ${h.streak} days)`).join('\n');
  };

  // Fix: The onMakeDecision function was not returning a value in all code paths, causing a compilation error.
  // It is now wrapped in a Promise that resolves with the decision string.
  const onMakeDecision = (options?: string[]): Promise<string> => {
    return new Promise(resolve => {
        const opts = options && options.length > 0 ? options : decisionOptions;
        if (opts.length === 0) {
            resolve("There are no options to choose from.");
            return;
        }
        if (opts.length === 1) {
            resolve(`The only option is ${opts[0]}.`);
            return;
        }

        // Visual spinning effect
        setIsDecisionSpinning(true);
        setDecisionResult('');
        let spins = 0;
        const maxSpins = 20 + Math.floor(Math.random() * 10);
        const spinInterval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * opts.length);
            setCurrentDecisionSpin(opts[randomIndex]);
            spins++;
            if (spins >= maxSpins) {
                clearInterval(spinInterval);
                const finalChoice = opts[Math.floor(Math.random() * opts.length)];
                setDecisionResult(finalChoice);
                setIsDecisionSpinning(false);
                setCurrentDecisionSpin('');
                resolve(`The decision is: ${finalChoice}`);
            }
        }, 100);
    });
  };

  const onPlanAndCreateNote = async (topic: string): Promise<string> => {
    if (!geminiAI) return "AI features are disabled.";
    try {
      const prompt = `Create a structured plan for the following topic: "${topic}". The plan should be a well-organized list of steps, phases, or key areas. Format it clearly so it can be used as a project outline or study guide.`;
      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      const plan = response.text.replace(/\n/g, '<br/>');
      handleNewPage(`Plan for: ${topic}`, plan);
      return `✅ Successfully created a new note with a plan for "${topic}".`;
    } catch (err) {
      console.error(err);
      return "❌ Failed to generate a plan.";
    }
  };

  const onWireframeAndCreateNote = async (description: string): Promise<string> => {
    if (!geminiAI) return "AI features are disabled.";
    try {
      const prompt = `Create a textual wireframe for a user interface based on this description: "${description}". Use simple text and indentation to represent the layout of components like headers, buttons, input fields, and content areas. For example:
[Header: App Name]
  [Navigation: Home | Profile | Settings]
[Main Content Area]
  [Image: Product Photo]
  [Text: Product Title]
  [Button: Add to Cart]`;
      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      const wireframe = `<pre><code>${response.text}</code></pre>`;
      handleNewPage(`Wireframe: ${description}`, wireframe);
      return `✅ Successfully created a new note with a wireframe for "${description}".`;
    } catch (err) {
      console.error(err);
      return "❌ Failed to generate a wireframe.";
    }
  };
  
  const onAddJournalEntry = (content: string, date?: string): string => {
    const entryDate = date || new Date().toISOString().split('T')[0];
    onUpdateJournal(entryDate, content);
    return `✅ Journal entry for ${entryDate} has been saved.`;
  };
  
  const onAddGoal = (text: string): string => {
    setGoals(prev => [...prev, {id: crypto.randomUUID(), text, completed: false}]);
    return `🎯 New goal set: "${text}"`;
  };
  
  const onLogMood = (mood: string): string => {
    const today = new Date().toISOString().split('T')[0];
    const newEntry = { id: crypto.randomUUID(), mood, date: today };
    setMoodEntries(prev => [...prev.filter(e => e.date !== today), newEntry]);
    return `😊 Mood logged for today: ${mood}`;
  };
  
  const onAddExpense = (description: string, amount: number, category: string): string => {
    const newExpense = { id: crypto.randomUUID(), description, amount, category: category || 'General', date: new Date().toISOString() };
    setExpenses(prev => [...prev, newExpense]);
    return `💸 Expense logged: $${amount.toFixed(2)} for ${description}.`;
  };
  
  const onAddPersonalQuote = (text: string): string => {
    setPersonalQuotes(prev => [...prev, {id: crypto.randomUUID(), text}]);
    return `❝ Quote added to your collection.`;
  };

  // Pomodoro Handlers
  const onTogglePomodoro = () => setPomodoroActive(prev => !prev);
  const onResetPomodoro = () => {
    setPomodoroActive(false);
    setPomodoroTime(25 * 60);
  };
  
  // Decision Maker Handlers
  const onAddDecisionOption = (option: string) => {
    if (option.trim() && !decisionOptions.includes(option.trim())) {
      setDecisionOptions(prev => [...prev, option.trim()]);
      return `Added option: "${option}".`;
    }
    return `Could not add option: "${option}". It might be empty or a duplicate.`;
  };
   const onAddDecisionOptions = (options: string[]) => {
    const uniqueNewOptions = options.filter(opt => opt.trim() && !decisionOptions.includes(opt.trim()));
    if(uniqueNewOptions.length > 0) {
      setDecisionOptions(prev => [...prev, ...uniqueNewOptions]);
      return `Added ${uniqueNewOptions.length} new options.`;
    }
    return "No new unique options were added.";
  };
  const onClearDecisionOptions = () => {
    setDecisionOptions([]);
    return "All decision options have been cleared.";
  };
  
  // Attendance Manager Handlers
  const onAddClass = (name: string) => {
    if (name.trim()) {
        const newClass: Class = { id: crypto.randomUUID(), name: name.trim() };
        setClasses(prev => [...prev, newClass]);
    }
  };

  const onDeleteClass = (id: string) => {
    // Also delete students and attendance records associated with this class
    const studentIdsToDelete = students.filter(s => s.classId === id).map(s => s.id);
    setStudents(prev => prev.filter(s => s.classId !== id));
    setAttendance(prev => {
        const newAttendance: Attendance = {};
        for (const date in prev) {
            newAttendance[date] = {};
            for (const studentId in prev[date]) {
                if (!studentIdsToDelete.includes(studentId)) {
                    newAttendance[date][studentId] = prev[date][studentId];
                }
            }
            if (Object.keys(newAttendance[date]).length === 0) {
                delete newAttendance[date];
            }
        }
        return newAttendance;
    });
    setClasses(prev => prev.filter(c => c.id !== id));
  };
  
  const onAddStudent = (name: string, enrollment: string, classId: string) => {
    if (name.trim() && enrollment.trim() && classId) {
        const newStudent: Student = { id: crypto.randomUUID(), name: name.trim(), enrollment: enrollment.trim(), classId };
        setStudents(prev => [...prev, newStudent]);
    }
  };
  
  const onAddStudentsBatch = (newStudents: { name: string; enrollment: string; classId: string }[]): string => {
    const existingEnrollments = new Set(students.map(s => s.enrollment.toLowerCase()));
    let addedCount = 0;
    let skippedCount = 0;

    const studentsToAdd: Student[] = [];

    newStudents.forEach(s => {
        if (!existingEnrollments.has(s.enrollment.toLowerCase())) {
            studentsToAdd.push({ ...s, id: crypto.randomUUID() });
            addedCount++;
        } else {
            skippedCount++;
        }
    });
    
    if (studentsToAdd.length > 0) {
        setStudents(prev => [...prev, ...studentsToAdd]);
    }

    let message = `Import complete. Added ${addedCount} new students.`;
    if (skippedCount > 0) {
        message += ` Skipped ${skippedCount} duplicates.`;
    }
    return message;
  };

  const onDeleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    // Also remove from attendance
    setAttendance(prev => {
        const newAttendance: Attendance = {};
        for (const date in prev) {
            if (prev[date][id]) {
                const { [id]: _, ...rest } = prev[date];
                if (Object.keys(rest).length > 0) {
                    newAttendance[date] = rest;
                }
            } else {
                newAttendance[date] = prev[date];
            }
        }
        return newAttendance;
    });
  };
  
  const onSetAttendance = (date: string, studentId: string, status: 'Present' | 'Absent') => {
    setAttendance(prev => {
        const newAttendance = { ...prev };
        if (!newAttendance[date]) {
            newAttendance[date] = {};
        }
        // If the student is already marked with the same status, unmark them.
        if (newAttendance[date][studentId] === status) {
            delete newAttendance[date][studentId];
             if (Object.keys(newAttendance[date]).length === 0) {
                delete newAttendance[date];
            }
        } else {
            newAttendance[date][studentId] = status;
        }
        return newAttendance;
    });
  };
  
  // --- SETTINGS PAGE HANDLERS ---
  const handleSaveSettings = () => {
    updateApiKey(apiKey);
    const result = updateSupabaseCredentials(supabaseUrl, supabaseKey);
    setSupabaseStatus({ configured: result.success, message: result.message });
    toast.success("Settings saved!");
    if(result.success) {
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const handleExportData = () => {
    const data = {
        pages,
        journalEntries,
        tasks,
        kanbanColumns,
        quickNotes,
        events,
        habits,
        personalQuotes,
        moodEntries,
        expenses,
        goals,
        pomodoroSessions,
        decisionOptions,
        theme,
        isSidebarCollapsed,
        isChatbotCollapsed,
        googleAuthToken,
        workspaceHistory,
        classes,
        students,
        attendance
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `maven_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    toast.success("Data exported successfully!");
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') throw new Error("File could not be read");
            const data = JSON.parse(text);

            // Basic validation
            if (!data.pages || !data.tasks) throw new Error("Invalid backup file format");
            
            // This is a destructive action, so a confirmation is good practice
            if(window.confirm("Are you sure you want to overwrite all current data with this backup? This action cannot be undone.")){
                setPages(data.pages || []);
                setJournalEntries(data.journalEntries || []);
                setTasks(data.tasks || []);
                setKanbanColumns(data.kanbanColumns || { todo: { name: 'To Do', items: [] }, progress: { name: 'In Progress', items: [] }, done: { name: 'Done', items: [] } });
                setQuickNotes(data.quickNotes || []);
                setEvents(data.events || []);
                setHabits(data.habits || []);
                setPersonalQuotes(data.personalQuotes || []);
                setMoodEntries(data.moodEntries || []);
                setExpenses(data.expenses || []);
                setGoals(data.goals || []);
                setPomodoroSessions(data.pomodoroSessions || 0);
                setDecisionOptions(data.decisionOptions || []);
                setTheme(data.theme || 'theme-dark');
                setIsSidebarCollapsed(data.isSidebarCollapsed || false);
                setIsChatbotCollapsed(data.isChatbotCollapsed || false);
                setGoogleAuthToken(data.googleAuthToken || null);
                setWorkspaceHistory(data.workspaceHistory || []);
                setClasses(data.classes || []);
                setStudents(data.students || []);
                setAttendance(data.attendance || {});
                
                toast.success("Data imported successfully! The app will now reload.");
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error: any) {
            console.error("Import error:", error);
            toast.error(`Import failed: ${error.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input to allow re-uploading the same file
  };
  
  const handleWipeData = () => {
    if (dataWipeConfirmation.toLowerCase() === 'delete my data') {
        localStorage.clear();
        indexedDB.deleteDatabase(DB_NAME); // Also wipe IndexedDB
        toast.success("All data has been wiped. The application will now reload.");
        setTimeout(() => window.location.reload(), 1500);
    } else {
        toast.error("Confirmation text does not match. Data was not deleted.");
    }
  };

  // --- RENDER LOGIC ---

  if (!hasEntered) {
    return <LandingPage onEnter={handleEnterApp} />;
  }
  
  const renderView = () => {
    switch(view) {
      case 'notes':
        return activePage ? (
          <Editor
            key={activePage.id}
            page={activePage}
            onUpdatePage={onUpdatePage}
            onDeletePage={onDeletePage}
            onNewPage={handleNewPage}
          />
        ) : <WelcomePlaceholder onNewPage={handleNewPage} />;
      case 'dashboard':
        return <MamDesk 
            activeTab={activeDashboardTab}
            tasks={tasks} onAddTask={(text) => { onAddTask(text); }} onToggleTask={(id) => setTasks(tasks.map(t => t.id === id ? {...t, completed: !t.completed} : t))} onDeleteTask={(id) => setTasks(tasks.filter(t => t.id !== id))}
            kanbanColumns={kanbanColumns} setKanbanColumns={setKanbanColumns} onAddKanbanCard={(colId, text) => {
                const newItem: KanbanItem = { id: crypto.randomUUID(), text };
                setKanbanColumns(prev => ({ ...prev, [colId]: { ...prev[colId as keyof KanbanState], items: [...prev[colId as keyof KanbanState].items, newItem] } }));
            }}
            quickNotes={quickNotes} setQuickNotes={setQuickNotes}
            events={events} onAddEvent={(title, date, time) => { onAddEvent(title, date, time); }}
            habits={habits} setHabits={setHabits}
            personalQuotes={personalQuotes} setPersonalQuotes={setPersonalQuotes}
            moodEntries={moodEntries} setMoodEntries={setMoodEntries}
            expenses={expenses} setExpenses={setExpenses}
            goals={goals} setGoals={setGoals}
            pomodoroTime={pomodoroTime} pomodoroActive={pomodoroActive} pomodoroSessions={pomodoroSessions} onTogglePomodoro={onTogglePomodoro} onResetPomodoro={onResetPomodoro}
            decisionOptions={decisionOptions} setDecisionOptions={setDecisionOptions} decisionResult={decisionResult} setDecisionResult={setDecisionResult} isDecisionSpinning={isDecisionSpinning} setIsDecisionSpinning={setIsDecisionSpinning} currentDecisionSpin={currentDecisionSpin} setCurrentDecisionSpin={setCurrentDecisionSpin}
            theme={theme} setTheme={setTheme}
            pages={pages}
            classes={classes} students={students} attendance={attendance}
            onAddClass={onAddClass} onDeleteClass={onDeleteClass} onAddStudent={onAddStudent} onDeleteStudent={onDeleteStudent} onSetAttendance={onSetAttendance} onAddStudentsBatch={onAddStudentsBatch}
            onNewNote={handleNewPage}
        />;
      case 'journal':
        return <JournalView entries={journalEntries} onUpdate={onUpdateJournal} onDelete={onDeleteJournal} />;
      case 'documind':
        return <InteractiveMindMap />;
      case 'workspace':
        return <GoogleWorkspace authToken={googleAuthToken} setAuthToken={setGoogleAuthToken} history={workspaceHistory} onFileImport={handleFileImport} />;
      case 'academics':
        return <AcademicView goals={goals} events={events} />;
      case 'about':
        return <AboutPage />;
      case 'help':
        return <div className="p-8 overflow-y-auto"><HelpPage /></div>;
      case 'settings':
         return (
            <main className="flex-1 p-8 overflow-y-auto">
                 {isDataWipeModalOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-destructive/50 rounded-xl shadow-2xl w-full max-w-lg p-6">
                            <div className="text-center">
                                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4"/>
                                <h2 className="text-xl font-bold text-foreground">Irreversible Action</h2>
                                <p className="text-muted-foreground mt-2">
                                    You are about to delete all of your data, including notes, tasks, and settings. This cannot be undone. To confirm, please type "<strong className="text-destructive">delete my data</strong>" below.
                                </p>
                            </div>
                            <input
                                type="text"
                                value={dataWipeConfirmation}
                                onChange={(e) => setDataWipeConfirmation(e.target.value)}
                                className="w-full bg-input border-border rounded-md px-3 py-2 mt-4 text-center"
                            />
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => setIsDataWipeModalOpen(false)} className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md">Cancel</button>
                                <button onClick={handleWipeData} className="flex-1 bg-destructive text-destructive-foreground py-2 rounded-md">Confirm Deletion</button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="max-w-4xl mx-auto space-y-8">
                    <section className="bg-card border border-border rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-1">API Configuration</h2>
                        <p className="text-muted-foreground mb-6">Maven uses external services for AI features and the Student/Teacher portal. Your keys are stored securely in your browser and are never sent to our servers.</p>

                        {/* Gemini AI Configuration */}
                        <div className="p-4 border border-border rounded-lg mb-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><BrainCircuitIcon size={20} /> Google AI (Gemini)</h3>
                            <p className="text-sm text-muted-foreground mt-1 mb-4">Required for all AI features, including the AI Assistant, AI Brain Dump, DocuMind explanations, and in-note commands.</p>
                            
                            <div>
                                <label className="block text-sm font-medium text-foreground/80 mb-1">Gemini API Key</label>
                                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter your Google Gemini API Key" className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                            </div>
                            
                            <details className="mt-3 text-sm">
                                <summary className="cursor-pointer text-primary hover:underline">How to get your API key</summary>
                                <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground text-xs">
                                    <li>Go to the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary/90 underline">Google AI Studio</a>.</li>
                                    <li>Log in with your Google account.</li>
                                    <li>Click on the "Get API key" button.</li>
                                    <li>Create a new API key in your project.</li>
                                    <li>Copy the generated key and paste it into the field above.</li>
                                </ol>
                            </details>
                        </div>

                        {/* Supabase Configuration */}
                        <div className="p-4 border border-border rounded-lg">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><UsersIcon size={20} /> Supabase (Student/Teacher Portal)</h3>
                            <p className="text-sm text-muted-foreground mt-1 mb-4">Required *only* for the real-time Student/Teacher Portal feature. If you don't need the portal, you can leave this blank.</p>
                            <div>
                                <label className="block text-sm font-medium text-foreground/80 mb-1">Supabase Project URL</label>
                                <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://xyz.supabase.co" className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-foreground/80 mb-1">Supabase API Key (anon public)</label>
                                <div className="relative">
                                    <input type={showSupabaseKey ? "text" : "password"} value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." className="w-full bg-input border-border rounded-md px-3 py-2 text-sm pr-10" />
                                    <button onClick={() => setShowSupabaseKey(!showSupabaseKey)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                                        {showSupabaseKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                                    </button>
                                </div>
                            </div>
                            <p className={`text-xs mt-2 ${supabaseStatus.configured ? 'text-green-400' : 'text-amber-400'}`}>{supabaseStatus.message}</p>
                            <details className="mt-3 text-sm">
                                <summary className="cursor-pointer text-primary hover:underline">How to get Supabase credentials</summary>
                                <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground text-xs">
                                    <li>Go to your project on <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-primary/90 underline">Supabase</a>.</li>
                                    <li>Navigate to Project Settings (the gear icon).</li>
                                    <li>Click on the "API" section in the sidebar.</li>
                                    <li>You will find your Project URL and the `anon` public key there.</li>
                                    <li>Copy and paste them into the fields above.</li>
                                </ol>
                            </details>
                        </div>
                        
                        <div className="mt-6 text-right">
                            <button onClick={handleSaveSettings} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold flex items-center gap-2 ml-auto">
                                <Save size={16}/> Save All Configurations
                           </button>
                        </div>
                    </section>
                     <section className="bg-card border border-border rounded-xl p-6">
                         <h2 className="text-xl font-bold mb-4">Data Management</h2>
                         <p className="text-sm text-muted-foreground mb-4">Your data is stored locally in your browser. You can back it up or import it from a file.</p>
                         <div className="flex flex-wrap gap-4">
                            <button onClick={handleExportData} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-semibold">
                                <Download size={16}/> Export Data
                            </button>
                            <label className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-semibold cursor-pointer">
                                <Upload size={16}/> Import Data
                                <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
                            </label>
                         </div>
                    </section>
                    <section className="bg-card border border-destructive/20 rounded-xl p-6">
                         <h2 className="text-xl font-bold text-destructive mb-2">Danger Zone</h2>
                         <p className="text-sm text-muted-foreground mb-4">This action is irreversible. It will permanently delete all your notes, tasks, and settings from this browser.</p>
                         <button onClick={() => setIsDataWipeModalOpen(true)} className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-semibold">
                            Wipe All Local Data
                        </button>
                    </section>
                </div>
            </main>
         );
      default:
        return <WelcomePlaceholder onNewPage={handleNewPage} />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
        <Sidebar
            pages={pages}
            activePageId={activePageId}
            onSelectPage={onSelectPage}
            onNewPage={handleNewPage}
            view={view}
            setView={setView}
            activeTab={activeDashboardTab}
            setActiveTab={setActiveDashboardTab}
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
            onToggleSearch={() => setIsSearchOpen(true)}
            onGoToLandingPage={handleGoToLandingPage}
        />
        <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex min-h-0 relative">
                {renderView()}
            </div>
        </div>
         <aside className={`flex-shrink-0 border-l border-border/50 transition-all duration-300 ease-in-out ${isChatbotCollapsed ? 'w-16' : 'w-96'}`}>
            <Chatbot 
                onAddTask={onAddTask} 
                onAddEvent={onAddEvent} 
                onNewPage={handleNewPage}
                onGetDailyBriefing={onGetDailyBriefing}
                onGenerateCreativeContent={onGenerateCreativeContent}
                onCompleteTaskByText={onCompleteTaskByText}
                onDeleteTaskByText={onDeleteTaskByText}
                onListTasks={onListTasks}
                onDeleteNoteByTitle={onDeleteNoteByTitle}
                onMoveKanbanCard={onMoveKanbanCard}
                onAddQuickNote={onAddQuickNote}
                onListQuickNotes={onListQuickNotes}
                onAddHabit={onAddHabit}
                onCompleteHabit={onCompleteHabit}
                onDeleteHabit={onDeleteHabit}
                onListHabits={onListHabits}
                onStartPomodoro={() => { setPomodoroActive(true); return "Pomodoro timer started."; }}
                onPausePomodoro={() => { setPomodoroActive(false); return "Pomodoro timer paused."; }}
                onResetPomodoro={() => { onResetPomodoro(); return "Pomodoro timer reset."; }}
                onAddDecisionOption={onAddDecisionOption}
                onAddDecisionOptions={onAddDecisionOptions}
                onClearDecisionOptions={onClearDecisionOptions}
                onMakeDecision={onMakeDecision}
                onPlanAndCreateNote={onPlanAndCreateNote}
                onWireframeAndCreateNote={onWireframeAndCreateNote}
                onAddJournalEntry={onAddJournalEntry}
                onAddGoal={onAddGoal}
                onLogMood={onLogMood}
                onAddExpense={onAddExpense}
                onAddPersonalQuote={onAddPersonalQuote}
                isCollapsed={isChatbotCollapsed}
                setIsCollapsed={setIsChatbotCollapsed}
            />
        </aside>
        <SearchPalette 
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            pages={pages}
            onSelectPage={onSelectPage}
        />
    </div>
  );
};

const AppWrapper: React.FC = () => (
  <ToastProvider>
    <App />
  </ToastProvider>
);

export default AppWrapper;