import React, { useState, useEffect } from 'react';
// FIX: Changed import to a named import as StudentTeacherPortal is not a default export.
import { StudentTeacherPortal } from './StudentTeacherPortal';
import { Goal, CalendarEvent, Page, GeneratedCurriculum } from '../types';
import { geminiAI } from './gemini';
import { useToast } from './Toast';
import { GraduationCap, BarChart2, CalendarCheck, ClipboardList, Loader, Wand2, Info, Clock, Lightbulb, CheckSquare, Calendar, Save } from 'lucide-react';
import Scheduler from './Scheduler';
import CurriculumView from './SmartCurriculum';
import TestsView from './TestsView';
import ProgressView from './ProgressView';
import AcademicCalendar from './AcademicCalendar';
import SimulatedProgressBar from './SimulatedProgressBar';
import usePersistentState from './usePersistentState';

type AcademicViewTab = 'portal' | 'routine' | 'scheduler' | 'curriculum' | 'tests' | 'progress' | 'calendar';

interface AcademicViewProps {
    goals: Goal[];
    events: CalendarEvent[];
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
    onNewNote: (title: string, content?: string) => Page;
    curriculumResult: GeneratedCurriculum | null;
    isCurriculumGenerating: boolean;
    onGenerateCurriculum: (file: File, indexText: string) => Promise<void>;
    onClearCurriculum: () => void;
}

