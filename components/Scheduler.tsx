

import React, { useState } from 'react';
import { Teacher, Subject, ClassInfo, Room, TimetableEntry } from '../types';
import { Plus, Trash2, Wand2, Loader, Users, BookOpen, Building, UploadCloud, Download } from 'lucide-react';
import { useToast } from './Toast';

declare const XLSX: any;

const Scheduler: React.FC = () => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [timetable, setTimetable] = useState<TimetableEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    // State for room input form
    const [roomName, setRoomName] = useState('');
    const [roomCapacity, setRoomCapacity] = useState(30);
    const [isDragging, setIsDragging] = useState(false);

    const handleAddRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomName.trim()) return;
        setRooms([...rooms, {
            id: crypto.randomUUID(),
            name: roomName,
            capacity: roomCapacity,
        }]);
        setRoomName('');
        setRoomCapacity(30);
    };

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Teachers
                const teachersSheet = workbook.Sheets['Teachers'];
                if (!teachersSheet) throw new Error("Sheet 'Teachers' not found.");
                const teachersData: any[] = XLSX.utils.sheet_to_json(teachersSheet);
                setTeachers(teachersData.map(t => ({
                    name: t.TeacherName,
                    subjects: (t.SubjectsTaught || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                    availableDays: (t.AvailableDays || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                })));

                // Subjects
                const subjectsSheet = workbook.Sheets['Subjects'];
                if (!subjectsSheet) throw new Error("Sheet 'Subjects' not found.");
                const subjectsData: any[] = XLSX.utils.sheet_to_json(subjectsSheet);
                setSubjects(subjectsData.map(s => ({
                    name: s.SubjectName,
                    hoursPerWeek: parseInt(s.HoursPerWeek, 10),
                })));
                
                // Classes
                const classesSheet = workbook.Sheets['Classes'];
                if (!classesSheet) throw new Error("Sheet 'Classes' not found.");
                const classesData: any[] = XLSX.utils.sheet_to_json(classesSheet);
                setClasses(classesData.map(c => ({
                    name: c.ClassName,
                    subjects: (c.Subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                    studentCount: parseInt(c.StudentCount, 10),
                })));

                toast.success("Academic data loaded successfully!");

            } catch (error: any) {
                console.error("Error parsing Excel file:", error);
                toast.error(`Failed to parse file: ${error.message}`);
            }
        };
        reader.onerror = () => toast.error("Failed to read the file.");
        reader.readAsArrayBuffer(file);
    };
    
    const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
            e.target.value = '';
        }
    };
    
    const downloadTemplate = () => {
        const teachersData = [{ TeacherName: 'Mr. Smith', SubjectsTaught: 'Mathematics, Physics', AvailableDays: 'Monday,Tuesday,Wednesday,Thursday,Friday' }];
        const subjectsData = [{ SubjectName: 'Mathematics', HoursPerWeek: 4 }];
        const classesData = [{ ClassName: 'Grade 10A', Subjects: 'Mathematics, Physics', StudentCount: 25 }];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teachersData), "Teachers");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subjectsData), "Subjects");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classesData), "Classes");
        XLSX.writeFile(wb, "Timetable_Template.xlsx");
    };

    const handleGenerateTimetable = async () => {
        if (teachers.length === 0 || subjects.length === 0 || classes.length === 0 || rooms.length === 0) {
            toast.error("Please add rooms and upload a valid configuration file before generating.");
            return;
        }
    
        setIsLoading(true);
        setTimetable(null);
    
        const worker = new Worker(new URL('../workers/timetable.worker.ts', import.meta.url), { type: 'module' });
    
        worker.onmessage = (event) => {
            const { success, schedule, error } = event.data;
            if (success) {
                setTimetable(schedule);
                toast.success("Timetable generated successfully!");
            } else {
                toast.error(error || "An unknown error occurred during timetable generation.");
            }
            setIsLoading(false);
            worker.terminate();
        };
    
        worker.onerror = (error) => {
            console.error('Worker error:', error);
            toast.error("A critical worker error occurred. See console for details.");
            setIsLoading(false);
            worker.terminate();
        };
    
        worker.postMessage({ teachers, subjects, classes, rooms });
    };

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = Array.from(new Set(timetable?.map(t => t.timeSlot) || [])).sort();

    const timetableByClass = timetable?.reduce((acc, entry) => {
        if (!acc[entry.className]) acc[entry.className] = [];
        acc[entry.className].push(entry);
        return acc;
    }, {} as Record<string, TimetableEntry[]>);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Step 1 & 2: Configuration */}
                <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                    <div>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Building /> 1. Configure Rooms</h3>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                             {rooms.map(item => (
                                <div key={item.id} className="bg-secondary p-2 rounded-md flex justify-between items-center text-sm">
                                    <span>{item.name} (Capacity: {item.capacity})</span>
                                    <button onClick={() => setRooms(rooms.filter(r => r.id !== item.id))} className="text-destructive/70 hover:text-destructive"><Trash2 size={14}/></button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddRoom} className="space-y-2 p-2 mt-2 border-t border-border">
                            <div className="flex gap-2">
                                <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Room Name/Number" className="w-full bg-input p-2 rounded-md text-sm" />
                                <input type="number" value={roomCapacity} onChange={e => setRoomCapacity(parseInt(e.target.value))} placeholder="Capacity" className="w-24 bg-input p-2 rounded-md text-sm" />
                            </div>
                            <button type="submit" className="w-full bg-primary/20 text-primary p-2 rounded-md text-sm font-semibold">Add Room</button>
                        </form>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><UploadCloud /> 2. Upload Data File</h3>
                        <input type="file" id="file-upload" className="hidden" accept=".xlsx, .xls" onChange={handleFileSelect} />
                        <div
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={handleFileDrop}
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                        >
                           <label htmlFor="file-upload" className="w-full text-center cursor-pointer">
                                <p className="text-sm text-muted-foreground">Drag & drop or click to upload an Excel file</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">Contains Teachers, Subjects, and Classes</p>
                           </label>
                        </div>
                        <button onClick={downloadTemplate} className="mt-2 text-sm text-primary hover:underline flex items-center gap-1 mx-auto"><Download size={14}/> Download Template</button>
                    </div>
                </div>

                {/* Data Summary & Generation */}
                <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                    <h3 className="text-xl font-bold mb-4">3. Generate Timetable</h3>
                    <div className="grid grid-cols-3 gap-4 text-center flex-grow">
                        <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold">{teachers.length}</p><p className="text-sm text-muted-foreground">Teachers</p></div>
                        <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold">{subjects.length}</p><p className="text-sm text-muted-foreground">Subjects</p></div>
                        <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold">{classes.length}</p><p className="text-sm text-muted-foreground">Classes</p></div>
                    </div>
                    <button
                        onClick={handleGenerateTimetable}
                        disabled={isLoading}
                        className="mt-6 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center gap-2 mx-auto"
                    >
                        {isLoading ? <><Loader className="animate-spin" /> Generating...</> : <><Wand2 /> Generate Timetable</>}
                    </button>
                </div>
            </div>

            {timetableByClass && (
                <div className="space-y-6">
                    {Object.entries(timetableByClass).map(([className, entries]) => (
                        <div key={className} className="bg-card border border-border rounded-xl p-6">
                            <h2 className="text-2xl font-bold mb-4">Timetable for: <span className="text-primary">{className}</span></h2>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-2 border border-border bg-secondary w-32">Time</th>
                                            {weekdays.map(day => <th key={day} className="p-2 border border-border bg-secondary">{day}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeSlots.map(slot => (
                                            <tr key={slot}>
                                                <td className="p-2 border border-border font-mono text-xs text-center bg-secondary">{slot}</td>
                                                {weekdays.map(day => {
                                                    const entry = entries.find(e => e.day === day && e.timeSlot === slot);
                                                    return (
                                                        <td key={day} className="p-2 border border-border text-center align-top h-24">
                                                            {entry ? (
                                                                <div className="bg-accent p-2 rounded-md text-xs text-left h-full">
                                                                    <p className="font-bold">{entry.subjectName}</p>
                                                                    <p className="text-muted-foreground">{entry.teacherName}</p>
                                                                    <p className="text-muted-foreground">@{entry.roomName}</p>
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Scheduler;