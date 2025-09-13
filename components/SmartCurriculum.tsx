import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Wand2, Loader, BookCopy, CalendarDays, Plus } from 'lucide-react';
import { geminiAI } from './gemini';
import { useToast } from './Toast';

interface CurriculumViewProps {
    events: CalendarEvent[];
    onAddCalendarItem: (item: Omit<CalendarEvent, 'id'>) => void;
}

const formatDateToYYYYMMDD = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const AcademicCalendar: React.FC<CurriculumViewProps> = ({ events, onAddCalendarItem }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'event' | 'exam' | 'holiday'>('event');

    const eventsByDate = useMemo(() => {
        return events.reduce((acc, event) => {
            (acc[event.date] = acc[event.date] || []).push(event);
            return acc;
        }, {} as Record<string, CalendarEvent[]>);
    }, [events]);

    const handleAddEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !selectedDate) return;
        onAddCalendarItem({ title, date: formatDateToYYYYMMDD(selectedDate), time: '00:00', type });
        setTitle('');
    };
    
    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const blanks = Array(firstDayOfMonth).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return [...blanks, ...days].map((day, index) => {
            if (!day) return <div key={`blank-${index}`} className="border border-border/50 h-24"></div>;
            
            const dayDate = new Date(year, month, day);
            const dayString = formatDateToYYYYMMDD(dayDate);
            const dayEvents = eventsByDate[dayString] || [];

            return (
                <div key={day} onClick={() => setSelectedDate(dayDate)} className={`p-2 border border-border/50 h-24 flex flex-col cursor-pointer ${selectedDate && formatDateToYYYYMMDD(selectedDate) === dayString ? 'bg-primary/10' : 'hover:bg-accent/50'}`}>
                    <span className="font-semibold">{day}</span>
                    <div className="text-xs space-y-1 mt-1 overflow-y-auto">
                        {dayEvents.map(e => <div key={e.id} className="p-1 rounded bg-secondary truncate">{e.title}</div>)}
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                 <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-md hover:bg-accent"><ChevronLeft/></button>
                    <h3 className="text-xl font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-md hover:bg-accent"><ChevronRight/></button>
                </div>
                <div className="grid grid-cols-7 text-center font-semibold text-muted-foreground border-t border-l border-border/50"><div className="py-2 border-r border-b border-border/50">Sun</div><div className="py-2 border-r border-b border-border/50">Mon</div><div className="py-2 border-r border-b border-border/50">Tue</div><div className="py-2 border-r border-b border-border/50">Wed</div><div className="py-2 border-r border-b border-border/50">Thu</div><div className="py-2 border-r border-b border-border/50">Fri</div><div className="py-2 border-b border-border/50">Sat</div></div>
                <div className="grid grid-cols-7 border-l border-b border-border/50">{generateCalendar()}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4">Add to Calendar</h3>
                {selectedDate ? <>
                    <p className="text-muted-foreground mb-4">Adding event for: <span className="text-primary font-semibold">{selectedDate.toLocaleDateString()}</span></p>
                    <form onSubmit={handleAddEvent} className="space-y-4">
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event Title" className="w-full bg-input p-2 rounded-md"/>
                        <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-input p-2 rounded-md"><option value="event">Event</option><option value="exam">Exam</option><option value="holiday">Holiday</option></select>
                        <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md font-semibold flex items-center justify-center gap-2"><Plus/> Add Event</button>
                    </form>
                </> : <p className="text-muted-foreground">Select a date on the calendar to add an event.</p>}
            </div>
        </div>
    );
};

const AISyllabusSequencer: React.FC = () => {
    const [syllabusText, setSyllabusText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sequence, setSequence] = useState('');
    const toast = useToast();

    const handleGenerate = async () => {
        if (!syllabusText.trim()) {
            toast.error("Please paste the syllabus content first.");
            return;
        }
        if (!geminiAI) {
            toast.error("AI features are disabled. Please configure API key in settings.");
            return;
        }
        setIsLoading(true);
        setSequence('');
        
        const prompt = `
You are an expert instructional designer. Your task is to analyze the following course syllabus and recommend the optimal learning sequence for the topics listed.
Consider pedagogical principles like scaffolding (building from simpler to more complex concepts) and identifying foundational topics that must be mastered first.
Present the output as a numbered list with a brief justification for the placement of each major topic or unit.

Syllabus Content:
---
${syllabusText}
---
`;
        try {
            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setSequence(response.text);
            toast.success("Optimal learning sequence generated!");
        } catch (error: any) {
            toast.error(`AI generation failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                <h3 className="text-xl font-bold mb-4">Syllabus Input</h3>
                <textarea
                    value={syllabusText}
                    onChange={e => setSyllabusText(e.target.value)}
                    placeholder="Paste your course syllabus here..."
                    className="w-full flex-1 bg-input p-3 rounded-md resize-none"
                />
                <button onClick={handleGenerate} disabled={isLoading} className="mt-4 w-full bg-primary text-primary-foreground py-2 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {isLoading ? <Loader className="animate-spin"/> : <Wand2/>} Suggest Learning Sequence
                </button>
            </div>
             <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4">AI Recommended Sequence</h3>
                <div className="overflow-y-auto h-[calc(100vh-270px)]">
                    {isLoading ? <div className="flex items-center justify-center h-full"><Loader className="animate-spin"/></div> : sequence ? <pre className="whitespace-pre-wrap font-sans text-foreground/90">{sequence}</pre> : <div className="text-muted-foreground text-center pt-10">The suggested learning path will appear here.</div>}
                </div>
            </div>
        </div>
    );
};


const CurriculumView: React.FC<CurriculumViewProps> = (props) => {
    const [activeView, setActiveView] = useState<'calendar' | 'sequencer'>('calendar');

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-center p-2">
                 <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg">
                    <button onClick={() => setActiveView('calendar')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${activeView === 'calendar' ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-accent'}`}><CalendarDays size={16}/> Academic Calendar</button>
                    <button onClick={() => setActiveView('sequencer')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${activeView === 'sequencer' ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-accent'}`}><BookCopy size={16}/> AI Syllabus Sequencer</button>
                </div>
            </div>
            <div className="flex-grow mt-4">
                {activeView === 'calendar' ? <AcademicCalendar {...props} /> : <AISyllabusSequencer />}
            </div>
        </div>
    );
};

export default CurriculumView;