// Daily Routine Planner Component
const DailyRoutineGenerator: React.FC<{
    goals: Goal[];
    events: CalendarEvent[];
    routine: string;
    setRoutine: (routine: string) => void;
    onNewNote: (title: string, content?: string) => Page;
}> = ({ goals, events, routine, setRoutine, onNewNote }) => {
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    const generateRoutine = async () => {
        if (!geminiAI) {
            toast.error("AI features are disabled. Please configure your API key in settings.");
            return;
        }
        setIsLoading(true);
        setRoutine('');
        
        const today = new Date().toISOString().split('T')[0];
        const todayEvents = events.filter(e => e.date === today).map(e => `- ${e.time}: ${e.title}`).join('\n');
        const userGoals = goals.filter(g => !g.completed).map(g => `- ${g.text}`).join('\n');

        const prompt = `
You are an expert student productivity coach. Your task is to generate a personalized daily routine for a student.

Today's Date: ${today}

Here are the student's fixed appointments/classes for today:
${todayEvents || "No scheduled events today."}

Here are the student's long-term goals:
${userGoals || "No long-term goals set."}

Based on this information, create a productive daily schedule. Identify the free periods between the fixed appointments and suggest specific, actionable tasks that align with the student's long-term goals. Structure the output as a simple, clear timeline. Make the suggestions encouraging and motivational.

Crucial Instruction: The output MUST be plain text only. Do not use any markdown formatting.
- Do NOT use '#' for headers.
- Do NOT use '**' for bold text.
- Do NOT use '*' for list items. Use a simple dash '-' instead for lists.
- Do NOT use any other markdown. The entire response should be readable as plain text without any rendering.
`;

        try {
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const generatedText = response.text;
            if (!generatedText) throw new Error("AI returned an empty response.");
            setRoutine(generatedText);
        } catch (error) {
            console.error("Routine generation failed:", error);
            toast.error("Failed to generate routine. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveToNotes = () => {
        if (!routine) {
            toast.error("No routine to save.");
            return;
        }
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
        const title = `Daily Routine for ${today}`;
        const content = `<pre><code>${routine}</code></pre>`;
        onNewNote(title, content);
        toast.success("Routine saved to your notes!");
    };


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            <div className="md:col-span-1 bg-card border border-border rounded-xl p-6 flex flex-col">
                <h3 className="text-xl font-bold mb-4">Your Inputs</h3>
                <div className="space-y-4 overflow-y-auto">
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-2">Today's Schedule</h4>
                        {events.filter(e => e.date === new Date().toISOString().split('T')[0]).length > 0 ? (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                {events.filter(e => e.date === new Date().toISOString().split('T')[0]).map(e => <li key={e.id}>{e.time} - {e.title}</li>)}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">No events scheduled for today.</p>}
                    </div>
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-2">Your Goals</h4>
                        {goals.filter(g => !g.completed).length > 0 ? (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                {goals.filter(g => !g.completed).map(g => <li key={g.id}>{g.text}</li>)}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">No active goals set.</p>}
                    </div>
                </div>
                <button
                    onClick={generateRoutine}
                    disabled={isLoading}
                    className="mt-auto w-full bg-primary text-primary-foreground py-2 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isLoading ? <Loader className="animate-spin" /> : <Wand2 size={16}/>}
                    Generate Today's Routine
                </button>
            </div>
            <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 relative">
                <h3 className="text-xl font-bold mb-4">AI-Generated Daily Plan</h3>
                 {routine && !isLoading && (
                    <button 
                        onClick={handleSaveToNotes} 
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 active:scale-95 transition-transform"
                    >
                        <Save size={14}/> Save to Notes
                    </button>
                )}
                <div className="overflow-y-auto h-[calc(100vh-250px)]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                            <Clock size={48} className="text-primary mb-4 animate-pulse" />
                            <h2 className="text-2xl font-bold">Planning Your Day...</h2>
                            <p className="text-muted-foreground mt-2 mb-6 max-w-md">The AI is analyzing your schedule and goals to create an optimal routine.</p>
                            <div className="w-full max-w-sm">
                                <SimulatedProgressBar isProcessing={isLoading} />
                            </div>
                        </div>
                    ) : routine ? (
                        <pre className="whitespace-pre-wrap text-foreground/90 font-sans leading-relaxed">{routine}</pre>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <Info size={32} className="mb-4" />
                            <p>Click "Generate Today's Routine" to get a personalized plan that combines your schedule and goals.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// Main AcademicView Component
const AcademicView: React.FC<AcademicViewProps> = (props) => {
    const { events, setEvents, goals, onNewNote, curriculumResult, isCurriculumGenerating, onGenerateCurriculum, onClearCurriculum } = props;
    const [activeTab, setActiveTab] = useState<AcademicViewTab>('portal');
    const [generatedRoutine, setGeneratedRoutine] = usePersistentState<string>('maven-academic-routine', '');

    const navItems = [
        { id: 'portal', label: 'Portal', icon: ClipboardList },
        { id: 'routine', label: 'Daily Plan', icon: CalendarCheck },
        { id: 'scheduler', label: 'Scheduler', icon: Clock },
        { id: 'curriculum', label: 'Curriculum', icon: Lightbulb },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'tests', label: 'Tests', icon: CheckSquare },
        { id: 'progress', label: 'Progress', icon: BarChart2 },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'portal':
                return <StudentTeacherPortal />;
            case 'routine':
                return <DailyRoutineGenerator goals={goals} events={events} routine={generatedRoutine} setRoutine={setGeneratedRoutine} onNewNote={onNewNote} />;
            case 'scheduler':
                return <Scheduler />;
            case 'curriculum':
                return <CurriculumView 
                            curriculum={curriculumResult}
                            isGenerating={isCurriculumGenerating}
                            onGenerate={onGenerateCurriculum}
                            onClear={onClearCurriculum}
                        />;
            case 'tests':
                return <TestsView />;
            case 'calendar':
                return <AcademicCalendar events={events} setEvents={setEvents} />;
            case 'progress':
                return <ProgressView />;
            default:
                return <StudentTeacherPortal />;
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20">
            <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2">
                     <h1 className="text-2xl font-bold flex items-center gap-3"><GraduationCap /> Academics Hub</h1>
                     <nav className="flex items-center gap-1 sm:gap-2 bg-secondary p-1.5 rounded-lg w-full sm:w-auto">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as AcademicViewTab)}
                                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === item.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <item.icon size={16} />
                                <span className="hidden md:inline">{item.label}</span>
                                <span className="md:hidden">{item.id === 'routine' ? 'Plan' : item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                {renderContent()}
            </main>
        </div>
    );
};

export default AcademicView;
