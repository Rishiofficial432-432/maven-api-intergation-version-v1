import React, { useState, useEffect, useCallback } from 'react';
import { PortalUser, Test, TestQuestion, TestSubmission, UnitMaterial, QuestionType } from '../types';
import * as LocalPortal from './portal-db';
import { useToast } from './Toast';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { Loader, Plus, Trash2, Send, ChevronLeft, Check, X, CheckSquare, Clock, FileText, UploadCloud, Wand2, ArrowRight, Edit, Save } from 'lucide-react';

// For the demo, we need to get the current user from the demo login logic.
const useDemoUser = (): [PortalUser | null, boolean] => {
    const [user, setUser] = useState<PortalUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const teacher = await LocalPortal.getUserByEmail('e.reed@university.edu');
                if (teacher) { setUser(teacher); } 
                else {
                    const student = await LocalPortal.getUserByEmail('a.johnson@university.edu');
                    setUser(student);
                }
            } catch (e) { console.error("Could not fetch demo user", e); } 
            finally { setLoading(false); }
        };
        fetchUser();
    }, []);
    return [user, loading];
};

const simulateFileExtraction = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return `The document titled "${file.name}" is a study material. It includes definitions, examples, and summaries suitable for creating test questions of varying difficulties.`;
};

// --- STUDENT COMPONENTS ---

