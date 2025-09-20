import React, { useState, useEffect, useCallback } from 'react';
import { PortalUser, TestSubmission, Test } from '../types';
import * as LocalPortal from './portal-db';
import { Loader, BarChart2, User, CheckSquare, Percent, TrendingUp } from 'lucide-react';

// Simplified demo user hook
const useDemoUser = (): [PortalUser | null, boolean] => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            try {
                const demoRole = sessionStorage.getItem('demo-role');
                if (demoRole === 'teacher') {
                    const teacher = await LocalPortal.getDemoUser('teacher');
                    setUser(teacher);
                } else if (demoRole === 'student') {
                    const student = await LocalPortal.getDemoUser('student');
                    setUser(student);
                } else {
                    setUser(null);
                }
            } catch (e) {
                console.error("Could not fetch demo user", e);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);
    return [user, loading];
};

const ProgressChart: React.FC<{ submissions: TestSubmission[] }> = ({ submissions }) => {
    if (submissions.length === 0) return null;
    const sortedSubs = [...submissions].sort((a,b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    return (
        <div className="bg-secondary p-4 rounded-lg h-64 flex items-end justify-around gap-2">
            {sortedSubs.map(sub => (
                <div key={sub.id} className="flex-1 flex flex-col items-center justify-end group relative" title={`${sub.testTitle}: ${sub.score}%`}>
                    <div className="text-xs mb-1 font-bold">{sub.score}</div>
                    <div className="w-full bg-primary/20 rounded-t-md hover:bg-primary/50 transition-colors" style={{ height: `${sub.score}%`}}></div>
                     <div className="text-xs text-muted-foreground mt-1 truncate w-full text-center">{sub.testTitle}</div>
                </div>
            ))}
        </div>
    );
};


const StudentProgressView: React.FC<{ user: PortalUser }> = ({ user }) => {
    const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const subs = await LocalPortal.getSubmissionsForStudent(user.id);
            setSubmissions(subs);
            setLoading(false);
        };
        fetchData();
    }, [user.id]);
    
    const averageScore = submissions.length > 0 ? Math.round(submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length) : 0;
    const testsAttempted = submissions.length;

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;

    return (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <h2 className="text-2xl font-bold">My Progress Report</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold text-primary">{testsAttempted}</p><p className="text-sm text-muted-foreground">Tests Attempted</p></div>
                <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold text-primary">{averageScore}%</p><p className="text-sm text-muted-foreground">Average Score</p></div>
                <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold text-primary">N/A</p><p className="text-sm text-muted-foreground">Class Rank</p></div>
            </div>
            <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><TrendingUp/> Score Over Time</h3>
                <ProgressChart submissions={submissions} />
            </div>
        </div>
    );
};


const TeacherProgressView: React.FC = () => {
    const [students, setStudents] = useState<PortalUser[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudents = async () => {
            setLoading(true);
            const studentList = await LocalPortal.getStudents();
            setStudents(studentList);
            if (studentList.length > 0) {
                setSelectedStudentId(studentList[0].id);
            }
            setLoading(false);
        };
        fetchStudents();
    }, []);

    useEffect(() => {
        if (!selectedStudentId) return;
        const fetchSubmissions = async () => {
            const subs = await LocalPortal.getSubmissionsForStudent(selectedStudentId);
            setSubmissions(subs);
        };
        fetchSubmissions();
    }, [selectedStudentId]);
    
    const selectedStudent = students.find(s => s.id === selectedStudentId);
    const averageScore = submissions.length > 0 ? Math.round(submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length) : 0;
    const testsAttempted = submissions.length;

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;

    return (
         <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold">Student Progress Analytics</h2>
                <div className="flex items-center gap-2">
                    <User className="text-muted-foreground" />
                    <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                        className="bg-secondary border border-border rounded-md px-3 py-2">
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>
            
            {selectedStudent ? (
                <div className="animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold text-primary">{testsAttempted}</p><p className="text-sm text-muted-foreground">Tests Attempted</p></div>
                        <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold text-primary">{averageScore}%</p><p className="text-sm text-muted-foreground">Average Score</p></div>
                        <div className="bg-secondary p-4 rounded-lg"><p className="text-3xl font-bold text-primary">N/A</p><p className="text-sm text-muted-foreground">Class Rank</p></div>
                    </div>
                    <div className="mt-6">
                        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><TrendingUp/> Score Over Time</h3>
                        <ProgressChart submissions={submissions} />
                    </div>
                </div>
            ) : <p className="text-center text-muted-foreground py-8">No students found or selected.</p>}
        </div>
    );
};


const ProgressView: React.FC = () => {
    const [user, loading] = useDemoUser();

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;
    if (!user) return <div className="text-center text-muted-foreground">Could not load user data. Please ensure you are in demo mode.</div>;

    return user.role === 'teacher' ? <TeacherProgressView /> : <StudentProgressView user={user} />;
};

export default ProgressView;
