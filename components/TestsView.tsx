import React, { useState, useEffect, useCallback } from 'react';
import { PortalUser, Test, TestQuestion, TestSubmission, QuestionType } from '../types';
import * as LocalPortal from './portal-db';
import { useToast } from './Toast';
import { Loader, Plus, Trash2, Send, ChevronLeft, Check, X, CheckSquare, Clock, FileText, Wand2, UploadCloud } from 'lucide-react';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import SimulatedProgressBar from './SimulatedProgressBar';

// For the demo, we need to get the current user from the demo login logic.
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


const TestTaker: React.FC<{ test: Test, student: PortalUser, onFinish: () => void }> = ({ test, student, onFinish }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<(number | string | null)[]>(Array(test.questions.length).fill(null));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const handleAnswerSelect = (optionIndex: number) => {
        setAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[currentQuestionIndex] = optionIndex;
            return newAnswers;
        });
    };
    
    const handleTextAnswerChange = (text: string) => {
         setAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[currentQuestionIndex] = text;
            return newAnswers;
        });
    };

    const handleSubmit = async () => {
        if (answers.some(a => a === null || a === '')) {
            toast.error("Please answer all questions before submitting.");
            return;
        }
        
        setIsSubmitting(true);
        let correctCount = 0;
        let autoGradedCount = 0;

        test.questions.forEach((q, i) => {
            if (q.type === 'MCQ') {
                autoGradedCount++;
                if (q.correctAnswerIndex === answers[i]) {
                    correctCount++;
                }
            } else if (q.type === 'Fill') {
                autoGradedCount++;
                const correctAnswer = q.correctAnswer.trim().toLowerCase();
                const studentAnswer = (answers[i] as string || '').trim().toLowerCase();
                if (correctAnswer === studentAnswer) {
                    correctCount++;
                }
            }
        });
        
        const score = autoGradedCount > 0 ? Math.round((correctCount / autoGradedCount) * 100) : 100; // If no auto-graded, score 100
        
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
            toast.success(`Test submitted! Your auto-graded score: ${score}%`);
            onFinish();
        } catch (e: any) {
            toast.error(`Submission failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
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
                        {currentQuestion.type === 'MCQ' && currentQuestion.options.map((option, i) => (
                             <button key={i} onClick={() => handleAnswerSelect(i)}
                                className={`w-full text-left p-3 rounded-md border-2 transition-colors flex items-center justify-between ${answers[currentQuestionIndex] === i ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/80'}`}>
                                <span>{option}</span>
                                {answers[currentQuestionIndex] === i && <Check size={20} className="text-primary" />}
                            </button>
                        ))}
                        {(currentQuestion.type === 'SAQ' || currentQuestion.type === 'LAQ') && (
                            <textarea value={answers[currentQuestionIndex] as string || ''} onChange={(e) => handleTextAnswerChange(e.target.value)}
                                className="w-full bg-input p-2 rounded-md" rows={currentQuestion.type === 'LAQ' ? 6 : 3} />
                        )}
                         {currentQuestion.type === 'Fill' && (
                            <input type="text" value={answers[currentQuestionIndex] as string || ''} onChange={(e) => handleTextAnswerChange(e.target.value)}
                                className="w-full bg-input p-2 rounded-md" placeholder="Your answer..." />
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <button onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))} disabled={currentQuestionIndex === 0}
                        className="px-4 py-2 bg-secondary rounded-md disabled:opacity-50">Previous</button>
                    <span>Question {currentQuestionIndex + 1} of {test.questions.length}</span>
                    {currentQuestionIndex === test.questions.length - 1 ? (
                        <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2 disabled:opacity-50">
                             {isSubmitting ? (
                                <><Loader size={16} className="animate-spin" /> Submitting...</>
                            ) : (
                                <><Send size={16} /> Submit</>
                            )}
                        </button>
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

const simulateFileExtraction = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `Summary of "${file.name}": This document contains key concepts related to its title, including definitions, examples, and main arguments suitable for generating test questions.`;
};


const CreateTestWithAI: React.FC<{ teacher: PortalUser, onBack: () => void, onTestCreated: () => void }> = ({ teacher, onBack, onTestCreated }) => {
    const [step, setStep] = useState<'config' | 'review'>('config');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const toast = useToast();

    // Config state
    const [file, setFile] = useState<File | null>(null);
    const [difficulty, setDifficulty] = useState(2);
    const [counts, setCounts] = useState({ MCQ: 5, SAQ: 3, LAQ: 1, Fill: 3 });

    // Review state
    const [testDetails, setTestDetails] = useState<{ title: string, subject: string, dueDate: string }>({ title: '', subject: '', dueDate: '' });
    const [questions, setQuestions] = useState<TestQuestion[]>([]);

    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) setFile(files[0]);
    };

    const handleGenerate = async () => {
        if (!file || !geminiAI) {
            toast.error("Please upload a file and ensure AI is configured.");
            return;
        }
        setIsLoading(true);
        const fileSummary = await simulateFileExtraction(file);
        
        const prompt = `Based on the following document summary, generate a test.
Document Summary: ${fileSummary}
Difficulty: ${['Easy', 'Medium', 'Hard'][difficulty-1]}
Required Questions:
- ${counts.MCQ} Multiple-Choice Questions
- ${counts.SAQ} Short Answer Questions
- ${counts.LAQ} Long Answer Questions
- ${counts.Fill} Fill-in-the-Blank Questions
Return a single JSON object.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['MCQ', 'SAQ', 'LAQ', 'Fill'] },
                            questionText: { type: Type.STRING },
                            // MCQ specific
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswerIndex: { type: Type.NUMBER },
                            // SAQ/LAQ specific
                            modelAnswer: { type: Type.STRING },
                            // Fill specific
                            correctAnswer: { type: Type.STRING },
                        }
                    }
                }
            }
        };

        try {
            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: schema }});
            const result = JSON.parse(response.text);
            const generatedQs = (result.questions || []).map((q: any) => ({ ...q, id: crypto.randomUUID() }));
            setQuestions(generatedQs);
            setTestDetails({ title: `Test for ${file.name.split('.')[0]}`, subject: 'Auto-Generated', dueDate: '' });
            setStep('review');
        } catch (e: any) {
            toast.error(`AI generation failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePublish = async () => {
        const test: Test = {
            id: crypto.randomUUID(),
            teacherId: teacher.id,
            title: testDetails.title,
            subject: testDetails.subject,
            dueDate: testDetails.dueDate,
            questions: questions,
        };
        await LocalPortal.createTest(test);
        toast.success("Test published successfully!");
        onTestCreated();
    };

    if (isLoading) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
                <FileText size={48} className="text-primary mb-4 animate-pulse" />
                <h2 className="text-2xl font-bold">Generating Test Questions...</h2>
                <p className="text-muted-foreground mt-2 mb-6 max-w-md">The AI is analyzing your document and creating questions based on the selected difficulty.</p>
                <div className="w-full max-w-sm">
                    <SimulatedProgressBar isProcessing={isLoading} />
                </div>
            </div>
        );
    }

    if (step === 'review') {
        return (
            <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
                <button onClick={() => setStep('config')} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back to Config</button>
                <h3 className="text-xl font-bold mb-4">Review & Finalize Test</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input type="text" value={testDetails.title} onChange={e => setTestDetails(d => ({...d, title: e.target.value}))} placeholder="Test Title" className="w-full bg-input p-2 rounded-md"/>
                    <input type="text" value={testDetails.subject} onChange={e => setTestDetails(d => ({...d, subject: e.target.value}))} placeholder="Subject" className="w-full bg-input p-2 rounded-md"/>
                    <input type="date" value={testDetails.dueDate} onChange={e => setTestDetails(d => ({...d, dueDate: e.target.value}))} className="w-full bg-input p-2 rounded-md"/>
                </div>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto p-2">
                    {questions.map((q, qIndex) => (
                        <div key={q.id} className="bg-secondary p-3 rounded-lg">
                            <p className="font-semibold">Q{qIndex+1} ({q.type}): {q.questionText}</p>
                            {/* Further UI for editing options can be added here */}
                        </div>
                    ))}
                </div>
                <button onClick={handlePublish} className="mt-4 w-full p-3 bg-primary text-primary-foreground rounded-md font-bold">Publish Test</button>
            </div>
        );
    }


    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back to Tests</button>
            <div className="space-y-6">
                <div>
                     <label className="font-semibold text-muted-foreground block mb-2">1. Upload Study Material</label>
                     <div onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files);}}
                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border'}`}
                        onClick={() => document.getElementById('test-file-upload')?.click()}>
                        <input type="file" id="test-file-upload" className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                        <UploadCloud size={32} className="text-muted-foreground mb-2"/>
                        {file ? <p className="text-sm font-semibold text-primary">{file.name}</p> : <p className="text-sm text-muted-foreground">Drop PDF, PPTX, or DOCX</p>}
                     </div>
                </div>
                <div>
                    <label className="font-semibold text-muted-foreground block mb-2">2. Set Difficulty: {['Easy', 'Medium', 'Hard'][difficulty-1]}</label>
                    <input type="range" min="1" max="3" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full" />
                </div>
                <div>
                    <label className="font-semibold text-muted-foreground block mb-2">3. Configure Question Types</label>
                    <div className="grid grid-cols-2 gap-4">
                        {(['MCQ', 'SAQ', 'LAQ', 'Fill'] as QuestionType[]).map(type => (
                            <div key={type} className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                                <label className="flex-1 text-sm">{type}</label>
                                <input type="number" value={counts[type]} onChange={e => setCounts(c => ({...c, [type]: Number(e.target.value)}))} min="0" className="w-16 bg-input p-1 rounded-md text-center"/>
                            </div>
                        ))}
                    </div>
                </div>
                 <button onClick={handleGenerate} disabled={isLoading || !file}
                    className="w-full mt-4 p-3 bg-primary text-primary-foreground rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                    <Wand2 size={20}/> Generate Questions with AI
                </button>
            </div>
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
        return <CreateTestWithAI teacher={user} onBack={() => setView('list')} onTestCreated={() => { setView('list'); fetchData(); }} />;
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
                <button onClick={() => setView('create')} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold flex items-center gap-2"><Plus size={16}/> Create AI Test</button>
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