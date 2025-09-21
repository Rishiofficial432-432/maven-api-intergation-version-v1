import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import { Editor } from './components/Editor';
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
import InspirationPage from './components/InspirationPage';
import { Section } from './components/Section';
import { MapPin, Loader, BrainCircuit as BrainCircuitIcon, Save, Download, Upload, AlertTriangle, Eye, EyeOff, Users as UsersIcon, ImageIcon, Trash2 } from 'lucide-react';
import { getSupabaseCredentials, updateSupabaseCredentials, connectionStatus } from './components/supabase-config';
import usePersistentState from './components/usePersistentState';
import { Type } from '@google/genai';
import {
  View, Page, JournalEntry, DriveFile, WorkspaceHistoryEntry, Task, KanbanState, QuickNote, CalendarEvent, Habit, Quote,
  MoodEntry, Expense, Goal, KanbanItem, GeneratedCurriculum
} from './types';
import { initDB, getBannerData, setBannerData, deleteBannerData } from './components/db';


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
  
  // App Load State
  const [hasEntered, setHasEntered] = useState(sessionStorage.getItem('maven-has-entered') === 'true');
  const toast = useToast();
  
  const [isDataWipeModalOpen, setIsDataWipeModalOpen] = useState(false);
  const [dataWipeConfirmation, setDataWipeConfirmation] = useState('');
  
  // Settings page state
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini-api-key') || '');
  const [inspirationImageId, setInspirationImageId] = usePersistentState<string | null>('maven-inspiration-image-id', null);
  const [inspirationImagePreview, setInspirationImagePreview] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // New Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState({ message: connectionStatus.message, configured: connectionStatus.configured });
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);

  // State for persistent curriculum generation
  const [curriculumResult, setCurriculumResult] = usePersistentState<GeneratedCurriculum | null>('maven-curriculum-result', null);
  const [isCurriculumGenerating, setIsCurriculumGenerating] = useState(false);


  // --- LIFECYCLE & INITIALIZATION ---

  useEffect(() => {
    initDB().then(success => {
      if (!success) {
        toast.error("Failed to initialize local database. Banners may not work correctly.");
      }
    });

    const { url, key } = getSupabaseCredentials();
    setSupabaseUrl(url);
    setSupabaseKey(key);
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
  
  useEffect(() => {
    let objectUrl: string | null = null;
    const loadPreview = async () => {
        if (inspirationImageId) {
            try {
              const blob = await getBannerData(inspirationImageId);
              if (blob) {
                  objectUrl = URL.createObjectURL(blob);
                  setInspirationImagePreview(objectUrl);
              } else {
                setInspirationImagePreview(null);
              }
            } catch (e) {
                console.error("Failed to load inspiration preview", e);
                setInspirationImagePreview(null);
            }
        } else {
            setInspirationImagePreview(null);
        }
    };
    loadPreview();
    return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
}, [inspirationImageId]);

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
    
    if (pageToDelete.bannerUrl && !pageToDelete.bannerUrl.startsWith('data:')) {
        try {
            await deleteBannerData(pageToDelete.bannerUrl);
        } catch (error) {
            console.error("Failed to delete banner from DB:", error);
        }
    }

    const remainingPages = pages.filter(p => p.id !== id);
    // Sort remaining pages by creation date, newest first, for predictable navigation
    const sortedRemainingPages = remainingPages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPages(sortedRemainingPages);

    if (activePageId === id) {
      // Select the newest page if one exists, otherwise null
      const newActivePageId = sortedRemainingPages.length > 0 ? sortedRemainingPages[0].id : null;
      setActivePageId(newActivePageId);
      if (newActivePageId) {
          localStorage.setItem('maven-last-page-id', newActivePageId);
      } else {
          localStorage.removeItem('maven-last-page-id');
      }
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
        onDeleteJournal(date);
      } else {
        setJournalEntries(prev => prev.map(e => e.date === date ? { ...e, content } : e));
      }
    } else if (content.trim() !== '') {
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


  // --- CURRICULUM GENERATION ---
  const handleGenerateCurriculum = async (file: File, indexText: string) => {
    if (!geminiAI) {
      toast.error("AI features are disabled. Please configure your API key in settings.");
      return;
    }
    
    setIsCurriculumGenerating(true);
    setCurriculumResult(null); // Clear previous results while generating

    // Helper function to simulate file reading for the demo
    const simulateFileExtraction = async (file: File): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `The document, "${file.name}", is assumed to be a comprehensive course material (textbook, presentation, etc.). The content covers various topics as outlined in the provided index. It likely includes detailed explanations, examples, and exercises related to the subject matter.`;
    };

    try {
        const simulatedFileContent = await simulateFileExtraction(file);
        const prompt = `You are an expert curriculum designer for a university. Your task is to create a detailed, 12-week semester curriculum based on a course document.
        CONTEXT:
        - Document Name: ${file.name}
        - Document Summary: ${simulatedFileContent}
        - Document Index/Table of Contents:\n---\n${indexText}\n---
        INSTRUCTIONS:
        Based on all the provided context, generate a comprehensive 12-week curriculum. The curriculum should be logically sequenced, starting with foundational concepts and progressing to more advanced topics.
        Your response MUST be a single JSON object that adheres to the provided schema. Do not include any text outside of the JSON object.`;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                courseTitle: { type: Type.STRING },
                courseDescription: { type: Type.STRING },
                learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                weeklyBreakdown: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            week: { type: Type.NUMBER },
                            topic: { type: Type.STRING },
                            keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                            reading: { type: Type.STRING },
                            assignment: { type: Type.STRING },
                        }
                    }
                }
            }
        };

        const response = await geminiAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });

        const jsonStr = response.text.trim();
        const parsedResult: GeneratedCurriculum = JSON.parse(jsonStr);
        setCurriculumResult(parsedResult);
        toast.success("Curriculum generated successfully!");

    } catch (error: any) {
        console.error("Curriculum generation failed:", error);
        toast.error(`Failed to generate curriculum: ${error.message}`);
        setCurriculumResult(null);
    } finally {
        setIsCurriculumGenerating(false);
    }
  };

  const handleClearCurriculum = () => {
    setCurriculumResult(null);
  };

  // --- CHATBOT FUNCTION HANDLERS ---
  const onAddTask = (text: string): string => {
    const newTask: Task = { id: crypto.randomUUID(), text, completed: false, createdAt: new Date().toISOString() };
    setTasks(prev => [newTask, ...prev]);
    return `✅ Task added: "${text}"`;
  };

  const onAddEvent = (title: string, date: string, time: string): string => {
    const newEvent: CalendarEvent = { id: crypto.randomUUID(), title, date, time, type: 'event' };
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

    const newSourceItems = kanbanColumns[sourceColId as keyof KanbanState].items.filter(i => i.id !== card!.id);
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

  const onTogglePomodoro = () => setPomodoroActive(prev => !prev);
  const onResetPomodoro = () => {
    setPomodoroActive(false);
    setPomodoroTime(25 * 60);
  };
  
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
  
  // --- SETTINGS PAGE HANDLERS ---
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    updateApiKey(apiKey);
    toast.success("Settings saved successfully!");
    setIsSavingSettings(false);
  };

  const handleTestAndSaveSupabase = async () => {
    setIsTestingSupabase(true);
    const result = await updateSupabaseCredentials(supabaseUrl, supabaseKey);
    setSupabaseStatus({ message: result.message, configured: result.success });
    setIsTestingSupabase(false);
    if (result.success) {
        toast.success("Connection successful! The app will now reload to apply the new settings.");
        setTimeout(() => window.location.reload(), 2000);
    } else {
        toast.error(result.message);
    }
  };

  const handleExportData = () => {
    const data = {
        pages, journalEntries, tasks, kanbanColumns, quickNotes, events, habits,
        personalQuotes, moodEntries, expenses, goals, pomodoroSessions,
        decisionOptions, theme, isSidebarCollapsed, isChatbotCollapsed,
        googleAuthToken, workspaceHistory, inspirationImageId,
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

            if (!data.pages || !data.tasks) throw new Error("Invalid backup file format");
            
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
                setInspirationImageId(data.inspirationImageId || null);
                
                toast.success("Data imported successfully! The app will now reload.");
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error: any) {
            console.error("Import error:", error);
            toast.error(`Import failed: ${error.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  
  const handleWipeData = () => {
    if (dataWipeConfirmation.toLowerCase() === 'delete my data') {
        localStorage.clear();
        indexedDB.deleteDatabase('MavenDB');
        // Also clear portal DB
        indexedDB.deleteDatabase('MavenPortalDB');
        toast.success("All data has been wiped. The application will now reload.");
        setTimeout(() => window.location.reload(), 1500);
    } else {
        toast.error("Confirmation text does not match. Data was not deleted.");
    }
  };
  
  const handleInspirationImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        if (inspirationImageId) {
            await deleteBannerData(inspirationImageId);
        }
        const newImageId = `inspiration-${crypto.randomUUID()}`;
        await setBannerData(newImageId, file);
        setInspirationImageId(newImageId);
        toast.success("Inspiration image updated!");
    } catch (error) {
        toast.error("Failed to update image.");
        console.error(error);
    }
    event.target.value = '';
  };

  const handleRemoveInspirationImage = async () => {
    if (inspirationImageId) {
        try {
            await deleteBannerData(inspirationImageId);
            setInspirationImageId(null);
            toast.info("Inspiration image removed.");
        } catch (error) {
            toast.error("Failed to remove image.");
            console.error(error);
        }
    }
  };

  // --- RENDER LOGIC ---

  if (!hasEntered) {
    return <LandingPage onEnter={handleEnterApp} />;
  }
  
  const renderView = () => {
    // These are full-height "app" views that manage their own complex layouts and scrolling.
    const appViews: View[] = ['notes', 'journal', 'documind', 'workspace', 'academics'];
    
    // These are "content" pages that will be placed inside a standard scrolling container.
    const pageViews: View[] = ['dashboard', 'about', 'help', 'settings', 'inspiration'];

    // Render "app" views directly; they are responsible for their own layout.
    if (appViews.includes(view)) {
      const AppViewComponent = {
        notes: activePage ? (
          <Editor key={activePage.id} page={activePage} onUpdatePage={onUpdatePage} onDeletePage={onDeletePage} onNewPage={handleNewPage}/>
        ) : (
          <WelcomePlaceholder onNewPage={handleNewPage} />
        ),
        journal: <JournalView entries={journalEntries} onUpdate={onUpdateJournal} onDelete={onDeleteJournal} />,
        documind: <InteractiveMindMap onNewNote={handleNewPage} />,
        workspace: <GoogleWorkspace authToken={googleAuthToken} setAuthToken={setGoogleAuthToken} history={workspaceHistory} onFileImport={handleFileImport} />,
        academics: <AcademicView 
            goals={goals} 
            events={events} 
            setEvents={setEvents} 
            onNewNote={handleNewPage}
            curriculumResult={curriculumResult}
            isCurriculumGenerating={isCurriculumGenerating}
            onGenerateCurriculum={handleGenerateCurriculum}
            onClearCurriculum={handleClearCurriculum}
         />,
      }[view];
      return AppViewComponent;
    }

    // Render "content" pages within a standardized scrolling layout container.
    if (pageViews.includes(view)) {
      const PageComponent = {
        dashboard: <MamDesk 
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
              onNewNote={handleNewPage}
          />,
        about: <AboutPage />,
        help: <HelpPage />,
        inspiration: <InspirationPage inspirationImageId={inspirationImageId} />,
        settings: (
          <div className="max-w-4xl mx-auto space-y-8">
            <Section title="API Configuration">
              <p className="text-card-foreground/80 -mt-4 mb-6">Maven uses Google AI for its intelligent features. Your API key is stored securely in your browser and is never sent to our servers.</p>
              <div className="space-y-6">
                <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><BrainCircuitIcon size={20} /> Google AI (Gemini)</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Required for all AI features like the AI Assistant, Brain Dump, and DocuMind.</p>
                    <label className="block text-sm font-medium text-foreground/80 mb-1">Gemini API Key</label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter your Google Gemini API Key" className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={handleSaveSettings} disabled={isSavingSettings} className="mt-6 w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"><Save size={16} /> {isSavingSettings ? 'Saving...' : 'Save Credentials'}</button>
            </Section>

            <Section title="Cloud & Portal Configuration">
                <p className="text-card-foreground/80 -mt-4 mb-6">Configure the Student/Teacher Portal by connecting to your own Supabase project. Get your URL and Anon Key from your Supabase project's API settings.</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-1">Supabase URL</label>
                        <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://<your-project-id>.supabase.co" className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-1">Supabase Anon Key</label>
                        <input type="password" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} placeholder="Enter your Supabase anonymous key" className="w-full bg-input border-border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div className={`p-3 rounded-md text-sm ${supabaseStatus.configured ? 'bg-green-500/10 text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                        <strong>Status:</strong> {supabaseStatus.message}
                    </div>
                </div>
                <button onClick={handleTestAndSaveSupabase} disabled={isTestingSupabase} className="mt-6 w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                    {isTestingSupabase ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                    {isTestingSupabase ? 'Testing...' : 'Test Connection & Save'}
                </button>
            </Section>

            <Section title="Appearance">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {(['theme-dark', 'theme-light', 'theme-jetblack', 'theme-midlight', 'theme-midnight'] as const).map(t => (
                      <button key={t} onClick={() => setTheme(t)} className={`h-20 rounded-lg border-2 ${theme === t ? 'border-primary' : 'border-border'}`}><div className={`w-full h-full p-2 ${t} rounded-md`}><div className="w-full h-full bg-background rounded-sm flex flex-col items-center justify-center"><p className="text-xs font-semibold capitalize text-foreground">{t.split('-')[1]}</p></div></div></button>
                  ))}
              </div>
            </Section>
            <Section title="Inspiration Image">
                <p className="text-card-foreground/80 -mt-4 mb-4">Set a custom image for the "Inspiration" page.</p>
                <div className="flex items-center gap-4"><div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center">{inspirationImagePreview ? <img src={inspirationImagePreview} alt="Inspiration preview" className="w-full h-full object-cover rounded-lg"/> : <ImageIcon className="w-8 h-8 text-muted-foreground"/>}</div><div className="flex-1 space-y-2"><label className="w-full text-center cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold block"><input type="file" onChange={handleInspirationImageUpload} accept="image/*" className="hidden"/>Upload Image</label><button onClick={handleRemoveInspirationImage} disabled={!inspirationImageId} className="w-full bg-secondary disabled:opacity-50 px-4 py-2 rounded-md text-sm font-semibold">Remove</button></div></div>
            </Section>
            <Section title="Danger Zone">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-secondary rounded-lg"><h3 className="font-semibold">Export Data</h3><p className="text-xs text-muted-foreground mb-2">Download a JSON backup of all local data.</p><button onClick={handleExportData} className="w-full bg-accent hover:bg-accent/80 text-accent-foreground px-3 py-1.5 rounded-md text-sm font-semibold">Export</button></div>
                    <div className="p-4 bg-secondary rounded-lg"><h3 className="font-semibold">Import Data</h3><p className="text-xs text-muted-foreground mb-2">Overwrite all data with a backup file.</p><label className="w-full block cursor-pointer bg-accent hover:bg-accent/80 text-accent-foreground px-3 py-1.5 rounded-md text-sm font-semibold text-center"><input type="file" onChange={handleImportData} accept=".json" className="hidden"/>Import</label></div>
                      <div className="p-4 bg-destructive/10 rounded-lg"><h3 className="font-semibold text-destructive">Wipe All Data</h3><p className="text-xs text-muted-foreground mb-2">Permanently delete all local data.</p><button onClick={() => setIsDataWipeModalOpen(true)} className="w-full bg-destructive/20 hover:bg-destructive/30 text-destructive px-3 py-1.5 rounded-md text-sm font-semibold">Wipe Data</button></div>
                </div>
            </Section>
          </div>
        )
      }[view];
      
      return (
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {isDataWipeModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-destructive/50 rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="text-center">
                            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4"/>
                            <h2 className="text-xl font-bold text-foreground">Irreversible Action</h2>
                            <p className="text-muted-foreground mt-2">
                                You are about to delete all of your data. This cannot be undone. To confirm, please type "<strong className="text-destructive">delete my data</strong>" below.
                            </p>
                        </div>
                        <input type="text" value={dataWipeConfirmation} onChange={(e) => setDataWipeConfirmation(e.target.value)} className="w-full bg-input border-border rounded-md px-3 py-2 mt-4 text-center"/>
                        <div className="flex gap-4 mt-6">
                            <button onClick={() => setIsDataWipeModalOpen(false)} className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md">Cancel</button>
                            <button onClick={handleWipeData} className="flex-1 bg-destructive text-destructive-foreground py-2 rounded-md">Confirm Deletion</button>
                        </div>
                    </div>
                </div>
            )}
            {PageComponent}
        </main>
      );
    }
    
    // Fallback to a non-scrolling Welcome view if no view matches
    return <WelcomePlaceholder onNewPage={handleNewPage} />;
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${theme}`}>
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 animate-fade-in-up">
        {renderView()}
      </div>
      <aside className={`bg-card/80 backdrop-blur-xl flex-shrink-0 border-l border-border/50 flex flex-col transition-all duration-300 ease-in-out ${isChatbotCollapsed ? 'w-20' : 'w-96'}`}>
        <Chatbot
            isCollapsed={isChatbotCollapsed}
            setIsCollapsed={setIsChatbotCollapsed}
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
            onStartPomodoro={() => { setPomodoroActive(true); return "Pomodoro timer started!"; }}
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
        />
      </aside>
       <SearchPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        pages={pages}
        onSelectPage={onSelectPage}
        onNewNote={handleNewPage}
      />
       <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
        }
    `}</style>
    </div>
  );
};

const AppWithProviders: React.FC = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);

export default AppWithProviders;