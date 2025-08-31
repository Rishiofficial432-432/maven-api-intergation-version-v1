import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import MamDesk, { Task, KanbanState, QuickNote, CalendarEvent, Habit, Quote, MoodEntry, Expense, Goal, KanbanItem, Class, Student, Attendance } from './components/MamDesk';
import { WelcomePlaceholder } from './components/WelcomePlaceholder';
import Chatbot from './components/Chatbot';
import JournalView from './components/JournalView';
import InteractiveMindMap from './components/InteractiveMindMap';
import GoogleWorkspace from './components/GoogleWorkspace';
import { geminiAI } from './components/gemini';
import StudentTeacherPortal from './components/StudentTeacherPortal';
import { ToastProvider, useToast } from './components/Toast';
import SearchPalette from './components/SearchPalette';

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
      return reject('DB not initialized');
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
    if (!db) return reject('DB not initialized');
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
        if (!db) return reject('DB not initialized');
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


export type View = 'notes' | 'dashboard' | 'journal' | 'documind' | 'workspace' | 'portal';

export interface Page {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  bannerUrl?: string;
  bannerType?: 'image' | 'video';
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  createdAt: Date;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink: string;
}

export interface WorkspaceHistoryEntry {
    fileId: string;
    fileName: string;
    fileType: 'doc' | 'sheet';
    noteTitle: string;
    importedAt: string;
}

// Custom hook for persisting state to localStorage, moved here for centralization
const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (key === 'ai-notes-pages' && storedValue) {
        return JSON.parse(storedValue).map((p: any) => ({...p, createdAt: new Date(p.createdAt)}));
      }
       if (key === 'maven-journal-entries' && storedValue) {
        return JSON.parse(storedValue).map((e: any) => ({...e, createdAt: new Date(e.createdAt)}));
      }
       if (key === 'maven-mind-maps' && storedValue) {
        return JSON.parse(storedValue).map((m: any) => ({...m, createdAt: new Date(m.createdAt)}));
      }
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage for key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error writing to localStorage for key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
};


