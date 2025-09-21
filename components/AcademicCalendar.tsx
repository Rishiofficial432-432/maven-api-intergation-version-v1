import React, { useState, useEffect, useMemo } from 'react';
import { PortalUser, CalendarEvent } from '../types';
import * as LocalPortal from './portal-db';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, Tag, Loader } from 'lucide-react';
import { useToast } from './Toast';

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


interface AcademicCalendarProps {
    events: CalendarEvent[];
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

const AcademicCalendar: React.FC<AcademicCalendarProps> = ({ events, setEvents }) => {
    const [user, loadingUser] = useDemoUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventType, setNewEventType] = useState<'holiday' | 'exam' | 'event'>('event');
    const toast = useToast();

    const formatDateToYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];

    const eventDates = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach(event => {
            if (event.type === 'holiday' || event.type === 'exam' || event.type === 'event') {
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
    
    const eventTypeStyles = {
        holiday: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500', dot: 'bg-red-500' },
        exam: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500', dot: 'bg-yellow-500' },
        event: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500', dot: 'bg-blue-500' },
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-fade-in-up">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-md hover:bg-accent"><ChevronLeft className="w-5 h-5" /></button>
                    <h2 className="font-semibold text-lg">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-md hover:bg-accent"><ChevronRight className="w-5 h-5" /></button>
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
                                <p className="text-xs capitalize text-muted-foreground">{event.type}</p>
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
