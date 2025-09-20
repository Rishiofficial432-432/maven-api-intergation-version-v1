import React, { useState, useEffect, useCallback } from 'react';
import { PortalUser, Test, TestQuestion, TestSubmission, QuestionType } from '../types';
import * as LocalPortal from './portal-db';
import { useToast } from './Toast';
import { Loader, Plus, Trash2, Send, ChevronLeft, CheckSquare, Clock, FileText, Wand2, Upload, Settings, Edit, Save, List, Type as TypeIcon, Hash, Book } from 'lucide-react';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';


// --- HOOKS & HELPERS ---

const useDemoUser = (): [PortalUser | null, boolean] => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const teacher = await LocalPortal.getUserByEmail('e.reed@university.edu');
                if (teacher) { setUser(teacher); }
                else { const student = await LocalPortal.getUserByEmail('a.johnson@university.edu'); setUser(student); }
            } catch (e) { console.error("Could not fetch demo user", e); }
            finally { setLoading(false); }
        };
        fetchUser();
    }, []);
    return [user, loading];
};

const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        // This is a simulation for client-side only. A real implementation would use
        // libraries like PDF.js for PDFs, mammoth.js for DOCX, etc. on a server.
        // For now, we just read it as text and add a note about the file type.
        const reader = new FileReader();
        reader.onload = () => resolve(`File Content from ${file.name}:\n\n${reader.result}`);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};


// --- STUDENT COMPONENTS ---

