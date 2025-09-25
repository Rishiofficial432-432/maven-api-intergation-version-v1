export type View = 'notes' | 'dashboard' | 'journal' | 'documind' | 'workspace' | 'academics' | 'about' | 'settings' | 'help' | 'inspiration' | 'research' | 'pathfinder';

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
  [key:string]: KanbanColumn;
}

export interface QuickNote {
    id: string;
    text: string;
    createdAt: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    type?: 'class' | 'exam' | 'event' | 'holiday' | 'class_test';
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

// Local-first Portal Types
export interface PortalUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'student' | 'teacher';
  enrollment_id?: string;
  ug_number?: string;
  phone_number?: string;
  approved?: boolean;
}

export interface PortalSession {
  id: string;
  teacher_id: string;
  session_code: string;
  expires_at: string;
  is_active: boolean;
  location_enforced?: boolean;
  radius?: number;
  location?: { latitude: number; longitude: number } | null;
}

export interface PortalAttendanceRecord {
  id?: number;
  session_id: string;
  student_id: string;
  student_name: string;
  enrollment_id?: string;
  created_at: string;
}

export interface CurriculumFile {
  id: string;
  teacherId: string;
  teacherName: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

// Types for AI Curriculum Generator
export interface CurriculumWeek {
    week: number;
    topic: string;
    keyConcepts: string[];
    reading: string;
    assignment: string;
}

export interface GeneratedCurriculum {
    courseTitle: string;
    courseDescription: string;
    learningObjectives: string[];
    weeklyBreakdown: CurriculumWeek[];
}

// New types for Tests and Progress feature
export type QuestionType = 'MCQ' | 'SAQ' | 'LAQ' | 'Fill';

export interface BaseQuestion {
  id: string;
  questionText: string;
  type: QuestionType;
}

export interface MCQQuestion extends BaseQuestion {
  type: 'MCQ';
  options: string[];
  correctAnswerIndex: number;
}

export interface SAQQuestion extends BaseQuestion {
  type: 'SAQ';
  modelAnswer?: string;
}

export interface LAQQuestion extends BaseQuestion {
  type: 'LAQ';
  modelAnswer?: string;
}

export interface FillQuestion extends BaseQuestion {
  type: 'Fill';
  correctAnswer: string;
}

export type TestQuestion = MCQQuestion | SAQQuestion | LAQQuestion | FillQuestion;


export interface Test {
  id: string;
  title: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  questions: TestQuestion[];
  teacherId: string;
}

export interface TestSubmission {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  answers: (number | string | null)[]; // Array of selected option indices or text answers
  score: number; // Percentage on auto-graded questions
  submittedAt: string; // ISO timestamp
  testTitle?: string;
}

// Types for Career Guidance
export interface StudentProfile {
  id: string;
  personalDetails: {
    name: string;
    age: number;
    gender: string;
    location: string;
    interests: string;
  };
  academicDetails: {
    tenthScore: number;
    twelfthScore: number;
    stream: 'Science' | 'Commerce' | 'Arts' | 'Diploma';
    dropYear: boolean;
    competitiveExams: Array<{
      id: string;
      name: string;
      score: string;
    }>;
  };
  familyBackground: {
    fatherIncome: number;
    financialConstraints: boolean;
  };
  createdAt: string;
}

export interface CareerRecommendation {
  colleges: CollegeSuggestion[];
  exams: ExamPath[];
  careerPaths: CareerPath[];
  backupOptions: BackupOption[];
}

export interface CollegeSuggestion {
  name: string;
  type: 'IIT' | 'NIT' | 'State' | 'Private' | 'International';
  eligibility: number; // 1-100 match score
  affordability: 'High' | 'Medium' | 'Low';
  location: string;
  fees: number;
  cutoffRange: string;
}

export interface ExamPath {
  name: string;
  description: string;
  eligibility: 'High' | 'Medium' | 'Low';
  preparationTime: string;
  careerScope: string;
}

export interface CareerPath {
  title: string;
  description: string;
  requiredExams: string[];
  avgSalary: string;
  growthRate: string;
}

export interface BackupOption {
  title: string;
  description: string;
  whenToConsider: string;
  alternativePaths: string[];
}