const TestTaker: React.FC<{ test: Test, student: PortalUser, onFinish: () => void }> = ({ test, student, onFinish }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<(number | string)[]>(Array(test.questions.length).fill(''));
    const toast = useToast();

    const handleAnswerSelect = (value: number | string) => {
        setAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[currentQuestionIndex] = value;
            return newAnswers;
        });
    };

    const handleSubmit = async () => {
        let unanswered = answers.some((ans, i) => ans === '' || (test.questions[i].questionType === 'mcq' && ans === -1));
        if (unanswered) {
            toast.error("Please answer all questions before submitting.");
            return;
        }
        
        let correctCount = 0;
        test.questions.forEach((q, i) => {
            if (q.questionType === 'mcq' && q.correctAnswerIndex === answers[i]) {
                correctCount++;
            }
        });
        const mcqCount = test.questions.filter(q => q.questionType === 'mcq').length;
        const score = mcqCount > 0 ? Math.round((correctCount / mcqCount) * 100) : 100; // Score 100 if no MCQs
        
        const submission: Omit<TestSubmission, 'id'> = {
            testId: test.id, studentId: student.id, studentName: student.name,
            answers, score, submittedAt: new Date().toISOString(), testTitle: test.title,
        };

        try {
            await LocalPortal.submitTest(submission);
            toast.success(`Test submitted! Your score on MCQs: ${score}%`);
            onFinish();
        } catch (e: any) { toast.error(`Submission failed: ${e.message}`); }
    };

    const currentQuestion = test.questions[currentQuestionIndex];

    const renderQuestionInput = () => {
        switch(currentQuestion.questionType) {
            case 'mcq':
                return currentQuestion.options?.map((option, i) => (
                    <button key={i} onClick={() => handleAnswerSelect(i)}
                        className={`w-full text-left p-3 rounded-md border-2 transition-colors ${answers[currentQuestionIndex] === i ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/80'}`}>
                        {option}
                    </button>
                ));
            case 'saq':
            case 'laq':
                return <textarea value={answers[currentQuestionIndex] as string} onChange={e => handleAnswerSelect(e.target.value)} rows={currentQuestion.questionType === 'saq' ? 3 : 6} className="w-full bg-input p-2 rounded-md"/>;
            case 'fill-in-the-blank':
                return <input type="text" value={answers[currentQuestionIndex] as string} onChange={e => handleAnswerSelect(e.target.value)} placeholder="Your answer here" className="w-full bg-input p-2 rounded-md"/>;
            default: return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-2xl p-6">
                <h2 className="text-2xl font-bold">{test.title}</h2>
                <div className="my-4">
                    <p className="font-semibold text-lg whitespace-pre-wrap">{currentQuestionIndex + 1}. {currentQuestion.questionText}</p>
                    <div className="space-y-2 mt-4">{renderQuestionInput()}</div>
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
        
        setPendingTests(allTests.filter(t => t.status === 'published' && !completedTestIds.has(t.id)));
        setCompletedTests(submissions);
        setLoading(false);
    }, [user.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {takingTest && <TestTaker test={takingTest} student={user} onFinish={() => { setTakingTest(null); fetchData(); }} />}
            <div className="bg-card border border-border rounded-xl p-6"><h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Clock /> Pending Tests ({pendingTests.length})</h3><div className="space-y-3 max-h-96 overflow-y-auto">{pendingTests.length > 0 ? pendingTests.map(test => (<div key={test.id} className="bg-secondary p-3 rounded-md"><p className="font-semibold">{test.title}</p><div className="flex justify-between items-center text-sm text-muted-foreground"><span>{test.subject} - Due: {test.dueDate}</span><button onClick={() => setTakingTest(test)} className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs">Start Test</button></div></div>)) : <p className="text-sm text-muted-foreground text-center">No pending tests. Great job!</p>}</div></div>
            <div className="bg-card border border-border rounded-xl p-6"><h3 className="font-bold text-xl mb-4 flex items-center gap-2"><CheckSquare/> Completed Tests ({completedTests.length})</h3><div className="space-y-3 max-h-96 overflow-y-auto">{completedTests.map(sub => (<div key={sub.id} className="bg-secondary p-3 rounded-md"><div className="flex justify-between items-center"><p className="font-semibold">{sub.testTitle}</p><p className={`font-bold text-lg ${sub.score >= 80 ? 'text-green-400' : sub.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sub.score}%</p></div></div>))}</div></div>
        </div>
    );
};

// --- TEACHER COMPONENTS ---

const TestCreator: React.FC<{ teacher: PortalUser, onFinish: () => void, testToEdit: Test | null }> = ({ teacher, onFinish, testToEdit }) => {
    const [step, setStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [materialFile, setMaterialFile] = useState<File | null>(null);
    const [formState, setFormState] = useState({ title: '', subject: '', dueDate: '', difficulty: 2 as (1 | 2 | 3), mcq: 5, saq: 3, laq: 2, fill: 2 });
    const [generatedQuestions, setGeneratedQuestions] = useState<TestQuestion[]>([]);
    const [sourceMaterialId, setSourceMaterialId] = useState<string | undefined>(undefined);
    const toast = useToast();

    useEffect(() => {
        if (testToEdit) {
            setFormState({
                title: testToEdit.title, subject: testToEdit.subject, dueDate: testToEdit.dueDate,
                difficulty: testToEdit.difficulty,
                mcq: testToEdit.questions.filter(q=>q.questionType==='mcq').length,
                saq: testToEdit.questions.filter(q=>q.questionType==='saq').length,
                laq: testToEdit.questions.filter(q=>q.questionType==='laq').length,
                fill: testToEdit.questions.filter(q=>q.questionType==='fill-in-the-blank').length,
            });
            setGeneratedQuestions(testToEdit.questions);
            setSourceMaterialId(testToEdit.sourceMaterialId);
            setStep(2); // Jump directly to review step when editing
        }
    }, [testToEdit]);

    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) setMaterialFile(files[0]);
    };

    const handleGenerate = async () => {
        if (!materialFile) { toast.error("Please upload a source material file."); return; }
        if (!geminiAI) { toast.error("AI features are disabled."); return; }
        setIsGenerating(true);
        try {
            const materialInfo = await LocalPortal.addUnitMaterial({ fileName: materialFile.name, fileType: materialFile.type, teacherId: teacher.id }, materialFile);
            setSourceMaterialId(materialInfo.id);

            const fileContent = await simulateFileExtraction(materialFile);
            const prompt = `You are an expert test creator. Based on the following document and parameters, generate a test.
Document Content Summary: ${fileContent}
Parameters:
- Difficulty: ${formState.difficulty} (1=easy, 2=medium, 3=hard)
- MCQs: ${formState.mcq}
- Short Answer Questions: ${formState.saq}
- Long Answer Questions: ${formState.laq}
- Fill-in-the-Blanks: ${formState.fill}
Response must be a JSON object with a "questions" array. For MCQs, provide 4 options and the correct index. For fill-in-the-blanks, use "___" as the placeholder.`;
            
            const schema = { type: Type.OBJECT, properties: { questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { questionType: { type: Type.STRING }, questionText: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswerIndex: { type: Type.NUMBER }, correctAnswerText: { type: Type.STRING } } } } } };

            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", responseSchema: schema } });
            const result = JSON.parse(response.text.trim());

            if (!result.questions || result.questions.length === 0) throw new Error("AI failed to generate questions.");
            setGeneratedQuestions(result.questions.map((q: any) => ({ ...q, id: crypto.randomUUID() })));
            setStep(2);

        } catch (e: any) { toast.error(`Generation failed: ${e.message}`); } 
        finally { setIsGenerating(false); }
    };

    const handleSave = async (status: 'draft' | 'published') => {
        setIsSaving(true);
        const newTest: Test = {
            id: testToEdit?.id || crypto.randomUUID(),
            title: formState.title, subject: formState.subject, dueDate: formState.dueDate,
            teacherId: teacher.id, difficulty: formState.difficulty,
            questions: generatedQuestions,
            sourceMaterialId: sourceMaterialId,
            status: status,
        };
        await LocalPortal.saveTest(newTest);
        toast.success(`Test ${status === 'draft' ? 'saved as draft' : 'published'}!`);
        setIsSaving(false);
        onFinish();
    };

    const handleQuestionTextChange = (id: string, newText: string) => {
        setGeneratedQuestions(qs => qs.map(q => q.id === id ? {...q, questionText: newText} : q));
    };

    if (step === 2) {
        return <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold mb-4">Review & Edit Test</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {generatedQuestions.map(q => (
                    <div key={q.id} className="bg-secondary p-3 rounded-lg">
                        <textarea value={q.questionText} onChange={(e) => handleQuestionTextChange(q.id, e.target.value)} className="w-full bg-input p-2 rounded-md font-semibold"/>
                        {q.questionType === 'mcq' && <div className="grid grid-cols-2 gap-2 mt-2">{q.options?.map((opt, i) => <div key={i} className={`p-2 rounded-md text-sm ${i === q.correctAnswerIndex ? 'bg-green-500/20' : ''}`}>{opt}</div>)}</div>}
                    </div>
                ))}
            </div>
            <div className="flex gap-4 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 py-2 bg-secondary rounded-md" disabled={isSaving}>Back</button>
                <button onClick={() => handleSave('draft')} className="flex-1 py-2 bg-secondary rounded-md flex items-center justify-center gap-2" disabled={isSaving}><Save size={16}/> Save Draft</button>
                <button onClick={() => handleSave('published')} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md flex items-center justify-center gap-2" disabled={isSaving}>
                    {isSaving ? <Loader className="animate-spin" /> : <><Send size={16}/> Publish Test</>}
                </button>
            </div>
        </div>;
    }

    return (
        <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up">
            <button onClick={onFinish} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back to Tests</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Config */}
                <div className="space-y-4">
                    <input type="text" value={formState.title} onChange={e => setFormState(s=>({...s, title: e.target.value}))} placeholder="Test Title" className="w-full bg-input p-2 rounded-md"/>
                    <input type="text" value={formState.subject} onChange={e => setFormState(s=>({...s, subject: e.target.value}))} placeholder="Subject" className="w-full bg-input p-2 rounded-md"/>
                    <input type="date" value={formState.dueDate} onChange={e => setFormState(s=>({...s, dueDate: e.target.value}))} className="w-full bg-input p-2 rounded-md"/>
                    <div className="p-3 bg-secondary rounded-md">
                        <label>Difficulty: {formState.difficulty}</label>
                        <div className="flex justify-around mt-2">{[1,2,3].map(d => <button key={d} onClick={()=>setFormState(s=>({...s, difficulty: d as any}))} className={`w-10 h-10 rounded-full ${formState.difficulty === d ? 'bg-primary text-primary-foreground' : 'bg-input'}`}>{d}</button>)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-secondary rounded-md"><label>MCQs</label><input type="number" value={formState.mcq} onChange={e => setFormState(s=>({...s, mcq: +e.target.value}))} className="w-full bg-input p-1 mt-1 rounded-md text-center"/></div>
                        <div className="p-2 bg-secondary rounded-md"><label>SAQs</label><input type="number" value={formState.saq} onChange={e => setFormState(s=>({...s, saq: +e.target.value}))} className="w-full bg-input p-1 mt-1 rounded-md text-center"/></div>
                        <div className="p-2 bg-secondary rounded-md"><label>LAQs</label><input type="number" value={formState.laq} onChange={e => setFormState(s=>({...s, laq: +e.target.value}))} className="w-full bg-input p-1 mt-1 rounded-md text-center"/></div>
                        <div className="p-2 bg-secondary rounded-md"><label>Fill-ins</label><input type="number" value={formState.fill} onChange={e => setFormState(s=>({...s, fill: +e.target.value}))} className="w-full bg-input p-1 mt-1 rounded-md text-center"/></div>
                    </div>
                </div>
                {/* Right Column: Upload & Generate */}
                <div className="flex flex-col">
                    <div onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files); }}
                        className={`flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border'}`}
                        onClick={() => document.getElementById('material-upload')?.click()}>
                        <input type="file" id="material-upload" className="hidden" accept=".pdf,.pptx,.ppt,.docx,.doc" onChange={(e) => handleFileChange(e.target.files)} />
                        <UploadCloud size={32} className="text-muted-foreground mb-2"/>
                        {materialFile ? <p className="text-sm font-semibold text-primary">{materialFile.name}</p> : <p className="text-sm text-muted-foreground text-center">Drop source material here, or click to upload</p>}
                    </div>
                    <button onClick={handleGenerate} disabled={isGenerating || !materialFile} className="mt-4 w-full p-3 bg-primary text-primary-foreground rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                        {isGenerating ? <><Loader className="animate-spin"/> Generating...</> : <><Wand2 /> Generate with AI <ArrowRight/></>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TeacherTestsView: React.FC<{ user: PortalUser }> = ({ user }) => {
    const [view, setView] = useState<'list' | 'create' | 'results'>('list');
    const [tests, setTests] = useState<Test[]>([]);
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [editingTest, setEditingTest] = useState<Test | null>(null);
    const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

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

    const handleEditDraft = (test: Test) => {
        setEditingTest(test);
        setView('create');
    };

    const handleDeleteDraft = async (testId: string) => {
        if (window.confirm("Are you sure you want to delete this draft?")) {
            await LocalPortal.deleteTest(testId);
            toast.success("Draft deleted.");
            fetchData();
        }
    };
    
    const drafts = tests.filter(t => t.status === 'draft');
    const publishedTests = tests.filter(t => t.status === 'published' || t.status === undefined);

    if (loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>;

    if (view === 'create') {
        return <TestCreator teacher={user} testToEdit={editingTest} onFinish={() => { setView('list'); setEditingTest(null); fetchData(); }} />;
    }
    
    if (view === 'results' && selectedTest) {
        return <div className="bg-card border border-border rounded-xl p-6 animate-fade-in-up"><button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-primary mb-4"><ChevronLeft size={16}/> Back to Tests</button><h3 className="font-bold text-xl mb-4">Results for: {selectedTest.title}</h3><div className="space-y-3 max-h-96 overflow-y-auto">{submissions.length > 0 ? submissions.map(sub => (<div key={sub.id} className="bg-secondary p-3 rounded-md flex justify-between items-center"><p className="font-semibold">{sub.studentName}</p><p className={`font-bold text-lg ${sub.score >= 80 ? 'text-green-400' : sub.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sub.score}%</p></div>)) : <p className="text-sm text-muted-foreground text-center">No submissions yet.</p>}</div></div>;
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
                 <h3 className="font-bold text-xl mb-4">My Drafts ({drafts.length})</h3>
                 <div className="space-y-3 max-h-96 overflow-y-auto">
                     {drafts.map(test => (
                        <div key={test.id} className="bg-secondary p-3 rounded-md">
                            <p className="font-semibold">{test.title}</p>
                            <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
                                <span>{test.subject}</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditDraft(test)} className="p-1.5 hover:bg-accent rounded-md"><Edit size={14}/></button>
                                    <button onClick={() => handleDeleteDraft(test.id)} className="p-1.5 hover:bg-accent text-destructive rounded-md"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
             <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl">Published Tests ({publishedTests.length})</h3><button onClick={() => setView('create')} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold flex items-center gap-2"><Plus size={16}/> Create Test</button></div>
                <div className="space-y-3 max-h-96 overflow-y-auto">{publishedTests.map(test => (<div key={test.id} className="bg-secondary p-3 rounded-md"><p className="font-semibold">{test.title}</p><div className="flex justify-between items-center text-sm text-muted-foreground"><span>{test.subject} - {test.questions.length} questions</span><button onClick={() => viewResults(test)} className="px-3 py-1 bg-accent rounded-md text-xs">View Results</button></div></div>))}</div>
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