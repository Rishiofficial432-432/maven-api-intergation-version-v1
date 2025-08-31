import React, { useState, useEffect, useRef, useMemo } from 'react';
import { JournalEntry } from '../App';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface JournalViewProps {
    entries: JournalEntry[];
    onUpdate: (date: string, content: string) => void;
    onDelete: (date: string) => void;
}

const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
    const timeoutRef = useRef<number | null>(null);
    return (...args: any[]) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => callback(...args), 700);
    };
};

const formatDateToYYYYMMDD = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const JournalView: React.FC<JournalViewProps> = ({ entries, onUpdate, onDelete }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [editorContent, setEditorContent] = useState('');
    
    const editorRef = useRef<HTMLDivElement>(null);
    const entryDates = useMemo(() => new Set(entries.map(e => e.date)), [entries]);
    
    const selectedDateString = useMemo(() => formatDateToYYYYMMDD(selectedDate), [selectedDate]);
    const activeEntry = useMemo(() => entries.find(e => e.date === selectedDateString), [entries, selectedDateString]);

    useEffect(() => {
        setEditorContent(activeEntry?.content || '');
    }, [activeEntry]);

    const debouncedUpdate = useDebounce(onUpdate, 500);

    const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
        const newContent = e.currentTarget.innerHTML;
        setEditorContent(newContent);
        if (newContent.trim() || activeEntry) {
            debouncedUpdate(selectedDateString, newContent);
        }
    };
    
    const handleDelete = () => {
        if (activeEntry && window.confirm('Are you sure you want to delete this entry?')) {
            onDelete(selectedDateString);
        }
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
            const hasEntry = entryDates.has(dayString);

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
                    {hasEntry && <div className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`}></div>}
                </button>
            );
        });
    };

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    return (
        <div className="flex-1 flex h-full bg-background overflow-hidden">
            <aside className="w-80 border-r border-border p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-md hover:bg-accent"><ChevronLeft className="w-5 h-5" /></button>
                    <h2 className="font-semibold text-lg">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-md hover:bg-accent"><ChevronRight className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-7 gap-y-2 place-items-center text-sm text-muted-foreground mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="w-10 h-10 flex items-center justify-center">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-2 place-items-center">
                    {generateCalendar()}
                </div>
            </aside>
            <main className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto">
                 <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-foreground">
                        {selectedDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h1>
                    {activeEntry && (
                         <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                            Delete Entry
                        </button>
                    )}
                </div>
                 <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleContentChange}
                    dangerouslySetInnerHTML={{ __html: editorContent }}
                    data-placeholder="What's on your mind today?"
                    className="relative flex-1 w-full bg-transparent text-foreground/90 focus:outline-none resize-none leading-8 text-lg editor-content"
                    aria-label="Journal entry content"
                />
            </main>
        </div>
    );
};

export default JournalView;