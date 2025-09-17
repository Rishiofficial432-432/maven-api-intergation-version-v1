



import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, X, Play, Pause, RotateCcw, Calendar, CheckSquare as CheckSquareIcon, List as ListIcon,
  Target, Sun, Moon, Save, Trash2,
  CheckSquare, Square, Timer, Heart,
  FileText as FileTextIcon, Home, BarChart3, User,
  Copy, Check,
  ChevronLeft, ChevronRight, Download, Upload, GripVertical,
  Trophy, Smile, Quote as QuoteIcon, DollarSign,
  BrainCircuit as BrainCircuitIcon, Wand2, Loader, ArrowLeft, CheckCircle, TrendingUp, Activity, Coffee
} from 'lucide-react';
import RandomDecisionMaker from './RandomDecisionMaker';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { useToast } from './Toast';
import { 
    Page, Task, KanbanState, QuickNote, CalendarEvent, Habit, Quote, MoodEntry, Expense, Goal, KanbanItem
} from '../types';


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
    
    const categoryInfo = {
        tasks: { title: "Tasks", icon: <CheckSquareIcon size={18} className="text-blue-400"/> },
        events: { title: "Calendar Events", icon: <Calendar size={18} className="text-red-400"/> },
        quickNotes: { title: "Quick Notes", icon: <ListIcon size={18} className="text-yellow-400"/> },
        newNotes: { title: "New Note Ideas", icon: <FileTextIcon size={18} className="text-green-400"/> },
    };

    const cardClasses = "bg-card border border-border rounded-xl shadow-lg";

    if (result && itemsToSave) {
        return (
            <div className={`${cardClasses} p-6 animate-fade-in-up`}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(itemsToSave).map(([category, items]) => {
                        if (items.length === 0) return null;
                        const info = categoryInfo[category as keyof typeof categoryInfo];
                        return (
                            <div key={category}>
                                <h3 className="font-semibold mb-2 flex items-center gap-2">{info.icon} {info.title}</h3>
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
        <div className={`${cardClasses} p-6 flex flex-col items-center justify-center text-center h-full animate-fade-in-up`}>
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
    onNewNote: (title: string, content?: string) => Page;
}

export const MamDesk: React.FC<MamDeskProps> = (props) => {
  const {
    activeTab, tasks, onAddTask, onToggleTask, onDeleteTask, kanbanColumns, setKanbanColumns, onAddKanbanCard,
    quickNotes, setQuickNotes, events, onAddEvent, habits, setHabits, personalQuotes, setPersonalQuotes, moodEntries,
    setMoodEntries, expenses, setExpenses, goals, setGoals, pomodoroTime, pomodoroActive, pomodoroSessions, onTogglePomodoro,
    onResetPomodoro, decisionOptions, setDecisionOptions, decisionResult, setDecisionResult, isDecisionSpinning,
    setIsDecisionSpinning, currentDecisionSpin, setCurrentDecisionSpin, theme, setTheme, pages, onNewNote
  } = props;

  const [newTask, setNewTask] = useState('');
  const [newKanbanTexts, setNewKanbanTexts] = useState({ todo: '', progress: '', done: '' });
  const [newNote, setNewNote] = useState('');
  const [draggedItem, setDraggedItem] = useState<{ colId: string; item: KanbanItem } | null>(null);

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
      const newSourceItems = kanbanColumns[sourceColId].items.filter(i => i.id !== item.id);
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

  const Dashboard = () => (
    <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6`}>
        <div className="lg:col-span-2 xl:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${cardClasses} p-4 text-center`}>
                <h3 className="text-2xl font-bold">{tasks.filter(t => !t.completed).length}</h3>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
            </div>
            <div className={`${cardClasses} p-4 text-center`}>
                 <h3 className="text-2xl font-bold">{events.filter(e => e.date === new Date().toISOString().slice(0, 10)).length}</h3>
                 <p className="text-sm text-muted-foreground">Events Today</p>
            </div>
            <div className={`${cardClasses} p-4 text-center`}>
                <h3 className="text-2xl font-bold">{pomodoroSessions}</h3>
                <p className="text-sm text-muted-foreground">Pomodoros</p>
            </div>
             <div className={`${cardClasses} p-4 text-center`}>
                <h3 className="text-2xl font-bold">{pages.length}</h3>
                <p className="text-sm text-muted-foreground">Notes</p>
            </div>
        </div>
    </div>
);

  const Tasks = () => (
    <div className={`${cardClasses}`}>
      <h2 className="text-xl font-bold mb-4 p-6 border-b border-border">Tasks</h2>
      <div className="p-6">
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
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
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
    </div>
  );

  const Kanban = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {Object.entries(kanbanColumns).map(([colId, col]) => (
        <div key={colId} className={`${cardClasses}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, colId)}>
          <h3 className="font-bold p-4 text-center border-b border-border">{col.name}</h3>
          <div className="space-y-3 min-h-[100px] max-h-96 overflow-y-auto p-4">
            {col.items.map(item => (
              <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, colId, item)} className="p-3 bg-secondary rounded-md cursor-grab active:cursor-grabbing flex items-center gap-2">
                <GripVertical size={16} className="text-muted-foreground" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => handleKanbanSubmit(e, colId)} className="flex gap-2 p-4 border-t border-border">
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
    return (
        <div className={`${cardClasses}`}>
            <h2 className="text-xl font-bold p-6 border-b border-border">Calendar - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
            <div className="space-y-2 p-6">
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
      <div className={`text-center ${cardClasses}`}>
          <h2 className="text-2xl font-bold mb-4 p-6 border-b border-border">Pomodoro Timer</h2>
          <div className="p-8">
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
      </div>
  );
  
  const QuickNotes = () => (
    <div className={`${cardClasses}`}>
        <h2 className="text-xl font-bold p-6 border-b border-border">Quick Notes</h2>
        <div className="p-6">
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
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {quickNotes.map(note => (
                    <div key={note.id} className="p-3 bg-secondary rounded-lg flex justify-between items-start">
                        <p className="flex-1 pr-2">{note.text}</p>
                        <button onClick={() => setQuickNotes(prev => prev.filter(n => n.id !== note.id))} className="text-muted-foreground hover:text-destructive"><X size={16}/></button>
                    </div>
                ))}
            </div>
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
                if (h.lastCompleted === todayStr) return h; 
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const isConsecutive = h.lastCompleted === yesterday.toDateString();
                return { ...h, streak: isConsecutive ? h.streak + 1 : 1, lastCompleted: todayStr };
            }
            return h;
        }));
    };

    return (
        <div className={`${cardClasses}`}>
            <h2 className="text-xl font-bold p-6 border-b border-border">Habit Tracker</h2>
            <div className="p-6">
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
                 <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
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
        </div>
    );
};
  
const Personal = () => {
    const [newGoal, setNewGoal] = useState('');
    const [newQuote, setNewQuote] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('General');
    const toast = useToast();

    const handleAddGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGoal.trim()) return;
        setGoals(prev => [...prev, { id: crypto.randomUUID(), text: newGoal, completed: false }]);
        setNewGoal('');
        toast.success("Goal added!");
    };

    const handleLogMood = (mood: string) => {
        const today = new Date().toISOString().split('T')[0];
        const newEntry = { id: crypto.randomUUID(), mood, date: today };
        setMoodEntries(prev => [...prev.filter(e => e.date !== today), newEntry]);
        toast.info(`Mood logged: ${mood}`);
    };

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(expenseAmount);
        if (!expenseDesc.trim() || isNaN(amount) || amount <= 0) {
            toast.error("Invalid expense details.");
            return;
        }
        const newExpense = { id: crypto.randomUUID(), description: expenseDesc, amount, category: expenseCategory, date: new Date().toISOString() };
        setExpenses(prev => [...prev, newExpense]);
        setExpenseDesc('');
        setExpenseAmount('');
        toast.success("Expense added!");
    };

    const handleAddQuote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuote.trim()) return;
        setPersonalQuotes(prev => [...prev, { id: crypto.randomUUID(), text: newQuote }]);
        setNewQuote('');
        toast.success("Quote saved!");
    };

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6`}>
            {/* Goals */}
            <div className={`${cardClasses} p-4 flex flex-col`}>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Trophy size={20}/> Goals</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 flex-grow">
                    {goals.map(g => <div key={g.id} className="p-2 bg-secondary rounded-md text-sm">{g.text}</div>)}
                </div>
                <form onSubmit={handleAddGoal} className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <input value={newGoal} onChange={e => setNewGoal(e.target.value)} placeholder="Add a new goal..." className="flex-1 bg-input p-2 rounded-md text-sm" />
                    <button type="submit" className="bg-primary text-primary-foreground px-3 rounded-md"><Plus size={16}/></button>
                </form>
            </div>

            {/* Mood Tracker */}
            <div className={`${cardClasses} p-4`}>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Smile size={20}/> Mood Tracker</h3>
                <p className="text-sm text-muted-foreground mb-4">How are you feeling today?</p>
                <div className="flex justify-around mb-4">
                    {['😄', '😊', '😐', '😢', '😴'].map(mood => (
                        <button key={mood} onClick={() => handleLogMood(mood)} className="text-3xl hover:scale-125 transition-transform">{mood}</button>
                    ))}
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-2 text-sm">
                    {[...moodEntries].reverse().slice(0, 3).map(m => <div key={m.id} className="p-1.5 bg-secondary rounded-md">{m.date}: {m.mood}</div>)}
                </div>
            </div>

            {/* Expenses */}
            <div className={`md:col-span-2 ${cardClasses} p-4 flex flex-col`}>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><DollarSign size={20}/> Recent Expenses</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-2 flex-grow">
                    {expenses.map(e => <div key={e.id} className="p-2 bg-secondary rounded-md flex justify-between text-sm"><span>{e.description} ({e.category})</span> <span className="font-semibold">${e.amount.toFixed(2)}</span></div>)}
                </div>
                <form onSubmit={handleAddExpense} className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                    <input value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Description" className="col-span-3 bg-input p-2 rounded-md text-sm" />
                    <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount" className="bg-input p-2 rounded-md text-sm" />
                    <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="bg-input p-2 rounded-md text-sm">
                        <option>General</option><option>Food</option><option>Transport</option><option>Bills</option><option>Fun</option>
                    </select>
                    <button type="submit" className="bg-primary text-primary-foreground px-3 rounded-md">Add</button>
                </form>
            </div>

            {/* Quotes */}
            <div className={`md:col-span-2 ${cardClasses} p-4 flex flex-col`}>
                 <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><QuoteIcon size={20}/> Personal Quotes</h3>
                 <div className="space-y-2 max-h-40 overflow-y-auto pr-2 italic flex-grow">
                    {personalQuotes.map(q => <blockquote key={q.id} className="p-2 bg-secondary rounded-md border-l-4 border-primary text-sm">"{q.text}"</blockquote>)}
                </div>
                <form onSubmit={handleAddQuote} className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <input value={newQuote} onChange={e => setNewQuote(e.target.value)} placeholder="Add an inspiring quote..." className="flex-1 bg-input p-2 rounded-md text-sm" />
                    <button type="submit" className="bg-primary text-primary-foreground px-3 rounded-md"><Plus size={16}/></button>
                </form>
            </div>
        </div>
    );
  };
  
const Analytics = () => {
    // Data processing
    const completedTasks = tasks.filter(t => t.completed).length;
    const pendingTasks = tasks.length - completedTasks;
    const taskCompletionPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    
    // Productivity Score
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const tasksCompletedLastWeek = tasks.filter(t => t.completed && new Date(t.createdAt) > last7Days).length;
    const habitsCompletedLastWeek = habits.reduce((sum, h) => sum + (h.history?.filter(day => new Date(day.date) > last7Days && day.completed).length || 0), 0);
    const productivityScore = Math.min(100, Math.round((tasksCompletedLastWeek * 5 + habitsCompletedLastWeek * 2.5) / 2));


    const expenseByCategory = expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
    }, {} as Record<string, number>);
    const maxExpense = Math.max(...Object.values(expenseByCategory), 0);

    const DonutChart = ({ percentage, size = 100, strokeWidth = 10 }: { percentage: number, size?: number, strokeWidth?: number }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle className="text-secondary" stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size/2} cy={size/2} />
                <circle className="text-primary" stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size/2} cy={size/2}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    transform={`rotate(-90 ${size/2} ${size/2})`}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                />
                <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="text-xl font-bold fill-current text-foreground">
                    {percentage}%
                </text>
            </svg>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`lg:col-span-2 ${cardClasses} p-6 flex flex-col items-center justify-center text-center`}>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><TrendingUp size={20}/> 7-Day Productivity Score</h3>
                <p className="text-7xl font-bold text-primary">{productivityScore}</p>
                <p className="text-sm text-muted-foreground mt-1">Based on tasks and habits</p>
            </div>
            <div className={`${cardClasses} p-6 flex flex-col items-center justify-center`}>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><CheckSquare size={20}/> Task Overview</h3>
                <DonutChart percentage={taskCompletionPercent} />
                 <p className="text-sm text-muted-foreground mt-2">{completedTasks} completed / {pendingTasks} pending</p>
            </div>
             <div className={`${cardClasses} p-6 flex flex-col items-center justify-center text-center`}>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Coffee size={20}/> Pomodoro Focus</h3>
                <p className="text-6xl font-bold text-primary">{pomodoroSessions}</p>
                <p className="text-sm text-muted-foreground mt-1">Completed Sessions</p>
            </div>
             <div className={`lg:col-span-2 ${cardClasses} p-6`}>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Activity size={20}/> Habit Consistency</h3>
                <div className="space-y-3">
                    {habits.map(habit => (
                        <div key={habit.id}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-semibold">{habit.name}</span>
                                <span className="text-muted-foreground">{habit.streak} day streak</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2.5">
                                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min(100, (habit.streak / 30) * 100)}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             <div className={`lg:col-span-2 ${cardClasses} p-6`}>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><DollarSign size={20}/> Financial Snapshot</h3>
                 <div className="space-y-3">
                    {Object.entries(expenseByCategory).map(([category, amount]) => (
                        <div key={category}>
                             <div className="flex justify-between text-sm mb-1">
                                <span className="font-semibold">{category}</span>
                                <span className="text-muted-foreground">${amount.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-4">
                                <div className="bg-primary h-4 rounded-full" style={{ width: `${(amount / maxExpense) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'braindump': return <AIBrainDump onAddTask={onAddTask} onAddEvent={onAddEvent} onAddQuickNote={handleAddQuickNote} onNewNote={onNewNote} />;
      case 'tasks': return <Tasks />;
      case 'kanban': return <Kanban />;
      case 'calendar': return <CalendarComponent />;
      case 'timer': return <Pomodoro />;
      case 'decision': return <RandomDecisionMaker options={decisionOptions} setOptions={setDecisionOptions} result={decisionResult} setResult={setDecisionResult} isSpinning={isDecisionSpinning} setIsSpinning={setIsDecisionSpinning} currentSpin={currentDecisionSpin} setCurrentSpin={setCurrentDecisionSpin} />;
      case 'notes': return <QuickNotes />;
      case 'habits': return <HabitTracker />;
      case 'analytics': return <Analytics />;
      case 'personal': return <Personal />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
    </div>
  );
};