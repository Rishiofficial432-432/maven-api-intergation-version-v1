
import { Teacher, Subject, ClassInfo, Room, TimetableEntry } from '../types';

interface WorkerData {
    teachers: Teacher[];
    subjects: Subject[];
    classes: ClassInfo[];
    rooms: Room[];
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const timeSlots = [
    "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00",
    "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00"
];

self.onmessage = (event: MessageEvent<WorkerData>) => {
    const { teachers, subjects, classes, rooms } = event.data;

    try {
        const schedule = generateTimetable(teachers, subjects, classes, rooms);
        self.postMessage({ success: true, schedule });
    } catch (error: any) {
        self.postMessage({ success: false, error: error.message });
    }
};

function generateTimetable(teachers: Teacher[], subjects: Subject[], classes: ClassInfo[], rooms: Room[]): TimetableEntry[] {
    // Helper maps for quick lookups
    const subjectMap = new Map(subjects.map(s => [s.name, s]));
    
    // Data structures for tracking availability
    const teacherSchedule: Record<string, Record<string, Set<string>>> = {};
    const roomSchedule: Record<string, Record<string, Set<string>>> = {};
    const classSchedule: Record<string, Record<string, Set<string>>> = {};

    teachers.forEach(t => teacherSchedule[t.name] = {});
    rooms.forEach(r => roomSchedule[r.name] = {});
    classes.forEach(c => classSchedule[c.name] = {});

    // 1. Create all required class sessions to be scheduled
    interface Session {
      className: string;
      subjectName: string;
      studentCount: number;
    }
    const sessionsToSchedule: Session[] = [];
    for (const cls of classes) {
        for (const subjectName of cls.subjects) {
            const subject = subjectMap.get(subjectName);
            if (subject) {
                for (let i = 0; i < subject.hoursPerWeek; i++) {
                    sessionsToSchedule.push({
                        className: cls.name,
                        subjectName: subject.name,
                        studentCount: cls.studentCount,
                    });
                }
            }
        }
    }

    // 2. Sort sessions by constraint (classes with more subjects/hours first)
    sessionsToSchedule.sort((a, b) => {
      const hoursA = subjectMap.get(a.subjectName)?.hoursPerWeek || 0;
      const hoursB = subjectMap.get(b.subjectName)?.hoursPerWeek || 0;
      return hoursB - hoursA;
    });

    const finalSchedule: TimetableEntry[] = [];
    const unscheduled: string[] = [];
    
    // 3. Iterate and schedule each session
    for (const session of sessionsToSchedule) {
        let scheduled = false;
        
        // Find eligible teachers
        const eligibleTeachers = teachers.filter(t => t.subjects.includes(session.subjectName));
        if (eligibleTeachers.length === 0) {
            unscheduled.push(`${session.className} - ${session.subjectName} (no teacher)`);
            continue;
        }

        // Find eligible rooms
        const eligibleRooms = rooms.filter(r => r.capacity >= session.studentCount);
        if (eligibleRooms.length === 0) {
             unscheduled.push(`${session.className} - ${session.subjectName} (no room)`);
            continue;
        }

        // Try to find a slot
        for (const day of weekdays) {
            if (scheduled) break;
            for (const timeSlot of timeSlots) {
                if (scheduled) break;

                // Check class availability
                if (classSchedule[session.className][day]?.has(timeSlot)) {
                    continue;
                }

                // Find an available teacher
                const availableTeacher = eligibleTeachers.find(t =>
                    t.availableDays.includes(day) && !teacherSchedule[t.name][day]?.has(timeSlot)
                );

                if (availableTeacher) {
                    // Find an available room
                    const availableRoom = eligibleRooms.find(r => !roomSchedule[r.name][day]?.has(timeSlot));
                    
                    if (availableRoom) {
                        // --- Book the slot ---
                        // Teacher
                        if (!teacherSchedule[availableTeacher.name][day]) teacherSchedule[availableTeacher.name][day] = new Set();
                        teacherSchedule[availableTeacher.name][day].add(timeSlot);
                        // Room
                        if (!roomSchedule[availableRoom.name][day]) roomSchedule[availableRoom.name][day] = new Set();
                        roomSchedule[availableRoom.name][day].add(timeSlot);
                        // Class
                        if (!classSchedule[session.className][day]) classSchedule[session.className][day] = new Set();
                        classSchedule[session.className][day].add(timeSlot);

                        finalSchedule.push({
                            day,
                            timeSlot,
                            className: session.className,
                            subjectName: session.subjectName,
                            teacherName: availableTeacher.name,
                            roomName: availableRoom.name,
                        });
                        scheduled = true;
                    }
                }
            }
        }

        if (!scheduled) {
            unscheduled.push(`${session.className} - ${session.subjectName}`);
        }
    }

    if (unscheduled.length > 0) {
        const summary = unscheduled.slice(0, 5).join(', ');
        throw new Error(`Could not schedule all classes. Failed to place: ${summary}${unscheduled.length > 5 ? '...' : ''}. Please check constraints.`);
    }

    return finalSchedule;
}