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
import ResearchPage from './components/ResearchPage';
import SkillAnalyzerPage from './components/CareerGuidance';
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
import TemplateLibrary from './components/TemplateLibrary';
import { NoteTemplate } from './components/templates';
import GalleryPage from './components/GalleryPage';


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
  
  // Template Library State
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);

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

  const handleCreateBlankPage = () => {
    handleNewPage();
    setIsTemplateLibraryOpen(false);
  };

  const handleCreateFromTemplate = (template: NoteTemplate) => {
    handleNewPage(template.title, template.content);
    setIsTemplateLibraryOpen(false);
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
    
    return `Moved card "${card.text}" to "${targetColumn}".`;
  };
  
  const onAddQuickNote = (text: string): string => {
      setQuickNotes(prev => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...prev]);
      return `📝 Quick note added: "${text}"`;
  };

  const onListQuickNotes = (): string => {
      if (quickNotes.length === 0) return "You have no quick notes.";
      return "Your quick notes:\n" + quickNotes.map(n => `- ${n.text}`).join('\n');
  };
  
  const onAddHabit = (name: string): string => {
      setHabits(prev => [...prev, { id: crypto.randomUUID(), name, streak: 0, lastCompleted: null, history: [] }]);
      return `🎯 New habit added: "${name}". Good luck!`;
  };

  const onCompleteHabit = (name: string): string => {
      const todayStr = new Date().toDateString();
      let habitFound = false;
      setHabits(prev => prev.map(h => {
          if (h.name.toLowerCase().includes(name.toLowerCase()) && h.lastCompleted !== todayStr) {
              habitFound = true;
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const isConsecutive = h.lastCompleted === yesterday.toDateString();
              return { ...h, streak: isConsecutive ? h.streak + 1 : 1, lastCompleted: todayStr };
          }
          return h;
      }));
      return habitFound ? `✅ Habit "${name}" completed for today!` : `🤔 Habit "${name}" not found or already completed.`;
  };
  
  const onDeleteHabit = (name: string): string => {
      let habitFound = false;
      setHabits(prev => prev.filter(h => {
          const match = h.name.toLowerCase().includes(name.toLowerCase());
          if (match) habitFound = true;
          return !match;
      }));
      return habitFound ? `🗑️ Habit "${name}" deleted.` : `🤔 Habit "${name}" not found.`;
  };

  const onListHabits = (): string => {
      if (habits.length === 0) return "You are not tracking any habits.";
      return "Your habits:\n" + habits.map(h => `- ${h.name} (Streak: ${h.streak} days)`).join('\n');
  };

  const onTogglePomodoro = () => setPomodoroActive(prev => !prev);
  const onResetPomodoro = (): string => {
    setPomodoroActive(false);
    setPomodoroTime(25 * 60);
    return "⏰ Pomodoro timer has been reset.";
  };

  const onStartPomodoro = (): string => {
      if (!pomodoroActive) {
          setPomodoroActive(true);
          return "🍅 Pomodoro timer started for 25 minutes. Focus!";
      }
      return "Timer is already running.";
  };
  const onPausePomodoro = (): string => {
      if (pomodoroActive) {
          setPomodoroActive(false);
          return "⏸️ Pomodoro timer paused.";
      }
      return "Timer is not running.";
  };

  const onAddDecisionOption = (option: string): string => {
      setDecisionOptions(prev => [...prev, option]);
      return `Added option: "${option}"`;
  };
  
  const onAddDecisionOptions = (options: string[]): string => {
      setDecisionOptions(prev => [...prev, ...options]);
      return `Added ${options.length} options.`;
  };

  const onClearDecisionOptions = (): string => {
      setDecisionOptions([]);
      setDecisionResult('');
      return "Decision options cleared.";
  };

  const onMakeDecision = async (options?: string[]): Promise<string> => {
    const optionsToUse = options && options.length > 0 ? options : decisionOptions;
    if (optionsToUse.length < 2) return "I need at least two options to make a decision.";
    
    setIsDecisionSpinning(true);
    let spins = 0;
    const maxSpins = 20 + Math.floor(Math.random() * 15);
    
    await new Promise<void>(resolve => {
        const spinInterval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * optionsToUse.length);
            setCurrentDecisionSpin(optionsToUse[randomIndex]);
            spins++;
            if (spins >= maxSpins) {
                clearInterval(spinInterval);
                setTimeout(() => {
                    const finalChoice = optionsToUse[Math.floor(Math.random() * optionsToUse.length)];
                    setDecisionResult(finalChoice);
                    setIsDecisionSpinning(false);
                    setCurrentDecisionSpin('');
                    resolve();
                }, 500);
            }
        }, 100);
    });

    return `The decision is: ${decisionResult}`;
  };
  
    const onPlanAndCreateNote = async (topic: string): Promise<string> => {
        if (!geminiAI) return "AI features are disabled.";
        toast.info(`Generating a plan for "${topic}"...`);
        const prompt = `Create a structured, actionable plan for the following topic: "${topic}". The plan should include clear steps, sections, and potential milestones. Format it nicely using HTML for a rich text editor.`;
        const response = await geminiAI.models.generateContent({model: 'gemini-2.5-flash', contents: prompt});
        const planContent = response.text;
        const newNote = handleNewPage(`Plan: ${topic}`, planContent);
        return `✅ I've created a detailed plan for "${topic}" and saved it as a new note titled "${newNote.title}".`;
    };
    
    const onWireframeAndCreateNote = async (description: string): Promise<string> => {
        if (!geminiAI) return "AI features are disabled.";
        toast.info(`Generating a wireframe for "${description}"...`);
        const prompt = `Generate a structural layout or wireframe for a user interface based on this description: "${description}". Use simple HTML with headings, lists, and placeholders like '[Image Placeholder]' or '[Button: Submit]' to represent the structure.`;
        const response = await geminiAI.models.generateContent({model: 'gemini-2.5-flash', contents: prompt});
        const wireframeContent = response.text;
        const newNote = handleNewPage(`Wireframe: ${description}`, wireframeContent);
        return `✅ I've generated a wireframe for "${description}" and saved it as a new note titled "${newNote.title}".`;
    };

    const onAddJournalEntry = (content: string, date?: string): string => {
        const targetDate = date || new Date().toISOString().split('T')[0];
        onUpdateJournal(targetDate, content);
        return `📓 Journal entry for ${targetDate} has been saved.`;
    };

    const onAddGoal = (text: string): string => {
        setGoals(prev => [...prev, { id: crypto.randomUUID(), text, completed: false }]);
        return `🏆 New goal set: "${text}"`;
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
        return `💸 Expense logged: ${description} ($${amount})`;
    };
    
    const onAddPersonalQuote = (text: string): string => {
        setPersonalQuotes(prev => [{ id: crypto.randomUUID(), text }, ...prev]);
        return `🖋️ Quote added to your collection.`;
    };


  // --- SETTINGS & DATA MANAGEMENT ---
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    updateApiKey(apiKey);

    const { success, message } = await updateSupabaseCredentials(supabaseUrl, supabaseKey);
    setSupabaseStatus({ message, configured: success });

    if (success) toast.success("Settings saved successfully!");
    else toast.error(message);
    
    const fileInput = document.getElementById('inspiration-image-upload') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (file) {
        try {
            const newId = crypto.randomUUID();
            await setBannerData(newId, file);
            setInspirationImageId(newId);
            // The useEffect for inspirationImageId will handle the preview update.
        } catch(e) {
            console.error("Error saving inspiration image:", e);
            toast.error("Could not save inspiration image.");
        }
    }

    setIsSavingSettings(false);
  };
  
  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    const { success, message } = await updateSupabaseCredentials(supabaseUrl, supabaseKey);
    setSupabaseStatus({ message, configured: success });
    if(success) toast.success(message); else toast.error(message);
    setIsTestingSupabase(false);
  }

  const exportData = () => {
    const data = {
      pages, journalEntries, tasks, kanbanColumns, quickNotes, events, habits,
      personalQuotes, moodEntries, expenses, goals, pomodoroSessions, decisionOptions,
      theme, isSidebarCollapsed, isChatbotCollapsed, googleAuthToken, workspaceHistory,
      inspirationImageId, curriculumResult
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maven_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("All data exported successfully!");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (window.confirm("Are you sure you want to import this data? This will overwrite your current workspace.")) {
          setPages(data.pages || []);
          setJournalEntries(data.journalEntries || []);
          setTasks(data.tasks || []);
          setKanbanColumns(data.kanbanColumns || { todo: { name: 'To Do', items: [] }, progress: { name: 'In Progress', items: [] }, done: { name: 'Done', items: [] }});
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
          setCurriculumResult(data.curriculumResult || null);
          toast.success("Data imported successfully!");
        }
      } catch (err) {
        toast.error("Failed to parse import file.");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };
  
   const handleWipeData = () => {
    if (dataWipeConfirmation.toLowerCase() === 'delete') {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.deleteDatabase('MavenDB');
      indexedDB.deleteDatabase('MavenPortalDB');
      toast.success("All data has been wiped. Reloading...");
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error("Confirmation text did not match.");
    }
  };

  // --- RENDER LOGIC ---

  if (!hasEntered) {
    return <LandingPage onEnter={handleEnterApp} />;
  }

  const renderSettings = () => {
    const themes = [
      { id: 'theme-dark', name: 'Default Dark' },
      { id: 'theme-light', name: 'Default Light' },
      { id: 'theme-jetblack', name: 'Jet Black' },
      { id: 'theme-midnight', name: 'Midnight Blue' },
      { id: 'theme-midlight', name: 'Midlight' },
    ];
    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto space-y-8">
            <h1 className="text-4xl font-bold text-center text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Settings</h1>
            <Section title="Theme & Appearance">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {themes.map(t => (
                        <button key={t.id} onClick={() => setTheme(t.id)} className={`p-4 rounded-lg border-2 ${theme === t.id ? 'border-primary' : 'border-border'}`}>
                             <div className={`w-full h-16 rounded-md ${t.id} border border-border`}></div>
                            <p className="mt-2 text-sm text-center">{t.name}</p>
                        </button>
                    ))}
                </div>
            </Section>
             <Section title="Personalization">
                <div className="space-y-4">
                    <div>
                        <label className="font-semibold text-card-foreground/90">Inspiration Image</label>
                        <p className="text-sm text-muted-foreground mb-2">Upload a photo for your 'Inspiration' page.</p>
                        <div className="flex items-center gap-4">
                            {inspirationImagePreview && <img src={inspirationImagePreview} alt="Preview" className="w-16 h-16 rounded-md object-cover"/>}
                            <input id="inspiration-image-upload" type="file" accept="image/*" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                        </div>
                    </div>
                </div>
            </Section>
            <Section title="API Keys & Integrations">
                 <div className="space-y-6">
                    <div>
                        <label htmlFor="api-key" className="font-semibold text-card-foreground/90 flex items-center gap-2">
                           <BrainCircuitIcon size={18} /> Google Gemini API Key
                        </label>
                         <p className="text-sm text-muted-foreground mb-2">Required for all AI features. Your key is stored locally and never shared.</p>
                        <input id="api-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter your Gemini API Key" className="w-full bg-input p-2 rounded-md"/>
                    </div>
                     <div>
                        <label className="font-semibold text-card-foreground/90 flex items-center gap-2">
                           <UsersIcon size={18}/> Supabase Credentials (for Portal)
                        </label>
                         <p className="text-sm text-muted-foreground mb-2">Optional. Required only for the cloud-based Student/Teacher Portal.</p>
                        <div className="space-y-2">
                            <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="Supabase Project URL" className="w-full bg-input p-2 rounded-md"/>
                            <input type="password" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} placeholder="Supabase Anon Key" className="w-full bg-input p-2 rounded-md"/>
                             <div className="flex items-center justify-between text-sm">
                               <p className={`font-mono text-xs p-2 rounded-md ${supabaseStatus.configured ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'}`}>{supabaseStatus.message}</p>
                               <button onClick={handleTestSupabase} disabled={isTestingSupabase} className="px-3 py-1 bg-secondary rounded-md disabled:opacity-50 flex items-center gap-2">
                                    {isTestingSupabase ? <Loader size={14} className="animate-spin"/> : 'Test'}
                                </button>
                            </div>
                        </div>
                    </div>
                 </div>
            </Section>
            <div className="flex justify-end">
                <button onClick={handleSaveSettings} disabled={isSavingSettings} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
                   {isSavingSettings ? <><Loader className="animate-spin"/> Saving...</> : <><Save/> Save Settings</>}
                </button>
            </div>
            <Section title="Data Management">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-secondary p-4 rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2"><Download/> Export Data</h4>
                        <p className="text-sm text-muted-foreground mb-2">Save a JSON backup of your entire workspace.</p>
                        <button onClick={exportData} className="w-full text-sm bg-accent p-2 rounded-md">Export All Data</button>
                    </div>
                    <div className="bg-secondary p-4 rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2"><Upload/> Import Data</h4>
                        <p className="text-sm text-muted-foreground mb-2">Restore your workspace from a backup file.</p>
                        <input type="file" accept=".json" onChange={importData} className="w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent/80"/>
                    </div>
                </div>
            </Section>
            <Section title={<span className="text-destructive flex items-center gap-2"><AlertTriangle/> Danger Zone</span>}>
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                     <h4 className="font-semibold text-destructive">Wipe All Local Data</h4>
                     <p className="text-sm text-destructive/80 mb-4">This will permanently delete all your pages, tasks, and settings from this browser. This action cannot be undone. Please export your data first.</p>
                     <div className="flex items-center gap-4">
                        <input type="text" value={dataWipeConfirmation} onChange={e => setDataWipeConfirmation(e.target.value)} placeholder="Type 'delete' to confirm" className="w-full bg-input p-2 rounded-md"/>
                        <button onClick={handleWipeData} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-semibold flex items-center gap-2">
                            <Trash2/> Wipe Data
                        </button>
                    </div>
                </div>
            </Section>
        </div>
    );
  };
  
  const renderContent = () => {
    if (view === 'dashboard') return <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto"><MamDesk activeTab={activeDashboardTab} {...{ tasks, onAddTask, onToggleTask: (id) => setTasks(tasks.map(t => t.id === id ? {...t, completed: !t.completed} : t)), onDeleteTask: (id) => setTasks(tasks.filter(t => t.id !== id)), kanbanColumns, setKanbanColumns, onAddKanbanCard: (colId, text) => { const newItem = { id: crypto.randomUUID(), text }; setKanbanColumns(prev => ({...prev, [colId]: {...prev[colId], items: [...prev[colId].items, newItem]}}))}, quickNotes, setQuickNotes, events, onAddEvent, habits, setHabits, personalQuotes, setPersonalQuotes, moodEntries, setMoodEntries, expenses, setExpenses, goals, setGoals, pomodoroTime, pomodoroActive, pomodoroSessions, onTogglePomodoro, onResetPomodoro, decisionOptions, setDecisionOptions, decisionResult, setDecisionResult, isDecisionSpinning, setIsDecisionSpinning, currentDecisionSpin, setCurrentDecisionSpin, theme, setTheme, pages, onNewNote: handleNewPage }} /></div>;
    if (view === 'journal') return <JournalView entries={journalEntries} onUpdate={onUpdateJournal} onDelete={onDeleteJournal} />;
    if (view === 'documind') return <InteractiveMindMap onNewNote={handleNewPage} />;
    if (view === 'workspace') return <GoogleWorkspace authToken={googleAuthToken} setAuthToken={setGoogleAuthToken} history={workspaceHistory} onFileImport={handleFileImport} />;
    if (view === 'academics') return <AcademicView goals={goals} events={events} setEvents={setEvents} onNewNote={handleNewPage} curriculumResult={curriculumResult} isCurriculumGenerating={isCurriculumGenerating} onGenerateCurriculum={handleGenerateCurriculum} onClearCurriculum={handleClearCurriculum} />;
    if (view === 'about') return <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto"><AboutPage/></div>;
    if (view === 'inspiration') return <InspirationPage inspirationImageId={inspirationImageId} />;
    if (view === 'gallery') return <GalleryPage />;
    if (view === 'research') return <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto"><ResearchPage/></div>;
    if (view === 'skill-analyzer') return <SkillAnalyzerPage onNewNote={handleNewPage} />;
    if (view === 'settings') return renderSettings();
    if (view === 'help') return <div className="p-8 overflow-y-auto h-full"><HelpPage/></div>;

    if (activePage) {
      return <Editor page={activePage} onUpdatePage={onUpdatePage} onDeletePage={onDeletePage} onNewPage={() => setIsTemplateLibraryOpen(true)} />;
    }
    
    return <WelcomePlaceholder onNewPage={() => setIsTemplateLibraryOpen(true)} />;
  };

  return (
    <div className="flex h-screen w-screen bg-background font-sans">
        <Sidebar
          pages={pages}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onNewPage={() => setIsTemplateLibraryOpen(true)}
          view={view}
          setView={setView}
          activeTab={activeDashboardTab}
          setActiveTab={setActiveDashboardTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onToggleSearch={() => setIsSearchOpen(true)}
          onGoToLandingPage={handleGoToLandingPage}
        />
        <main className="flex-1 flex flex-col min-w-0 h-full relative">
            {renderContent()}
        </main>
         <aside className={`flex-shrink-0 border-l border-border/50 transition-all duration-300 ease-in-out ${isChatbotCollapsed ? 'w-16' : 'w-96'}`}>
            <Chatbot
              onAddTask={onAddTask} onAddEvent={onAddEvent} onNewPage={handleNewPage} onGetDailyBriefing={onGetDailyBriefing} onGenerateCreativeContent={onGenerateCreativeContent}
              onCompleteTaskByText={onCompleteTaskByText} onDeleteTaskByText={onDeleteTaskByText} onListTasks={onListTasks} onDeleteNoteByTitle={onDeleteNoteByTitle}
              onMoveKanbanCard={onMoveKanbanCard} onAddQuickNote={onAddQuickNote} onListQuickNotes={onListQuickNotes}
              onAddHabit={onAddHabit} onCompleteHabit={onCompleteHabit} onDeleteHabit={onDeleteHabit} onListHabits={onListHabits}
              onStartPomodoro={onStartPomodoro} onPausePomodoro={onPausePomodoro} onResetPomodoro={onResetPomodoro}
              onAddDecisionOption={onAddDecisionOption} onAddDecisionOptions={onAddDecisionOptions} onClearDecisionOptions={onClearDecisionOptions} onMakeDecision={onMakeDecision}
              onPlanAndCreateNote={onPlanAndCreateNote} onWireframeAndCreateNote={onWireframeAndCreateNote} onAddJournalEntry={onAddJournalEntry}
              onAddGoal={onAddGoal} onLogMood={onLogMood} onAddExpense={onAddExpense} onAddPersonalQuote={onAddPersonalQuote}
              isCollapsed={isChatbotCollapsed} setIsCollapsed={setIsChatbotCollapsed}
            />
        </aside>
        <SearchPalette 
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            pages={pages}
            onSelectPage={onSelectPage}
            onNewNote={handleNewPage}
        />
        <TemplateLibrary
            isOpen={isTemplateLibraryOpen}
            onClose={() => setIsTemplateLibraryOpen(false)}
            onSelectTemplate={handleCreateFromTemplate}
            onNewBlankPage={handleCreateBlankPage}
        />
    </div>
  );
};

const AppWithProviders: React.FC = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);

export default AppWithProviders;