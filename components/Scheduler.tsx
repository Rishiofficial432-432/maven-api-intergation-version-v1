
import React, { useState } from 'react';
import { Teacher, Subject, ClassInfo, Room, TimetableEntry } from '../types';
import { Plus, Trash2, Wand2, Loader, Users, BookOpen, Building, UploadCloud, Download } from 'lucide-react';
import { useToast } from './Toast';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';

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
                    availableDays: (t.AvailableDays || 'Monday,Tuesday,Wednesday,Thursday,Friday').split(',').map((s: string) => s.trim()).filter(Boolean),
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
    
        try {
            // FIX: Instantiating the worker with a direct path is more robust than constructing a full URL object,
            // which can fail in sandboxed environments where `window.location.origin` is not a standard URL.
            const worker = new Worker('/workers/timetable.worker.ts', { type: 'module' });
        
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

        } catch (error) {
            console.error("Failed to create or start timetable worker:", error);
            toast.error("Could not start the timetable generation process.");
            setIsLoading(false);
        }
    };
    
    const handleGenerateWithAI = async () => {
        if (!geminiAI) {
            toast.error("AI features are disabled. Please configure your API key in settings.");
            return;
        }
        if (teachers.length === 0 || subjects.length === 0 || classes.length === 0 || rooms.length === 0) {
            toast.error("Please add rooms and upload a valid configuration file before generating.");
            return;
        }
    
        setIsLoading(true);
        setTimetable(null);

        const prompt = `You are a university registrar responsible for creating a weekly class schedule. Given the following constraints, generate a complete, conflict-free timetable.

Constraints:
1.  **Schedule:** Monday to Friday.
2.  **Time Slots:** "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00".
3.  **Rules:**
    - A teacher can only teach one class at a time.
    - A class can only have one subject at a time.
    - A room can only host one class at a time.
    - A class must be assigned to a room with sufficient capacity.
    - Each subject must be scheduled for its required number of hours per week for each class.
    - A teacher must be assigned to a subject they are qualified to teach.

Data:
- Teachers: ${JSON.stringify(teachers)}
- Subjects: ${JSON.stringify(subjects)}
- Classes: ${JSON.stringify(classes)}
- Rooms: ${JSON.stringify(rooms)}

Your response must be a JSON object containing a single key "schedule", which is an array of timetable entry objects.
`;
        const schema = {
            type: Type.OBJECT,
            properties: {
                schedule: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            day: { type: Type.STRING },
                            timeSlot: { type: Type.STRING },
                            className: { type: Type.STRING },
                            subjectName: { type: Type.STRING },
                            teacherName: { type: Type.STRING },
                            roomName: { type: Type.STRING },
                        }
                    }
                }
            }
        };

        try {
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema }
            });
            const jsonStr = response.text.trim();
            const parsedResult = JSON.parse(jsonStr);
            if (!parsedResult.schedule) throw new Error("AI did not return a valid schedule array.");
            
            setTimetable(parsedResult.schedule);
            toast.success("AI generated the timetable successfully!");

        } catch (error: any) {
            console.error("AI Generation Error:", error);
            toast.error(`AI failed to generate a schedule: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
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
                    <div className="mt-6 flex flex-col items-center gap-4">
                        <button
                            onClick={handleGenerateTimetable}
                            disabled={isLoading}
                            className="w-full max-w-sm px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                        >
                            {isLoading ? <><Loader className="animate-spin" /> Generating...</> : <>Generate Timetable</>}
                        </button>
                        <button
                            onClick={handleGenerateWithAI}
                            disabled={isLoading}
                            className="w-full max-w-sm px-8 py-2 bg-primary/20 text-primary rounded-lg font-semibold text-base hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            {isLoading ? <><Loader className="animate-spin" /> Please wait...</> : <><Wand2 /> Generate with AI (Experimental)</>}
                        </button>
                    </div>
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
