import React, { useState, useEffect, useCallback } from 'react';
import { PortalUser, Test, TestQuestion, TestSubmission } from '../types';
import * as LocalPortal from './portal-db';
import { useToast } from './Toast';
import { Loader, Plus, Trash2, Send, ChevronLeft, Check, X, CheckSquare, Clock, FileText } from 'lucide-react';

// For the demo, we need to get the current user from the demo login logic.
// In a real app, this would come from a global context.
const useDemoUser = (): [PortalUser | null, boolean] => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // This is a simplified way to get the demo user.
        // It checks for a 'teacher' and then a 'student' demo user.
        const fetchUser = async () => {
            try {
                const teacher = await LocalPortal.getUserByEmail('e.reed@university.edu');
                if (teacher) {
                    setUser(teacher);
                } else {
                    const student = await LocalPortal.getUserByEmail('a.johnson@university.edu');
                    setUser(student);
                }
            } catch (e) {
                console.error("Could not fetch demo user", e);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);
    return [user, loading];
};


const TestTaker: React.FC<{ test: Test, student: PortalUser, onFinish: () => void }> = ({ test, student, onFinish }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<number[]>(Array(test.questions.length).fill(-1));
    const toast = useToast();

    const handleAnswerSelect = (optionIndex: number) => {
        setAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[currentQuestionIndex] = optionIndex;
            return newAnswers;
        });
    };

    const handleSubmit = async () => {
        if (answers.includes(-1)) {
            toast.error("Please answer all questions before submitting.");
            return;
        }
        
        let correctCount = 0;
        test.questions.forEach((q, i) => {
            if (q.correctAnswerIndex === answers[i]) {
                correctCount++;
            }
        });
        const score = Math.round((correctCount / test.questions.length) * 100);
        
        const submission: Omit<TestSubmission, 'id'> = {
            testId: test.id,
            studentId: student.id,
            studentName: student.name,
            answers,
            score,
            submittedAt: new Date().toISOString(),
            testTitle: test.title,
        };

        try {
            await LocalPortal.submitTest(submission);
            toast.success(`Test submitted! Your score: ${score}%`);
            onFinish();
        } catch (e: any) {
            toast.error(`Submission failed: ${e.message}`);
        }
    };

    const currentQuestion = test.questions[currentQuestionIndex];

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-2xl p-6">
                <h2 className="text-2xl font-bold">{test.title}</h2>
                <div className="my-4">
                    <p className="font-semibold text-lg">{currentQuestionIndex + 1}. {currentQuestion.questionText}</p>
                    <div className="space-y-2 mt-4">
                        {currentQuestion.options.map((option, i) => (
                            <button key={i} onClick={() => handleAnswerSelect(i)}
                                className={`w-full text-left p-3 rounded-md border-2 transition-colors ${answers[currentQuestionIndex] === i ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/80'}`}>
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <button onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))} disabled={currentQuestionIndex === 0}
                        className="px-4 py-2 bg-secondary rounded-md disabled:opacity-50">Previous</button>
                    <span>Question {currentQuestionIndex + 1} of {test.questions.length}</span>
                    {currentQuestionIndex === test.questions.length - 1 ? (
                        <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2"><Send size={16}/> Submit</button>
                    ) : (
                        <button onClick={() => setCurrentQuestionIndex(i => Math.min(test.questions.length - 1, i + 1))}
                            className="px-4 py-2 bg-secondary rounded-md">Next</button>
                    )}
                </div>
            </div>
        </div>
    );
};