const TestTaker: React.FC<{ test: Test, student: PortalUser, onFinish: () => void }> = ({ test, student, onFinish }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<{ [key: string]: string }>({});
    const toast = useToast();

    const handleAnswerChange = (questionId: string, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleSubmit = async () => {
        if (Object.keys(answers).length < test.questions.length) {
            toast.error("Please answer all questions before submitting.");
            return;
        }
        
        let correctCount = 0;
        let gradableQuestions = 0;
        test.questions.forEach(q => {
            if (q.type === 'mcq' || q.type === 'fillInBlanks') {
                gradableQuestions++;
                const studentAnswer = answers[q.id]?.trim().toLowerCase();
                const correctAnswer = q.correctAnswer.trim().toLowerCase();
                if (studentAnswer === correctAnswer) {
                    correctCount++;
                }
            }
        });

        const score = gradableQuestions > 0 ? Math.round((correctCount / gradableQuestions) * 100) : 100; // 100 if no gradable questions
        
        const submission: Omit<TestSubmission, 'id'> = {
            testId: test.id, studentId: student.id, studentName: student.name,
            answers, score, submittedAt: new Date().toISOString(), testTitle: test.title,
        };

        try {
            await LocalPortal.submitTest(submission);
            toast.success(`Test submitted! Your score: ${score}%`);
            onFinish();
        } catch (e: any) { toast.error(`Submission failed: ${e.message}`); }
    };

    const currentQuestion = test.questions[currentQuestionIndex];

    const renderQuestionInput = (q: TestQuestion) => {
        switch (q.type) {
            case 'mcq':
                return q.options?.map((opt, i) => (
                    <button key={i} onClick={() => handleAnswerChange(q.id, opt)}
                        className={`w-full text-left p-3 rounded-md border-2 transition-colors ${answers[q.id] === opt ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/80'}`}>
                        {opt}
                    </button>
                ));
            case 'saq':
                return <textarea value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} rows={3} className="w-full bg-input p-2 rounded-md" placeholder="Your answer..."/>
            case 'laq':
                return <textarea value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} rows={6} className="w-full bg-input p-2 rounded-md" placeholder="Your detailed answer..."/>
            case 'fillInBlanks':
                return <input type="text" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} className="w-full bg-input p-2 rounded-md" placeholder="Your answer..."/>
            default: return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-2xl p-6">
                <h2 className="text-2xl font-bold">{test.title}</h2>
                <div className="my-4">
                    <p className="font-semibold text-lg">{currentQuestionIndex + 1}. {currentQuestion.questionText}</p>
                    <div className="space-y-2 mt-4">{renderQuestionInput(currentQuestion)}</div>
                </div>
                <div className="flex justify-between items-center">
                    <button onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))} disabled={currentQuestionIndex === 0}
                        className="px-4 py-2 bg-secondary rounded-md disabled:opacity-50">Previous</button>
                    <span>Question {currentQuestionIndex + 1} of {test.questions.length}</span>
                    {currentQuestionIndex === test.questions.length - 1 ? (
                        <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2"><Send size={16}/> Submit</button>
                    ) : (
                        <button onClick={() => setCurrentQuestionIndex(i => Math.min(test.questions.length - 1, i + 1))} className="px-4 py-2 bg-secondary rounded-md">Next</button>
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
        const allTests = (await LocalPortal.getAllFromStore<Test>('tests')).filter(t => t.status === 'published');
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
            <div className="bg-card border border-border rounded-xl p-6"><h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Clock /> Pending Tests ({pendingTests.length})</h3><div className="space-y-3 max-h-96 overflow-y-auto">{pendingTests.length > 0 ? pendingTests.map(test => (<div key={test.id} className="bg-secondary p-3 rounded-md"><p className="font-semibold">{test.title}</p><div className="flex justify-between items-center text-sm text-muted-foreground"><span>Difficulty: {test.difficulty}</span><button onClick={() => setTakingTest(test)} className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs">Start Test</button></div></div>)) : <p className="text-sm text-muted-foreground text-center">No pending tests. Great job!</p>}</div></div>
            <div className="bg-card border border-border rounded-xl p-6"><h3 className="font-bold text-xl mb-4 flex items-center gap-2"><CheckSquare/> Completed Tests ({completedTests.length})</h3><div className="space-y-3 max-h-96 overflow-y-auto">{completedTests.map(sub => (<div key={sub.id} className="bg-secondary p-3 rounded-md"><div className="flex justify-between items-center"><p className="font-semibold">{sub.testTitle}</p><p className={`font-bold text-lg ${sub.score >= 80 ? 'text-green-400' : sub.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sub.score}%</p></div></div>))}</div></div>
        </div>
    );
};


// --- TEACHER COMPONENTS ---

interface QuestionDistribution { mcq: number; saq: number; laq: number; fillInBlanks: number; }

const TestCreator: React.FC<{ teacher: PortalUser, onBack: () => void, onTestSaved: () => void, existingTest?: Test | null }> = ({ teacher, onBack, onTestSaved, existingTest }) => {
    const [step, setStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const toast = useToast();

    // Test data state
    const [title, setTitle] = useState(existingTest?.title || '');
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourceMaterialId, setSourceMaterialId] = useState(existingTest?.sourceMaterialId);
    const [difficulty, setDifficulty] = useState<1 | 2 | 3>(existingTest?.difficulty || 1);
    const [distribution, setDistribution] = useState<QuestionDistribution>({ mcq: 5, saq: 3, laq: 1, fillInBlanks: 1 });
    const [questions, setQuestions] = useState<TestQuestion[]>(existingTest?.questions || []);
    
    useEffect(() => {
        if(existingTest) {
            setStep(2); // If editing a draft, go straight to review
        }
    }, [existingTest]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSourceFile(e.target.files[0]);
    };

    const handleGenerate = async () => {
        if (!sourceFile) { toast.error("Please upload source material."); return; }
        if (!geminiAI) { toast.error("AI features are disabled."); return; }

        setIsGenerating(true);
        try {
            const materialId = `unit-material-${crypto.randomUUID()}`;
            await LocalPortal.addUnitMaterial(materialId, sourceFile);
            setSourceMaterialId(materialId);
            
            const fileContent = await fileToText(sourceFile);
            const totalQuestions = Object.values(distribution).reduce((sum, val) => sum + val, 0);

            const prompt = `Based on the following document content, generate a test with a difficulty level of ${difficulty}/3.
The test should have a total of ${totalQuestions} questions with the following distribution:
- Multiple-Choice Questions (MCQ): ${distribution.mcq}
- Short Answer Questions (SAQ): ${distribution.saq}
- Long Answer Questions (LAQ): ${distribution.laq}
- Fill-in-the-Blanks: ${distribution.fillInBlanks}

For MCQs, provide 4 distinct options and clearly indicate the correct answer. For all questions, ensure they are relevant to the provided text.

Document Content:
---
${fileContent}
---

Your response must be a JSON object containing a single key "questions".`;
            const schema = { type: Type.OBJECT, properties: { questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, questionText: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.STRING } } } } } };

            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", responseSchema: schema } });
            
            const parsedResult = JSON.parse(response.text.trim());
            const generatedQs: TestQuestion[] = parsedResult.questions.map((q: any) => ({
                id: crypto.randomUUID(), type: q.type, questionText: q.questionText,
                options: q.options, correctAnswer: q.correctAnswer, points: difficulty
            }));
            setQuestions(generatedQs);
            setStep(2);
            toast.success("AI has generated the questions!");

        } catch (error: any) {
            toast.error(`Generation failed: ${error.message}`);
        } finally { setIsGenerating(false); }
    };
    
    const handleSave = async (status: 'draft' | 'published') => {
        if (!title.trim()) { toast.error("Test title is required."); return; }
        if (questions.length === 0) { toast.error("A test must have at least one question."); return; }
        
        const testData: Test = {
            id: existingTest?.id || crypto.randomUUID(),
            title, teacherId: teacher.id, status, difficulty, sourceMaterialId, questions,
            createdAt: existingTest?.createdAt || new Date().toISOString(),
        };
        await LocalPortal.saveTest(testData);
        toast.success(`Test ${status === 'draft' ? 'saved as draft' : 'published'}.`);
        onTestSaved();
    };

    const handleQuestionTextChange = (id: string, newText: string) => {
        setQuestions(qs => qs.map(q => q.id === id ? {...q, questionText: newText} : q));
    };

    if (step === 1) { // Configuration and Generation Step
        return (
             <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back</button>
                <h2 className="text-2xl font-bold mb-4">Create New AI-Generated Test</h2>
                <div className="space-y-4">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Test Title" className="w-full bg-input p-2 rounded-md"/>
                    <div><label className="font-semibold text-sm">Upload Source Material (PDF, TXT, etc.)</label><input type="file" onChange={handleFileChange} className="w-full text-sm mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/></div>
                    <div><label className="font-semibold text-sm">Difficulty Level: {difficulty}</label><input type="range" min="1" max="3" step="1" value={difficulty} onChange={e => setDifficulty(Number(e.target.value) as 1|2|3)} className="w-full"/></div>
                    <div>
                        <h3 className="font-semibold text-sm mb-2">Question Distribution</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {(Object.keys(distribution) as Array<keyof QuestionDistribution>).map(key => (
                                <div key={key}><label className="text-xs capitalize">{key}</label><input type="number" min="0" value={distribution[key]} onChange={e => setDistribution(d => ({...d, [key]: Number(e.target.value)}))} className="w-full bg-input p-1 rounded-md text-sm"/></div>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleGenerate} disabled={isGenerating || !sourceFile} className="w-full p-3 bg-primary text-primary-foreground rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Wand2 size={18}/> {isGenerating ? 'Generating...' : 'Generate with AI'}</button>
                </div>
             </div>
        );
    }

    if (step === 2) { // Review and Publish Step
        return (
            <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Review & Edit Test</h2>
                    <div className="flex gap-2"><button onClick={() => handleSave('draft')} className="px-4 py-2 bg-secondary rounded-md text-sm font-semibold flex items-center gap-2"><Save size={16}/> Save Draft</button><button onClick={() => handleSave('published')} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold flex items-center gap-2"><Send size={16}/> Publish</button></div>
                </div>
                 <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                    {questions.map((q, i) => (
                        <div key={q.id} className="bg-secondary p-3 rounded-lg"><p className="font-semibold text-sm">{i+1}. <input type="text" value={q.questionText} onChange={e => handleQuestionTextChange(q.id, e.target.value)} className="bg-transparent w-[95%] focus:bg-input"/></p></div>
                    ))}
                 </div>
            </div>
        )
    }

    return null;
};

const TeacherTestsView: React.FC<{ user: PortalUser }> = ({ user }) => {
    const [view, setView] = useState<'list' | 'create' | 'edit' | 'results'>('list');
    const [drafts, setDrafts] = useState<Test[]>([]);
    const [published, setPublished] = useState<Test[]>([]);
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const allTests = await LocalPortal.getAllFromStore<Test>('tests');
        setDrafts(allTests.filter(t => t.teacherId === user.id && t.status === 'draft'));
        setPublished(allTests.filter(t => t.teacherId === user.id && t.status === 'published'));
        setLoading(false);
    }, [user.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const viewResults = async (test: Test) => {
        setSelectedTest(test);
        const testSubmissions = await LocalPortal.getSubmissionsForTest(test.id);
        setSubmissions(testSubmissions);
        setView('results');
    };
    
    const handleEditDraft = (test: Test) => {
        setSelectedTest(test);
        setView('edit');
    };

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;
    
    if (view === 'create') return <TestCreator teacher={user} onBack={() => setView('list')} onTestSaved={() => { setView('list'); fetchData(); }} />;
    if (view === 'edit' && selectedTest) return <TestCreator teacher={user} onBack={() => setView('list')} onTestSaved={() => { setView('list'); fetchData(); setSelectedTest(null); }} existingTest={selectedTest} />;

    if (view === 'results' && selectedTest) {
        return (<div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up"><button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back</button><h3 className="font-bold text-xl mb-4">Results for: {selectedTest.title}</h3><div className="space-y-3 max-h-96 overflow-y-auto">{submissions.length > 0 ? submissions.map(sub => (<div key={sub.id} className="bg-secondary p-3 rounded-md flex justify-between items-center"><p className="font-semibold">{sub.studentName}</p><p className={`font-bold text-lg ${sub.score >= 80 ? 'text-green-400' : sub.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sub.score}%</p></div>)) : <p className="text-sm text-muted-foreground text-center">No submissions yet.</p>}</div></div>);
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl">My Drafts ({drafts.length})</h3><button onClick={() => setView('create')} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold flex items-center gap-2"><Plus size={16}/> Create Test</button></div>
                <div className="space-y-3 max-h-96 overflow-y-auto">{drafts.map(test => (<div key={test.id} className="bg-secondary p-3 rounded-md"><p className="font-semibold">{test.title}</p><div className="flex justify-between items-center text-sm text-muted-foreground"><span>{test.questions.length} questions</span><button onClick={() => handleEditDraft(test)} className="px-3 py-1 bg-accent rounded-md text-xs">Edit</button></div></div>))}</div>
            </div>
             <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-bold text-xl mb-4">Published Tests ({published.length})</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">{published.map(test => (<div key={test.id} className="bg-secondary p-3 rounded-md"><p className="font-semibold">{test.title}</p><div className="flex justify-between items-center text-sm text-muted-foreground"><span>{test.questions.length} questions</span><button onClick={() => viewResults(test)} className="px-3 py-1 bg-accent rounded-md text-xs">View Results</button></div></div>))}</div>
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