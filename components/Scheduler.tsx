import React, { useState } from 'react';
import { Teacher, Course, Room, TimetableEntry } from './MamDesk';
import { Plus, Trash2, Wand2, Loader, Users, BookOpen, Building } from 'lucide-react';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { useToast } from './Toast';

const Scheduler: React.FC = () => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [timetable, setTimetable] = useState<TimetableEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    // State for input forms
    const [teacherName, setTeacherName] = useState('');
    const [teacherExpertise, setTeacherExpertise] = useState('');
    const [teacherAvailability, setTeacherAvailability] = useState<Set<string>>(new Set());
    const [courseName, setCourseName] = useState('');
    const [courseHours, setCourseHours] = useState(3);
    const [courseExpertise, setCourseExpertise] = useState('');
    const [roomName, setRoomName] = useState('');
    const [roomCapacity, setRoomCapacity] = useState(30);

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const handleAddTeacher = (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherName.trim()) return;
        setTeachers([...teachers, {
            id: crypto.randomUUID(),
            name: teacherName,
            expertise: teacherExpertise.split(',').map(e => e.trim()),
            availability: Array.from(teacherAvailability),
        }]);
        setTeacherName('');
        setTeacherExpertise('');
        setTeacherAvailability(new Set());
    };

    const handleAddCourse = (e: React.FormEvent) => {
        e.preventDefault();
        if (!courseName.trim()) return;
        setCourses([...courses, {
            id: crypto.randomUUID(),
            name: courseName,
            hoursPerWeek: courseHours,
            requiredExpertise: courseExpertise,
        }]);
        setCourseName('');
        setCourseHours(3);
        setCourseExpertise('');
    };

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

    const handleGenerateTimetable = async () => {
        if (!geminiAI) {
            toast.error("AI features are disabled. Please configure your API key in settings.");
            return;
        }
        if (teachers.length === 0 || courses.length === 0 || rooms.length === 0) {
            toast.error("Please add at least one teacher, course, and room before generating a timetable.");
            return;
        }

        setIsLoading(true);
        setTimetable(null);

        const prompt = `
You are an expert university scheduler AI. Your task is to create a conflict-free weekly timetable based on the provided data. The academic week is from Monday to Friday, with standard class slots from 09:00 to 17:00.

**Constraints to strictly follow:**
1. A teacher cannot teach two different courses at the same time.
2. A room cannot host two different courses at the same time.
3. A course must be taught by a teacher whose expertise matches the course's required expertise.
4. A course must be scheduled only on a day when the assigned teacher is available.
5. Each course must be scheduled for its total required hours per week (e.g., a 3-hour course needs three 1-hour slots).
6. Try to distribute the classes throughout the week to avoid overloading any single day.

**Input Data:**
- Teachers: ${JSON.stringify(teachers)}
- Courses: ${JSON.stringify(courses)}
- Rooms: ${JSON.stringify(rooms)}

**Output:**
Your response MUST be a valid JSON array of timetable entries, following the provided schema. Do not include any other text or explanations.
`;

        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.STRING },
                    timeSlot: { type: Type.STRING },
                    courseName: { type: Type.STRING },
                    teacherName: { type: Type.STRING },
                    roomName: { type: Type.STRING },
                },
            },
        };

        try {
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema },
            });
            const jsonStr = response.text.trim();
            const parsedTimetable: TimetableEntry[] = JSON.parse(jsonStr);
            setTimetable(parsedTimetable);
            toast.success("Timetable generated successfully!");
        } catch (error) {
            console.error("Timetable generation error:", error);
            toast.error("Failed to generate timetable. The AI may have returned an invalid format or an error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const organizedTimetable = timetable ? weekdays.reduce((acc, day) => {
        acc[day] = timetable.filter(entry => entry.day === day).sort((a,b) => a.timeSlot.localeCompare(b.timeSlot));
        return acc;
    }, {} as Record<string, TimetableEntry[]>) : null;

    const renderInputSection = (title: string, icon: React.ReactNode, items: any[], deleteFn: (id: string) => void, form: React.ReactNode) => (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">{icon} {title}</h3>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {items.map(item => (
                    <div key={item.id} className="bg-secondary p-2 rounded-md flex justify-between items-center text-sm">
                        <span>{item.name}</span>
                        <button onClick={() => deleteFn(item.id)} className="text-destructive/70 hover:text-destructive"><Trash2 size={14}/></button>
                    </div>
                ))}
            </div>
            {form}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderInputSection("Teachers", <Users/>, teachers, id => setTeachers(teachers.filter(t => t.id !== id)), 
                    <form onSubmit={handleAddTeacher} className="space-y-2 p-2 border-t border-border">
                        <input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="Teacher Name" className="w-full bg-input p-2 rounded-md text-sm" />
                        <input value={teacherExpertise} onChange={e => setTeacherExpertise(e.target.value)} placeholder="Expertise (comma-sep)" className="w-full bg-input p-2 rounded-md text-sm" />
                        <div className="grid grid-cols-3 gap-1">
                            {weekdays.map(day => 
                                <button type="button" key={day} onClick={() => setTeacherAvailability(prev => { const next = new Set(prev); if (next.has(day)) next.delete(day); else next.add(day); return next; })}
                                className={`p-1 text-xs rounded ${teacherAvailability.has(day) ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{day.substring(0,3)}</button>
                            )}
                        </div>
                        <button type="submit" className="w-full bg-primary/20 text-primary p-2 rounded-md text-sm font-semibold">Add Teacher</button>
                    </form>
                )}
                {renderInputSection("Courses", <BookOpen/>, courses, id => setCourses(courses.filter(c => c.id !== id)),
                     <form onSubmit={handleAddCourse} className="space-y-2 p-2 border-t border-border">
                        <input value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Course Name" className="w-full bg-input p-2 rounded-md text-sm" />
                        <input value={courseExpertise} onChange={e => setCourseExpertise(e.target.value)} placeholder="Required Expertise" className="w-full bg-input p-2 rounded-md text-sm" />
                        <div className="flex items-center gap-2">
                            <label className="text-sm">Hours/Week:</label>
                            <input type="number" value={courseHours} onChange={e => setCourseHours(parseInt(e.target.value))} className="w-full bg-input p-2 rounded-md text-sm" />
                        </div>
                        <button type="submit" className="w-full bg-primary/20 text-primary p-2 rounded-md text-sm font-semibold">Add Course</button>
                    </form>
                )}
                {renderInputSection("Rooms", <Building/>, rooms, id => setRooms(rooms.filter(r => r.id !== id)),
                     <form onSubmit={handleAddRoom} className="space-y-2 p-2 border-t border-border">
                        <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Room Name/Number" className="w-full bg-input p-2 rounded-md text-sm" />
                        <div className="flex items-center gap-2">
                             <label className="text-sm">Capacity:</label>
                            <input type="number" value={roomCapacity} onChange={e => setRoomCapacity(parseInt(e.target.value))} className="w-full bg-input p-2 rounded-md text-sm" />
                        </div>
                        <button type="submit" className="w-full bg-primary/20 text-primary p-2 rounded-md text-sm font-semibold">Add Room</button>
                    </form>
                )}
            </div>
            
            <div className="text-center">
                <button
                    onClick={handleGenerateTimetable}
                    disabled={isLoading}
                    className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center gap-2 mx-auto"
                >
                    {isLoading ? <><Loader className="animate-spin" /> Generating...</> : <><Wand2 /> Generate Timetable with AI</>}
                </button>
            </div>

            {organizedTimetable && (
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-2xl font-bold mb-4">Generated Weekly Timetable</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {weekdays.map(day => (
                            <div key={day} className="bg-secondary p-3 rounded-lg">
                                <h3 className="font-bold text-center mb-3">{day}</h3>
                                <div className="space-y-2">
                                    {organizedTimetable[day]?.length > 0 ? organizedTimetable[day].map(entry => (
                                        <div key={`${entry.day}-${entry.timeSlot}-${entry.courseName}`} className="bg-accent p-2 rounded-md text-xs">
                                            <p className="font-semibold text-primary">{entry.timeSlot}</p>
                                            <p className="font-bold">{entry.courseName}</p>
                                            <p className="text-muted-foreground">{entry.teacherName}</p>
                                            <p className="text-muted-foreground">@{entry.roomName}</p>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-muted-foreground text-center py-4">No classes</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scheduler;