const AppContent: React.FC = () => {
  // Initialize DB on mount
  useEffect(() => {
    initDB().catch(err => console.error("Failed to initialize DB:", err));
  }, []);

  // Theme State
  const [theme, setTheme] = usePersistentState<string>('maven-theme', 'dark');
  const toast = useToast();

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);

  // Notes State
  const [pages, setPages] = usePersistentState<Page[]>('ai-notes-pages', []);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [view, setView] = usePersistentState<View>('maven-view', 'notes');
  const [activeTab, setActiveTab] = usePersistentState('maven-activeTab', 'dashboard');
  
  // MamDesk State
  const [tasks, setTasks] = usePersistentState<Task[]>('maven-tasks', []);
  const [kanbanColumns, setKanbanColumns] = usePersistentState<KanbanState>('maven-kanban', {
    todo: { name: 'To Do', items: [] },
    progress: { name: 'In Progress', items: [] },
    done: { name: 'Done', items: [] },
  });
  const [quickNotes, setQuickNotes] = usePersistentState<QuickNote[]>('maven-notes', []);
  const [events, setEvents] = usePersistentState<CalendarEvent[]>('maven-events', []);
  const [habits, setHabits] = usePersistentState<Habit[]>('maven-habits', []);
  const [personalQuotes, setPersonalQuotes] = usePersistentState<Quote[]>('maven-quotes', []);
  const [moodEntries, setMoodEntries] = usePersistentState<MoodEntry[]>('maven-mood', []);
  const [expenses, setExpenses] = usePersistentState<Expense[]>('maven-expenses', []);
  const [goals, setGoals] = usePersistentState<Goal[]>('maven-goals', []);

  // Attendance State
  const [classes, setClasses] = usePersistentState<Class[]>('maven-classes', []);
  const [students, setStudents] = usePersistentState<Student[]>('maven-students', []);
  const [attendance, setAttendance] = usePersistentState<Attendance>('maven-attendance', {});

  // Pomodoro State
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroSessions, setPomodoroSessions] = usePersistentState('maven-pomodoro-sessions', 0);
  const timerRef = useRef<number | null>(null);

  // Decision Maker State
  const [decisionOptions, setDecisionOptions] = usePersistentState<string[]>('maven-decision-options', []);
  const [decisionResult, setDecisionResult] = usePersistentState<string>('maven-decision-result', '');
  const [isDecisionSpinning, setIsDecisionSpinning] = useState(false);
  const [currentDecisionSpin, setCurrentDecisionSpin] = useState('');
  
  // Journal State
  const [journalEntries, setJournalEntries] = usePersistentState<JournalEntry[]>('maven-journal-entries', []);

  // UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentState<boolean>('maven-sidebar-collapsed', false);
  const [isChatbotCollapsed, setIsChatbotCollapsed] = usePersistentState<boolean>('maven-chatbot-collapsed', false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Google Workspace State
  const [authToken, setAuthToken] = usePersistentState<any | null>('maven-google-auth', null);
  const [workspaceHistory, setWorkspaceHistory] = usePersistentState<WorkspaceHistoryEntry[]>('maven-workspace-history', []);


  useEffect(() => {
    if (pomodoroActive && pomodoroTime > 0) {
      timerRef.current = window.setTimeout(() => setPomodoroTime(t => t - 1), 1000);
    } else if (pomodoroTime === 0 && pomodoroActive) {
      setPomodoroActive(false);
      setPomodoroSessions(prev => prev + 1);
      toast.success('Pomodoro session completed! 🍅');
      setPomodoroTime(25 * 60);
    }
    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pomodoroActive, pomodoroTime, setPomodoroSessions, toast]);
  
   // Global keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsSearchOpen(isOpen => !isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  // Notes Handlers
  const handleNewPage = (title: string = 'Untitled Page', content: string = '') => {
    const newPage: Page = {
      id: crypto.randomUUID(),
      title: title,
      content: content,
      createdAt: new Date(),
    };
    setPages(prevPages => [newPage, ...prevPages]);
    setActivePageId(newPage.id);
    setView('notes'); // Switch to notes view when a new page is created
    return newPage;
  };

  const handleSelectPage = (id: string) => {
    setActivePageId(id);
    setView('notes');
  };

  const handleDeletePage = async (id: string) => {
    const pageToDelete = pages.find(p => p.id === id);
    if (pageToDelete?.bannerUrl && !pageToDelete.bannerUrl.startsWith('data:')) {
        try {
            await deleteBannerData(pageToDelete.bannerUrl);
        } catch (error) {
            console.error("Failed to delete banner from DB:", error);
        }
    }

    setPages(prevPages => {
      const remainingPages = prevPages.filter(page => page.id !== id);
      if (activePageId === id) {
        setActivePageId(remainingPages.length > 0 ? remainingPages[0].id : null);
      }
      return remainingPages;
    });
    return `Note successfully deleted.`;
  };
  
  const handleDeleteNoteByTitle = async (title: string) => {
    const pageToDelete = pages.find(p => p.title.toLowerCase() === title.toLowerCase());
    if (pageToDelete) {
        await handleDeletePage(pageToDelete.id);
        return `Successfully deleted the note titled "${title}".`;
    }
    return `Could not find a note with the title "${title}".`;
  };

  const handleUpdatePage = (id: string, updates: Partial<Omit<Page, 'id'>>) => {
    setPages(prevPages =>
      prevPages.map(page =>
        page.id === id ? { ...page, ...updates } : page
      )
    );
  };
  
  const handleGenerateCreativeContent = (content: string) => {
    if (activePage) {
        const formattedContent = content.replace(/\n/g, '<br/>');
        const newContent = activePage.content ? `${activePage.content}<br/><br/>${formattedContent}` : formattedContent;
        handleUpdatePage(activePage.id, { content: newContent });
        return `✍️ Content added to note: "${activePage.title}"`;
    }
    return `⚠️ Please select a note first before adding content.`;
  };

  const handlePlanAndCreateNote = async (topic: string): Promise<string> => {
    if (!geminiAI) {
      return "⚠️ AI features are disabled. API key not configured.";
    }
    try {
      const prompt = `Create a detailed, structured plan for the following topic: "${topic}". Use markdown for formatting, including headers, bullet points, and checklists (e.g., "- [ ] Task").`;
      
      const response = await geminiAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });

      const planContent = response.text;
      if (!planContent && (response as any).promptFeedback?.blockReason) {
          throw new Error(`Request was blocked by the API. Reason: ${(response as any).promptFeedback.blockReason}`);
      }
      if (!planContent.trim()) {
          throw new Error("The AI returned an empty response.");
      }

      const finalHtmlContent = `<pre style="white-space: pre-wrap; font-family: inherit; font-size: inherit; line-height: 1.6;">${planContent.trim()}</pre>`;

      handleNewPage(`Plan for ${topic}`, finalHtmlContent);

      return `✅ I've created a new note with a plan for "${topic}".`;
    } catch (error: any) {
        console.error("Failed to generate plan:", error);
        return `⚠️ Sorry, I couldn't generate a plan for "${topic}". ${error.message}`;
    }
  };

  const handleWireframeAndCreateNote = async (description: string): Promise<string> => {
    if (!geminiAI) {
      return "⚠️ AI features are disabled. API key not configured.";
    }
    try {
      const prompt = `Generate a textual wireframe or structural layout for the following description: "${description}". Use a combination of simple text, symbols, and ASCII-art like boxes to represent components like buttons, inputs, images, and text blocks. The output should be clear and enclosed in a code block. For example:
+----------------------------------+
| [Logo]      Nav | Link1 | Link2  |
+----------------------------------+
|                                  |
|      <Image Placeholder>         |
|                                  |
+----------------------------------+
|       [Product Title]            |
|                                  |
|  "Product description goes here" |
|                                  |
|      <Button: Add to Cart>       |
+----------------------------------+`;
      
      const response = await geminiAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });
      const wireframeContent = response.text;
       if (!wireframeContent && (response as any).promptFeedback?.blockReason) {
          throw new Error(`Request was blocked by the API. Reason: ${(response as any).promptFeedback.blockReason}`);
      }
      if (!wireframeContent.trim()) {
          throw new Error("The AI returned an empty response.");
      }
      const finalHtmlContent = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 14px; line-height: 1.2;">${wireframeContent.trim()}</pre>`;

      handleNewPage(`Wireframe for ${description}`, finalHtmlContent);

      return `✅ Done! I've created a new note with a wireframe for "${description}".`;
    } catch (error: any) {
      console.error("Failed to generate wireframe:", error);
      return `⚠️ Sorry, I was unable to create the wireframe for "${description}". ${error.message}`;
    }
  };
  
  // Google Workspace Handler
  const handleFileImport = ({ file, htmlContent }: { file: DriveFile, htmlContent: string }) => {
    const newNoteTitle = `Imported: ${file.name}`;
    const newPage = handleNewPage(newNoteTitle, htmlContent);

    const historyEntry: WorkspaceHistoryEntry = {
        fileId: file.id,
        fileName: file.name,
        fileType: file.mimeType.includes('spreadsheet') ? 'sheet' : 'doc',
        noteTitle: newPage.title,
        importedAt: new Date().toISOString(),
    };
    setWorkspaceHistory(prev => [historyEntry, ...prev]);

    setActivePageId(newPage.id);
    setView('notes');
  };


  // MamDesk Handlers
  const handleAddTask = (text: string) => {
    if (text.trim()) {
      setTasks(prev => [...prev, { id: Date.now(), text: text, completed: false, createdAt: new Date().toISOString() }]);
      return `✅ Task added: "${text}"`;
    }
    return `⚠️ Could not add an empty task.`;
  };
  
  const handleToggleTask = (id: number) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const handleDeleteTask = (id: number) => setTasks(tasks.filter(t => t.id !== id));
  
  const handleCompleteTaskByText = (text: string) => {
      let taskId: number | null = null;
      const lowerCaseText = text.toLowerCase();
      const updatedTasks = tasks.map(task => {
          if (!task.completed && task.text.toLowerCase().includes(lowerCaseText)) {
              taskId = task.id;
              return { ...task, completed: true };
          }
          return task;
      });

      if (taskId !== null) {
          setTasks(updatedTasks);
          return `✅ Marked task "${text}" as completed.`;
      }
      return `⚠️ Could not find an incomplete task matching "${text}".`;
  };
  
  const handleDeleteTaskByText = (text: string) => {
      let taskFound = false;
      const lowerCaseText = text.toLowerCase();
      const remainingTasks = tasks.filter(task => {
          if (task.text.toLowerCase().includes(lowerCaseText)) {
              taskFound = true;
              return false; // Exclude this task
          }
          return true;
      });

      if (taskFound) {
          setTasks(remainingTasks);
          return `🗑️ Deleted task matching "${text}".`;
      }
      return `⚠️ Could not find a task matching "${text}".`;
  };
  
  const handleListTasks = () => {
    if (tasks.length === 0) return "You have no tasks.";
    const incomplete = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    let taskList = "";
    if (incomplete.length > 0) {
        taskList += "📝 Incomplete Tasks:\n" + incomplete.map(t => `- ${t.text}`).join('\n');
    }
    if (completed.length > 0) {
         taskList += "\n\n✅ Completed Tasks:\n" + completed.map(t => `- ${t.text}`).join('\n');
    }
    return taskList.trim();
  };

  const handleAddEvent = (title: string, date: string, time: string) => {
      setEvents(prev => [...prev, { id: Date.now(), title, date, time }]);
      return `🗓️ Event added: "${title}" on ${date} at ${time}.`;
  };

  const handleAddKanbanCard = (columnId: string, text: string) => {
    const newItem = { id: `item-${Date.now()}`, text };
    setKanbanColumns(prev => ({
        ...prev,
        [columnId]: {
            ...prev[columnId],
            items: [...prev[columnId].items, newItem]
        }
    }));
  };
  
  const handleMoveKanbanCard = (cardText: string, targetColumn: 'To Do' | 'In Progress' | 'Done'): string => {
      let cardFound: KanbanItem | null = null;
      let sourceColumnId: string | null = null;
      const lowerCardText = cardText.toLowerCase();

      const newColumns = { ...kanbanColumns };

      // Find and remove the card
      for (const colId in newColumns) {
          const cardIndex = newColumns[colId].items.findIndex(item => item.text.toLowerCase().includes(lowerCardText));
          if (cardIndex > -1) {
              cardFound = newColumns[colId].items[cardIndex];
              sourceColumnId = colId;
              newColumns[colId].items.splice(cardIndex, 1);
              break;
          }
      }

      if (!cardFound || !sourceColumnId) {
          return `⚠️ Could not find a card matching "${cardText}".`;
      }

      // Find the target column and add the card
      const targetColumnId = Object.keys(newColumns).find(id => newColumns[id].name === targetColumn);
      if (!targetColumnId) {
          return `⚠️ Invalid target column "${targetColumn}". Please use 'To Do', 'In Progress', or 'Done'.`;
      }

      newColumns[targetColumnId].items.push(cardFound);
      setKanbanColumns(newColumns);
      
      return `✅ Moved card "${cardFound.text}" to "${targetColumn}".`;
  };
  
    const handleAddQuickNote = (text: string) => {
        setQuickNotes(prev => [...prev, { id: Date.now(), text, createdAt: new Date().toISOString() }]);
        return `🗒️ Quick note added.`;
    };
    
    const handleListQuickNotes = () => {
        if (quickNotes.length === 0) return "You have no quick notes.";
        return "Your quick notes:\n" + quickNotes.map(n => `- ${n.text}`).join('\n');
    }
    
    const handleAddHabit = (name: string) => {
        if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
            return `⚠️ A habit named "${name}" already exists.`;
        }
        setHabits(prev => [...prev, { id: Date.now(), name: name.trim(), streak: 0, lastCompleted: null, history: [] }]);
        return `💪 New habit added: "${name}". Let's get started!`;
    };

    // FIX: Explicitly type updatedHabits to allow for the temporary 'alreadyCompleted' property,
    // which resolves type errors in this function.
    const handleCompleteHabit = (name: string) => {
        const todayStr = new Date().toDateString();
        let habitFound = false;
        const updatedHabits: (Habit & { alreadyCompleted?: boolean })[] = habits.map(h => {
            if (h.name.toLowerCase() === name.toLowerCase()) {
                habitFound = true;
                if (h.lastCompleted === todayStr) {
                    return { ...h, alreadyCompleted: true }; // Custom flag to handle message
                }
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const isConsecutive = h.lastCompleted === yesterday.toDateString();
                return { ...h, streak: isConsecutive ? h.streak + 1 : 1, lastCompleted: todayStr, history: [...h.history, { date: todayStr, completed: true }] };
            }
            return h;
        });

        if (!habitFound) {
            return `⚠️ Could not find a habit named "${name}".`;
        }

        const updatedHabit = updatedHabits.find(h => h.name.toLowerCase() === name.toLowerCase());
        if (updatedHabit?.alreadyCompleted) {
            return `👍 You've already completed the habit "${name}" today!`;
        }
        
        setHabits(updatedHabits.map(({ alreadyCompleted, ...rest }) => rest)); // remove the temporary flag
        return `🎉 Great job! You've completed "${name}" for today. Current streak: ${updatedHabit!.streak} days.`;
    };

    const handleDeleteHabit = (name: string) => {
        const habitExists = habits.some(h => h.name.toLowerCase() === name.toLowerCase());
        if (!habitExists) {
            return `⚠️ Could not find a habit named "${name}".`;
        }
        setHabits(habits.filter(h => h.name.toLowerCase() !== name.toLowerCase()));
        return `🗑️ Habit "${name}" has been deleted.`;
    };

    const handleListHabits = () => {
        if (habits.length === 0) return "You are not tracking any habits yet.";
        return "Your current habits:\n" + habits.map(h => `- ${h.name} (Streak: ${h.streak} days)`).join('\n');
    };

    // Pomodoro Handlers from Chatbot
    const handleStartPomodoro = () => {
        if (pomodoroActive) return "⏰ The Pomodoro timer is already running.";
        setPomodoroActive(true);
        return "🍅 Pomodoro started! Time to focus for 25 minutes.";
    };
    const handlePausePomodoro = () => {
        if (!pomodoroActive) return "⏰ The Pomodoro timer is not running.";
        setPomodoroActive(false);
        return "⏸️ Pomodoro paused.";
    };
    const handleResetPomodoro = () => {
        setPomodoroActive(false);
        setPomodoroTime(25 * 60);
        return "🔄 Pomodoro timer has been reset.";
    };

    // Decision Maker Handlers
    const handleAddDecisionOption = (option: string) => {
        if (decisionOptions.includes(option)) return `🤔 The option "${option}" is already on the list.`;
        setDecisionOptions(prev => [...prev, option]);
        return `✅ Option "${option}" added.`;
    };
    const handleAddDecisionOptions = (options: string[]) => {
        setDecisionOptions(prev => [...new Set([...prev, ...options])]);
        return `✅ Added ${options.length} new options to the decision maker.`;
    };
    const handleClearDecisionOptions = () => {
        setDecisionOptions([]);
        setDecisionResult('');
        return `🗑️ All decision options have been cleared.`;
    };
    const handleMakeDecision = async (options?: string[]): Promise<string> => {
        const optionsToUse = options && options.length > 0 ? options : decisionOptions;
        if (optionsToUse.length < 2) return "⚠️ I need at least two options to make a decision.";
        
        setIsDecisionSpinning(true);
        setDecisionResult('');

        return new Promise(resolve => {
            let spins = 0;
            const maxSpins = 20 + Math.floor(Math.random() * 15);
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
                        resolve(`🎯 After careful consideration, I choose: **${finalChoice}**`);
                    }, 500);
                }
            }, 100);
        });
    };
    
    // Journal Handlers
    const handleAddJournalEntry = (content: string, date?: string) => {
        const targetDate = date ? date : new Date().toISOString().split('T')[0];
        const existingEntryIndex = journalEntries.findIndex(e => e.date === targetDate);

        if (existingEntryIndex > -1) {
            // Update existing entry
            const updatedEntries = [...journalEntries];
            updatedEntries[existingEntryIndex] = { ...updatedEntries[existingEntryIndex], content: updatedEntries[existingEntryIndex].content + "\n\n" + content };
            setJournalEntries(updatedEntries);
            return `✍️ Added more thoughts to your journal entry for ${targetDate}.`;
        } else {
            // Create new entry
            const newEntry: JournalEntry = { id: crypto.randomUUID(), date: targetDate, content, createdAt: new Date() };
            setJournalEntries(prev => [newEntry, ...prev]);
             return `📖 Your journal entry for ${targetDate} has been saved.`;
        }
    };
    
    // Personal Suite Handlers
    const handleAddGoal = (text: string) => {
        setGoals(prev => [...prev, { id: Date.now(), text, completed: false }]);
        return `🏆 New goal set: "${text}"`;
    };
    
    const handleLogMood = (mood: string) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const newEntry: MoodEntry = { id: Date.now(), mood, date: todayStr };
        setMoodEntries(prev => [...prev.filter(e => e.date !== todayStr), newEntry]);
        return `😊 Mood logged for today: ${mood}.`;
    };
    
    const handleAddExpense = (description: string, amount: number, category: string = 'General') => {
        const newExpense: Expense = { id: Date.now(), description, amount, category, date: new Date().toISOString() };
        setExpenses(prev => [newExpense, ...prev]);
        return `💸 Expense logged: $${amount} for "${description}".`;
    };
    
    const handleAddPersonalQuote = (text: string) => {
        setPersonalQuotes(prev => [...prev, { id: Date.now(), text }]);
        return `✨ Quote added to your collection.`;
    };

    // MamDesk -> Attendance Handlers
    const handleAddClass = (name: string) => {
        const newClass: Class = { id: crypto.randomUUID(), name };
        setClasses(prev => [...prev, newClass]);
    };

    const handleDeleteClass = (id: string) => {
        setClasses(prev => prev.filter(c => c.id !== id));
        // Also delete associated students and attendance
        const studentIdsToDelete = students.filter(s => s.classId === id).map(s => s.id);
        setStudents(prev => prev.filter(s => s.classId !== id));
        const newAttendance = { ...attendance };
        Object.keys(newAttendance).forEach(date => {
            studentIdsToDelete.forEach(studentId => {
                delete newAttendance[date][studentId];
            });
            if (Object.keys(newAttendance[date]).length === 0) {
                delete newAttendance[date];
            }
        });
        setAttendance(newAttendance);
    };

    const handleAddStudent = (name: string, enrollment: string, classId: string) => {
        const newStudent: Student = { id: crypto.randomUUID(), name, enrollment, classId };
        setStudents(prev => [...prev, newStudent]);
    };
    
    const handleAddStudentsBatch = (newStudents: { name: string; enrollment: string; classId: string }[]): string => {
        const existingEnrollments = new Set(students.filter(s => s.classId === newStudents[0]?.classId).map(s => s.enrollment));
        const trulyNewStudents = newStudents.filter(s => !existingEnrollments.has(s.enrollment));

        const studentsToAdd: Student[] = trulyNewStudents.map(s => ({
            ...s,
            id: crypto.randomUUID(),
        }));

        if (studentsToAdd.length > 0) {
            setStudents(prev => [...prev, ...studentsToAdd]);
        }
        
        const addedCount = studentsToAdd.length;
        const skippedCount = newStudents.length - addedCount;

        let message = `Successfully imported ${addedCount} new students.`;
        if (skippedCount > 0) {
            message += ` Skipped ${skippedCount} students with duplicate enrollment numbers.`;
        }
        return message;
    };

    const handleDeleteStudent = (id: string) => {
        setStudents(prev => prev.filter(s => s.id !== id));
        // Also delete associated attendance
        const newAttendance = { ...attendance };
        Object.keys(newAttendance).forEach(date => {
            delete newAttendance[date][id];
             if (Object.keys(newAttendance[date]).length === 0) {
                delete newAttendance[date];
            }
        });
        setAttendance(newAttendance);
    };

    const handleSetAttendance = (date: string, studentId: string, status: 'Present' | 'Absent') => {
        setAttendance(prev => {
            const newAttendance = { ...prev };
            if (!newAttendance[date]) {
                newAttendance[date] = {};
            }
            newAttendance[date][studentId] = status;
            return newAttendance;
        });
    };


    // Get Daily Briefing from Chatbot
    const getDailyBriefing = () => {
        const today = new Date().toISOString().split('T')[0];
        const todaysTasks = tasks.filter(t => !t.completed);
        const todaysEvents = events.filter(e => e.date === today);

        let briefing = `📅 **Daily Briefing for ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}**\n\n`;

        if (todaysTasks.length > 0) {
            briefing += "📝 **Top Tasks:**\n" + todaysTasks.map(t => `- ${t.text}`).join('\n');
        } else {
            briefing += "👍 No pending tasks for today. Great job!";
        }

        if (todaysEvents.length > 0) {
            briefing += "\n\n🗓️ **Today's Events:**\n" + todaysEvents.map(e => `- ${e.title} at ${e.time}`).join('\n');
        } else {
            briefing += "\n\n🎉 No events scheduled for today.";
        }

        return briefing;
    };

    const activePage = pages.find(page => page.id === activePageId);

    // Journal view handlers
    const handleUpdateJournalEntry = (date: string, content: string) => {
        const existingEntryIndex = journalEntries.findIndex(e => e.date === date);
        if (existingEntryIndex > -1) {
            // Update existing entry
            const updatedEntries = [...journalEntries];
            updatedEntries[existingEntryIndex].content = content;
            setJournalEntries(updatedEntries);
        } else if (content.trim()) {
            // Create new entry
             const newEntry: JournalEntry = { id: crypto.randomUUID(), date: date, content, createdAt: new Date() };
             setJournalEntries(prev => [newEntry, ...prev].sort((a,b) => b.date.localeCompare(a.date)));
        }
    };

    const handleDeleteJournalEntry = (date: string) => {
        setJournalEntries(prev => prev.filter(e => e.date !== date));
    };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        pages={pages}
        activePageId={activePageId}
        onSelectPage={handleSelectPage}
        onNewPage={handleNewPage}
        view={view}
        setView={setView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
      />
      <div className="flex-1 flex flex-col min-w-0">
          {view === 'notes' && (
            activePage ? (
              <Editor
                key={activePage.id}
                page={activePage}
                onUpdatePage={handleUpdatePage}
                onDeletePage={handleDeletePage}
                onNewPage={handleNewPage}
              />
            ) : (
              <WelcomePlaceholder onNewPage={handleNewPage}/>
            )
          )}
          {view === 'dashboard' && <MamDesk
              activeTab={activeTab}
              pages={pages}
              tasks={tasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask}
              kanbanColumns={kanbanColumns} setKanbanColumns={setKanbanColumns} onAddKanbanCard={handleAddKanbanCard}
              quickNotes={quickNotes} setQuickNotes={setQuickNotes}
              events={events} onAddEvent={handleAddEvent}
              habits={habits} setHabits={setHabits}
              personalQuotes={personalQuotes} setPersonalQuotes={setPersonalQuotes}
              moodEntries={moodEntries} setMoodEntries={setMoodEntries}
              expenses={expenses} setExpenses={setExpenses}
              goals={goals} setGoals={setGoals}
              pomodoroTime={pomodoroTime} pomodoroActive={pomodoroActive} pomodoroSessions={pomodoroSessions}
              onTogglePomodoro={() => setPomodoroActive(!pomodoroActive)}
              onResetPomodoro={() => { setPomodoroActive(false); setPomodoroTime(25*60); }}
              decisionOptions={decisionOptions} setDecisionOptions={setDecisionOptions}
              decisionResult={decisionResult} setDecisionResult={setDecisionResult}
              isDecisionSpinning={isDecisionSpinning} setIsDecisionSpinning={setIsDecisionSpinning}
              currentDecisionSpin={currentDecisionSpin} setCurrentDecisionSpin={setCurrentDecisionSpin}
              theme={theme} setTheme={setTheme}
              classes={classes} students={students} attendance={attendance}
              onAddClass={handleAddClass} onDeleteClass={handleDeleteClass}
              onAddStudent={handleAddStudent} onDeleteStudent={handleDeleteStudent}
              onSetAttendance={handleSetAttendance} onAddStudentsBatch={handleAddStudentsBatch}
              onNewPage={handleNewPage}
            />
          }
           {view === 'journal' && <JournalView entries={journalEntries} onUpdate={handleUpdateJournalEntry} onDelete={handleDeleteJournalEntry} />}
           {view === 'documind' && <InteractiveMindMap />}
           {view === 'workspace' && <GoogleWorkspace authToken={authToken} setAuthToken={setAuthToken} history={workspaceHistory} onFileImport={handleFileImport} />}
           {view === 'portal' && <StudentTeacherPortal />}
      </div>
       <div className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isChatbotCollapsed ? 'w-16' : 'w-96'}`}>
           <Chatbot
                onAddTask={handleAddTask}
                onAddEvent={handleAddEvent}
                onNewPage={handleNewPage}
                onGetDailyBriefing={getDailyBriefing}
                onGenerateCreativeContent={handleGenerateCreativeContent}
                onCompleteTaskByText={handleCompleteTaskByText}
                onDeleteTaskByText={handleDeleteTaskByText}
                onListTasks={handleListTasks}
                onDeleteNoteByTitle={handleDeleteNoteByTitle}
                onMoveKanbanCard={handleMoveKanbanCard}
                onAddQuickNote={handleAddQuickNote}
                onListQuickNotes={handleListQuickNotes}
                onAddHabit={handleAddHabit}
                onCompleteHabit={handleCompleteHabit}
                onDeleteHabit={handleDeleteHabit}
                onListHabits={handleListHabits}
                onStartPomodoro={handleStartPomodoro}
                onPausePomodoro={handlePausePomodoro}
                onResetPomodoro={handleResetPomodoro}
                onAddDecisionOption={handleAddDecisionOption}
                onAddDecisionOptions={handleAddDecisionOptions}
                onClearDecisionOptions={handleClearDecisionOptions}
                onMakeDecision={handleMakeDecision}
                onPlanAndCreateNote={handlePlanAndCreateNote}
                onWireframeAndCreateNote={handleWireframeAndCreateNote}
                onAddJournalEntry={handleAddJournalEntry}
                onAddGoal={handleAddGoal}
                onLogMood={handleLogMood}
                onAddExpense={handleAddExpense}
                onAddPersonalQuote={handleAddPersonalQuote}
                isCollapsed={isChatbotCollapsed}
                setIsCollapsed={setIsChatbotCollapsed}
            />
       </div>
       <SearchPalette
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            pages={pages}
            onSelectPage={handleSelectPage}
       />
    </div>
  );
};


const App: React.FC = () => (
    <ToastProvider>
        <AppContent />
    </ToastProvider>
);

export default App;
export { useToast };