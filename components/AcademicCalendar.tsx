import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PortalUser, CalendarEvent } from '../types';
import * as LocalPortal from './portal-db';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, Tag, Loader, UploadCloud, X, List, Grid } from 'lucide-react';
import { useToast } from './Toast';
import { usePdfJs } from './usePdfJs';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';

const useDemoUser = (): [PortalUser | null, boolean] => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            try {
                const demoRole = sessionStorage.getItem('demo-role');
                if (demoRole === 'teacher' || demoRole === 'student') {
                    const demoUser = await LocalPortal.getDemoUser(demoRole);
                    setUser(demoUser);
                } else {
                    setUser(null);
                }
            } catch (e) { console.error(e); setUser(null); }
            finally { setLoading(false); }
        };
        fetchUser();
    }, []);
    return [user, loading];
};

interface ExtractedEvent {
    title: string;
    date: string; // YYYY-MM-DD
    type: 'holiday' | 'exam' | 'event' | 'class_test';
}

const ConfirmationModal: React.FC<{ events: ExtractedEvent[], onConfirm: () => void, onCancel: () => void }> = ({ events, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up">
            <h2 className="text-xl font-bold">Confirm Imported Events</h2>
            <p className="text-muted-foreground text-sm mt-1 mb-4">The AI found the following events in the document. Review and confirm to add them to the calendar.</p>
            <div className="max-h-80 overflow-y-auto space-y-2 border-y border-border py-2 my-2">
                {events.map((event, index) => (
                    <div key={index} className="p-2 bg-secondary rounded-md text-sm">
                        <p className="font-semibold">{event.title}</p>
                        <p className="text-muted-foreground">{event.date} ({event.type.replace('_', ' ')})</p>
                    </div>
                ))}
            </div>
            <div className="flex gap-4 mt-6">
                <button onClick={onCancel} className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md">Cancel</button>
                <button onClick={onConfirm} className="flex-1 bg-primary text-primary-foreground py-2 rounded-md">Confirm & Add Events</button>
            </div>
        </div>
    </div>
);


interface AcademicCalendarProps {
    events: CalendarEvent[];
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

const AcademicCalendar: React.FC<AcademicCalendarProps> = ({ events, setEvents }) => {
    const [user, loadingUser] = useDemoUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
    
    // Popover state
    const [popoverState, setPopoverState] = useState<{ visible: boolean; date: Date | null; target: HTMLElement | null }>({ visible: false, date: null, target: null });
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventType, setNewEventType] = useState<CalendarEvent['type']>('event');
    
    const toast = useToast();
    const { pdfjsLib, status: pdfJsStatus } = usePdfJs();
    const popoverRef = useRef<HTMLDivElement>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- Popover and Event Logic ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && popoverState.target && !popoverState.target.contains(event.target as Node)) {
                setPopoverState({ visible: false, date: null, target: null });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [popoverState.target]);

    const handleDayClick = (dayDate: Date, target: HTMLElement) => {
        setPopoverState({ visible: true, date: dayDate, target });
        setNewEventTitle(''); // Reset form
        setNewEventType('event');
    };
    
    const formatDateToYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];

    const academicEvents = useMemo(() => {
        return events
            .filter(event => ['holiday', 'exam', 'event', 'class_test', 'class'].includes(event.type || 'event'))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [events]);

    const eventDates = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        academicEvents.forEach(event => {
            if (!map.has(event.date)) {
                map.set(event.date, []);
            }
            map.get(event.date)!.push(event);
        });
        return map;
    }, [academicEvents]);

    const handleAddEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventTitle.trim() || !popoverState.date) {
            toast.error("Event title cannot be empty.");
            return;
        }
        const newEvent: CalendarEvent = {
            id: crypto.randomUUID(),
            title: newEventTitle,
            date: formatDateToYYYYMMDD(popoverState.date),
            time: '00:00', // All-day
            type: newEventType,
        };
        setEvents(prev => [...prev, newEvent]);
        setNewEventTitle('');
        toast.success("Academic event added.");
    };

    const handleDeleteEvent = (id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
        toast.info("Event removed.");
    };

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
        setPopoverState({ visible: false, date: null, target: null });
    };

    const eventTypeStyles = {
        holiday: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500', dot: 'bg-red-500' },
        exam: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500', dot: 'bg-yellow-500' },
        event: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500', dot: 'bg-blue-500' },
        class_test: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500', dot: 'bg-purple-500' },
        class: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500', dot: 'bg-gray-500' },
    };

    // --- PDF Import Logic ---
    const handleCalendarUpload = async (file: File) => {
        if (file.type !== 'application/pdf') { toast.error("Please upload a PDF file."); return; }
        if (pdfJsStatus !== 'ready' || !pdfjsLib) { toast.error("PDF library is still loading. Please try again."); return; }

        setIsProcessing(true);
        toast.info("Extracting text and analyzing with AI...");

        try {
            const typedArray = new Uint8Array(await file.arrayBuffer());
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map((item: any) => item.str).join(' ');
            }
            if (!fullText.trim()) throw new Error("Could not extract any text from the PDF.");
            if (!geminiAI) throw new Error("AI features are disabled. Please configure your API key.");

            const prompt = `You are an expert data extraction system. Analyze the following text extracted from an academic calendar and identify all events. For each event, determine its title, exact date (in YYYY-MM-DD format), and type. The types must be one of: 'holiday', 'exam', 'class_test', or 'event' (for all other activities like workshops, parent meets, etc.).
            Calendar Text: --- ${fullText} ---
            Return your response as a single JSON object with a single key "events", which is an array of event objects.`;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    events: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                date: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ['holiday', 'exam', 'class_test', 'event'] }
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
            
            const parsedResult = JSON.parse(response.text.trim());
            if (parsedResult.events && parsedResult.events.length > 0) {
                setExtractedEvents(parsedResult.events);
                setIsModalOpen(true);
            } else {
                toast.error("AI could not find any valid events in the document.");
            }

        } catch (error: any) {
            console.error("Calendar Import Error:", error);
            toast.error(`Import failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmAddEvents = () => {
        const newEvents: CalendarEvent[] = extractedEvents.map(e => ({
            id: crypto.randomUUID(),
            title: e.title,
            date: e.date,
            time: '00:00', // All day
            type: e.type,
        }));

        setEvents(prev => {
            const academicEventTypes: CalendarEvent['type'][] = ['holiday', 'exam', 'event', 'class_test'];
            const nonAcademicEvents = prev.filter(e => !academicEventTypes.includes(e.type));
            return [...nonAcademicEvents, ...newEvents].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });
        
        toast.success(`${newEvents.length} events imported successfully!`);
        setIsModalOpen(false);
        setExtractedEvents([]);
    };

    // --- RENDER LOGIC ---
    if(loadingUser) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;
    if(!user) return <div className="text-center text-muted-foreground p-8">Please enter the portal as a teacher or student to view the academic calendar.</div>;

    const isImportDisabled = isProcessing || pdfJsStatus !== 'ready';
    const importButtonText = () => {
        if(isProcessing) return <><Loader size={16} className="animate-spin"/> Processing...</>;
        if(pdfJsStatus === 'loading') return <><Loader size={16} className="animate-spin"/> Loading PDF...</>;
        return <><UploadCloud size={16}/> Import with AI</>;
    };

    const PopoverContent: React.FC = () => {
        if (!popoverState.visible || !popoverState.date || !popoverState.target) return null;

        const popoverRect = popoverState.target.getBoundingClientRect();
        const containerRect = popoverState.target.closest('.lg\\:col-span-2')?.getBoundingClientRect();
        if (!containerRect) return null;

        const style = {
            top: `${popoverRect.top - containerRect.top + popoverRect.height / 2}px`,
            left: `${popoverRect.left - containerRect.left + popoverRect.width + 10}px`,
        };

        const eventsForDay = eventDates.get(formatDateToYYYYMMDD(popoverState.date)) || [];
        
        return (
            <div ref={popoverRef} style={style} className="absolute z-10 w-72 bg-popover border border-border rounded-xl shadow-lg p-4 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-base">{popoverState.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                    <button onClick={() => setPopoverState({ visible: false, date: null, target: null })} className="p-1 hover:bg-accent rounded-md"><X size={16}/></button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 mb-4">
                    {eventsForDay.length > 0 ? eventsForDay.map(event => (
                        <div key={event.id} className={`p-2 rounded-md flex justify-between items-start text-sm ${eventTypeStyles[event.type || 'event'].bg}`}>
                            <div><p className={`font-semibold ${eventTypeStyles[event.type || 'event'].color}`}>{event.title}</p></div>
                            {user.role === 'teacher' && <button onClick={() => handleDeleteEvent(event.id)} className="text-destructive/70 hover:text-destructive flex-shrink-0 ml-2 mt-0.5"><Trash2 size={12}/></button>}
                        </div>
                    )) : <p className="text-sm text-muted-foreground text-center py-2">No academic events.</p>}
                </div>
                {user.role === 'teacher' && (
                    <form onSubmit={handleAddEvent} className="mt-auto pt-4 border-t border-border space-y-2">
                        <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Add Event Title" className="w-full bg-input p-2 rounded-md text-sm" />
                        <div className="flex gap-2"><select value={newEventType} onChange={e => setNewEventType(e.target.value as any)} className="w-full bg-input p-2 rounded-md text-sm"><option value="event">Event</option><option value="exam">Exam</option><option value="class_test">Class Test</option><option value="holiday">Holiday</option></select><button type="submit" className="p-2 bg-primary text-primary-foreground rounded-md"><Plus size={18}/></button></div>
                    </form>
                )}
            </div>
        );
    };
    
    const AgendaView: React.FC = () => (
        <div className="space-y-4 pr-2">
            {academicEvents.length > 0 ? academicEvents.map(event => (
                <div key={event.id} className={`p-3 rounded-md flex items-center gap-4 text-sm border-l-4 ${eventTypeStyles[event.type || 'event'].border} ${eventTypeStyles[event.type || 'event'].bg}`}>
                    <div className="font-semibold w-24 text-center">{new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="flex-1"><p className={`font-semibold ${eventTypeStyles[event.type || 'event'].color}`}>{event.title}</p><p className="text-xs capitalize text-muted-foreground">{(event.type || 'event').replace('_', ' ')}</p></div>
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-8">No academic events found.</p>}
        </div>
    );
    
    const MonthView: React.FC = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const blanks = Array(firstDayOfMonth).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
            <>
                <div className="grid grid-cols-7 gap-1 text-sm text-center font-semibold text-muted-foreground mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="p-2">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {blanks.map((_, index) => <div key={`blank-${index}`} className="h-24"></div>)}
                    {days.map((day) => {
                        const dayDate = new Date(year, month, day);
                        const dayString = formatDateToYYYYMMDD(dayDate);
                        const isToday = dayString === formatDateToYYYYMMDD(new Date());
                        const eventsOnDay = eventDates.get(dayString) || [];
                        return (
                            <button key={day} onClick={(e) => handleDayClick(dayDate, e.currentTarget)}
                                className={`h-24 p-2 border border-border/50 rounded-lg text-left align-top transition-colors relative overflow-hidden ${isToday ? 'bg-accent' : 'bg-card hover:bg-secondary'}`}>
                                <span className="font-semibold text-sm">{day}</span>
                                <div className="space-y-1 mt-1 text-xs">
                                    {eventsOnDay.slice(0, 2).map(event => (
                                        <div key={event.id} className={`flex items-center gap-1.5 truncate ${eventTypeStyles[event.type || 'event'].color}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${eventTypeStyles[event.type || 'event'].dot} flex-shrink-0`}></div>
                                            <span className="truncate">{event.title}</span>
                                        </div>
                                    ))}
                                    {eventsOnDay.length > 2 && (
                                        <div className="text-muted-foreground text-xs font-semibold pl-3">+{eventsOnDay.length - 2} more</div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </>
        );
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col animate-fade-in-up">
            {isModalOpen && <ConfirmationModal events={extractedEvents} onConfirm={handleConfirmAddEvents} onCancel={() => setIsModalOpen(false)} />}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
                 <div className="flex items-center">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-md hover:bg-accent"><ChevronLeft className="w-5 h-5" /></button>
                    <h2 className="font-semibold text-lg w-40 text-center">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-md hover:bg-accent"><ChevronRight className="w-5 h-5" /></button>
                 </div>
                 <div className="flex items-center gap-4">
                     {user.role === 'teacher' && (
                        <label className={`px-4 py-2 bg-primary/20 text-primary rounded-lg font-semibold text-sm hover:bg-primary/30 flex items-center justify-center gap-2 ${isImportDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                           <input type="file" className="hidden" accept=".pdf" onChange={(e) => e.target.files && handleCalendarUpload(e.target.files[0])} disabled={isImportDisabled} />
                            {importButtonText()}
                        </label>
                     )}
                     <div className="bg-secondary p-1 rounded-md flex items-center">
                        <button onClick={() => setViewMode('month')} className={`px-2 py-1 rounded ${viewMode==='month' ? 'bg-card shadow-sm' : ''}`}><Grid size={16}/></button>
                        <button onClick={() => setViewMode('agenda')} className={`px-2 py-1 rounded ${viewMode==='agenda' ? 'bg-card shadow-sm' : ''}`}><List size={16}/></button>
                     </div>
                 </div>
            </div>
            <div className="flex-1 overflow-y-auto relative lg:col-span-2">
                {viewMode === 'month' ? <MonthView /> : <AgendaView />}
                <PopoverContent />
            </div>
        </div>
    );
};

export default AcademicCalendar;