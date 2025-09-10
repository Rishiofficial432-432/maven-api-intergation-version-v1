

export type View = 'notes' | 'dashboard' | 'journal' | 'documind' | 'workspace' | 'academics' | 'about' | 'settings' | 'help';

export interface Page {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  bannerUrl?: string;
  bannerType?: 'image' | 'video';
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  createdAt: Date;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink: string;
}

export interface WorkspaceHistoryEntry {
    fileId: string;
    fileName: string;
    fileType: 'doc' | 'sheet';
    noteTitle: string;
    importedAt: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface KanbanItem {
  id: string;
  text: string;
}

export interface KanbanColumn {
  name: string;
  items: KanbanItem[];
}

export interface KanbanState {
  [key: string]: KanbanColumn;
}

export interface QuickNote {
    id: string;
    text: string;
    createdAt: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
}

export interface Habit {
    id:string;
    name: string;
    streak: number;
    lastCompleted: string | null;
    history: { date: string; completed: boolean }[];
}

export interface Quote {
    id: string;
    text: string;
}

export interface MoodEntry {
    id: string;
    mood: string;
    date: string;
}
export interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
}
export interface Goal {
    id: string;
    text: string;
    completed: boolean;
    targetDate?: string;
}

export interface Class {
    id: string;
    name: string;
}
export interface Student {
    id: string;
    name: string;
    enrollment: string;
    classId: string;
}
export interface Attendance {
    [date: string]: {
        [studentId: string]: 'Present' | 'Absent';
    };
}

// Types for AI Scheduler
export interface Teacher {
    name: string;
    subjects: string[];
    availableDays: string[];
}
export interface Subject {
    name: string;
    hoursPerWeek: number;
}
export interface ClassInfo {
    name: string;
    subjects: string[];
    studentCount: number;
}
export interface Room {
    id: string;
    name: string;
    capacity: number;
}
export interface TimetableEntry {
    day: string;
    timeSlot: string;
    className: string;
    subjectName: string;
    teacherName: string;
    roomName: string;
}