const StudentTestsView: React.FC<{ user: PortalUser }> = ({ user }) => {
    const [pendingTests, setPendingTests] = useState<Test[]>([]);
    const [completedTests, setCompletedTests] = useState<TestSubmission[]>([]);
    const [takingTest, setTakingTest] = useState<Test | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const allTests = await LocalPortal.getAllFromStore<Test>('tests');
        const submissions = await LocalPortal.getSubmissionsForStudent(user.id);
        const completedTestIds = new Set(submissions.map(s => s.testId));
        
        setPendingTests(allTests.filter(t => !completedTestIds.has(t.id)));
        setCompletedTests(submissions);
        setLoading(false);
    }, [user.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {takingTest && <TestTaker test={takingTest} student={user} onFinish={() => { setTakingTest(null); fetchData(); }} />}
            <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Clock /> Pending Tests ({pendingTests.length})</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pendingTests.length > 0 ? pendingTests.map(test => (
                        <div key={test.id} className="bg-secondary p-3 rounded-md">
                            <p className="font-semibold">{test.title}</p>
                            <div className="flex justify-between items-center text-sm text-muted-foreground">
                                <span>{test.subject} - Due: {test.dueDate}</span>
                                <button onClick={() => setTakingTest(test)} className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs">Start Test</button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-muted-foreground text-center">No pending tests. Great job!</p>}
                </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
                 <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><CheckSquare/> Completed Tests ({completedTests.length})</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {completedTests.map(sub => (
                         <div key={sub.id} className="bg-secondary p-3 rounded-md">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">{sub.testTitle}</p>
                                <p className={`font-bold text-lg ${sub.score >= 80 ? 'text-green-400' : sub.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sub.score}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const CreateTestForm: React.FC<{ teacher: PortalUser, onBack: () => void, onTestCreated: () => void }> = ({ teacher, onBack, onTestCreated }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [questions, setQuestions] = useState<Partial<TestQuestion>[]>([{ questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
    const toast = useToast();

    const handleQuestionChange = (index: number, field: keyof TestQuestion, value: any) => {
        const newQuestions = [...questions];
        (newQuestions[index] as any)[field] = value;
        setQuestions(newQuestions);
    };
    
    const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options![oIndex] = value;
        setQuestions(newQuestions);
    };

    const addQuestion = () => setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
    const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

    const handleSaveTest = async () => {
        const newTest: Test = {
            id: crypto.randomUUID(),
            title, subject, dueDate,
            teacherId: teacher.id,
            questions: questions.map(q => ({
                id: crypto.randomUUID(),
                questionText: q.questionText || '',
                options: q.options || [],
                correctAnswerIndex: q.correctAnswerIndex || 0,
            })),
        };
        await LocalPortal.createTest(newTest);
        toast.success("Test created successfully!");
        onTestCreated();
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back to Tests</button>
            <div className="space-y-4">
                 <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Test Title" className="w-full bg-input p-2 rounded-md"/>
                 <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full bg-input p-2 rounded-md"/>
                 <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-input p-2 rounded-md"/>
            </div>
             <h3 className="font-bold my-4">Questions</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-secondary p-4 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center"><label className="font-semibold">Question {qIndex + 1}</label><button onClick={() => removeQuestion(qIndex)}><Trash2 size={16} className="text-destructive"/></button></div>
                        <textarea value={q.questionText} onChange={e => handleQuestionChange(qIndex, 'questionText', e.target.value)} placeholder="Question text..." className="w-full bg-input p-2 mt-2 rounded-md"/>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {q.options?.map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-2">
                                    <input type="radio" name={`correct-${qIndex}`} checked={q.correctAnswerIndex === oIndex} onChange={() => handleQuestionChange(qIndex, 'correctAnswerIndex', oIndex)}/>
                                    <input type="text" value={opt} onChange={e => handleOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} className="w-full bg-input p-2 rounded-md"/>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={addQuestion} className="mt-4 w-full p-2 bg-secondary rounded-md text-sm font-semibold">Add Question</button>
            <button onClick={handleSaveTest} className="mt-4 w-full p-3 bg-primary text-primary-foreground rounded-md font-bold">Save Test</button>
        </div>
    );
};

const TeacherTestsView: React.FC<{ user: PortalUser }> = ({ user }) => {
    const [view, setView] = useState<'list' | 'create' | 'results'>('list');
    const [tests, setTests] = useState<Test[]>([]);
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const teacherTests = await LocalPortal.getTestsForTeacher(user.id);
        setTests(teacherTests);
        setLoading(false);
    }, [user.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const viewResults = async (test: Test) => {
        setSelectedTest(test);
        const testSubmissions = await LocalPortal.getSubmissionsForTest(test.id);
        setSubmissions(testSubmissions);
        setView('results');
    };

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;

    if (view === 'create') {
        return <CreateTestForm teacher={user} onBack={() => setView('list')} onTestCreated={() => { setView('list'); fetchData(); }} />;
    }
    
    if (view === 'results' && selectedTest) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
                <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back to Tests</button>
                <h3 className="font-bold text-xl mb-4">Results for: {selectedTest.title}</h3>
                 <div className="space-y-3 max-h-96 overflow-y-auto">
                    {submissions.length > 0 ? submissions.map(sub => (
                        <div key={sub.id} className="bg-secondary p-3 rounded-md flex justify-between items-center">
                            <p className="font-semibold">{sub.studentName}</p>
                            <p className={`font-bold text-lg ${sub.score >= 80 ? 'text-green-400' : sub.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sub.score}%</p>
                        </div>
                    )) : <p className="text-sm text-muted-foreground text-center">No submissions yet.</p>}
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl">My Tests ({tests.length})</h3>
                <button onClick={() => setView('create')} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold flex items-center gap-2"><Plus size={16}/> Create Test</button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {tests.map(test => (
                    <div key={test.id} className="bg-secondary p-3 rounded-md">
                        <p className="font-semibold">{test.title}</p>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{test.subject} - {test.questions.length} questions</span>
                            <button onClick={() => viewResults(test)} className="px-3 py-1 bg-accent rounded-md text-xs">View Results</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const TestsView: React.FC = () => {
    const [user, loading] = useDemoUser();

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;
    if (!user) return <div className="text-center text-muted-foreground">Could not load user data. Please ensure you are in demo mode.</div>;

    return user.role === 'teacher' ? <TeacherTestsView user={user} /> : <StudentTestsView user={user} />;
};

export default TestsView;