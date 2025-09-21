import React, { useState, useEffect, useMemo } from 'react';
import { PortalUser, CalendarEvent } from '../types';
import * as LocalPortal from './portal-db';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, Tag, Loader, UploadCloud } from 'lucide-react';
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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventType, setNewEventType] = useState<CalendarEvent['type']>('event');
    const toast = useToast();
    const { pdfjsLib, status: pdfJsStatus } = usePdfJs();

    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const formatDateToYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];

    const eventDates = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach(event => {
            const type = event.type || 'event';
            if (['holiday', 'exam', 'event', 'class_test', 'class'].includes(type)) {
                 if (!map.has(event.date)) {
                    map.set(event.date, []);
                }
                map.get(event.date)!.push(event);
            }
        });
        return map;
    }, [events]);

    const selectedDateString = formatDateToYYYYMMDD(selectedDate);
    const eventsForSelectedDate = eventDates.get(selectedDateString) || [];

    const handleAddEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventTitle.trim()) {
            toast.error("Event title cannot be empty.");
            return;
        }
        const newEvent: CalendarEvent = {
            id: crypto.randomUUID(),
            title: newEventTitle,
            date: selectedDateString,
            time: '00:00', // All-day
            type: newEventType,
        };
        setEvents(prev => [...prev, newEvent].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setNewEventTitle('');
        toast.success("Academic event added.");
    };

    const handleDeleteEvent = (id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
        toast.info("Event removed.");
    };

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

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
    
    const eventTypeStyles = {
        holiday: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500', dot: 'bg-red-500' },
        exam: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500', dot: 'bg-yellow-500' },
        event: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500', dot: 'bg-blue-500' },
        class_test: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500', dot: 'bg-purple-500' },
        class: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500', dot: 'bg-gray-500' },
    };

    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        
        const blanks = Array(firstDayOfMonth).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return [...blanks, ...days].map((day, index) => {
            if (!day) return <div key={`blank-${index}`} className="w-10 h-10"></div>;
            
            const dayDate = new Date(year, month, day);
            const dayString = formatDateToYYYYMMDD(dayDate);
            const isToday = dayString === formatDateToYYYYMMDD(today);
            const isSelected = dayString === selectedDateString;
            const eventsOnDay = eventDates.get(dayString);

            return (
                <button
                    key={day}
                    onClick={() => setSelectedDate(dayDate)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center relative transition-colors text-sm
                        ${isSelected ? 'bg-primary text-primary-foreground font-bold' : ''}
                        ${!isSelected && isToday ? 'bg-accent text-accent-foreground' : ''}
                        ${!isSelected && !isToday ? 'hover:bg-accent' : ''}
                    `}
                >
                    {day}
                    {eventsOnDay && (
                        <div className="absolute bottom-1.5 flex justify-center items-center gap-0.5 w-full">
                            {eventsOnDay.slice(0, 3).map(event => (
                                <div key={event.id} className={`w-1.5 h-1.5 rounded-full ${eventTypeStyles[event.type || 'event'].dot}`}></div>
                            ))}
                        </div>
                    )}
                </button>
            );
        });
    };

    if(loadingUser) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;
    if(!user) return <div className="text-center text-muted-foreground p-8">Please enter the portal as a teacher or student to view the academic calendar.</div>;

    const isImportDisabled = isProcessing || pdfJsStatus !== 'ready';
    const importButtonText = () => {
        if(isProcessing) return <><Loader size={16} className="animate-spin"/> Processing...</>;
        if(pdfJsStatus === 'loading') return <><Loader size={16} className="animate-spin"/> Loading PDF...</>;
        return <><UploadCloud size={16}/> Import with AI</>;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-fade-in-up">
            {isModalOpen && <ConfirmationModal events={extractedEvents} onConfirm={handleConfirmAddEvents} onCancel={() => setIsModalOpen(false)} />}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
                     <div className="flex items-center">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-md hover:bg-accent"><ChevronLeft className="w-5 h-5" /></button>
                        <h2 className="font-semibold text-lg w-40 text-center">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-md hover:bg-accent"><ChevronRight className="w-5 h-5" /></button>
                     </div>
                     {user.role === 'teacher' && (
                        <label className={`w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 flex items-center justify-center gap-2 ${isImportDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                           <input type="file" className="hidden" accept=".pdf" onChange={(e) => e.target.files && handleCalendarUpload(e.target.files[0])} disabled={isImportDisabled} />
                            {importButtonText()}
                        </label>
                     )}
                </div>
                <div className="grid grid-cols-7 gap-y-2 place-items-center text-sm text-muted-foreground mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="w-10 h-10 flex items-center justify-center">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-2 place-items-center">
                    {generateCalendar()}
                </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                <h3 className="font-bold text-lg mb-4">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {eventsForSelectedDate.length > 0 ? eventsForSelectedDate.map(event => (
                        <div key={event.id} className={`p-3 rounded-md flex justify-between items-start text-sm ${eventTypeStyles[event.type || 'event'].bg}`}>
                            <div>
                                <p className={`font-semibold ${eventTypeStyles[event.type || 'event'].color}`}>{event.title}</p>
                                <p className="text-xs capitalize text-muted-foreground">{(event.type || 'event').replace('_', ' ')}</p>
                            </div>
                            {user.role === 'teacher' && (
                                <button onClick={() => handleDeleteEvent(event.id)} className="text-destructive/70 hover:text-destructive flex-shrink-0 ml-2 mt-1"><Trash2 size={14}/></button>
                            )}
                        </div>
                    )) : <p className="text-sm text-muted-foreground text-center">No academic events on this day.</p>}
                </div>
                {user.role === 'teacher' && (
                    <form onSubmit={handleAddEvent} className="mt-auto pt-4 border-t border-border space-y-3">
                        <h4 className="text-base font-semibold">Add New Event</h4>
                        <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Event Title" className="w-full bg-input p-2 rounded-md text-sm" />
                        <div className="flex gap-2">
                            <select value={newEventType} onChange={e => setNewEventType(e.target.value as any)} className="w-full bg-input p-2 rounded-md text-sm">
                                <option value="event">General Event</option>
                                <option value="exam">Exam</option>
                                <option value="class_test">Class Test</option>
                                <option value="holiday">Holiday</option>
                            </select>
                            <button type="submit" className="p-2 bg-primary text-primary-foreground rounded-md"><Plus size={18}/></button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AcademicCalendar;