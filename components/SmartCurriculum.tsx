import React, { useState } from 'react';
import { GeneratedCurriculum, CurriculumWeek } from '../types';
import { Wand2, Loader, UploadCloud, FileText, BookOpen, Lightbulb, ArrowLeft, Map } from 'lucide-react';
import { useToast } from './Toast';
import SimulatedProgressBar from './SimulatedProgressBar';
import usePersistentState from './usePersistentState';

interface AICurriculumGeneratorProps {
  curriculum: GeneratedCurriculum | null;
  isGenerating: boolean;
  onGenerate: (file: File, indexText: string) => void;
  onClear: () => void;
}

// Make the simulation more generic
const simulateFileExtraction = async (file: File): Promise<string> => {
    // In a real app, this would involve a library like PDF.js or a PPTX parser.
    // For this client-side simulation, we'll return a generic summary based on the file name.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    return `The document, "${file.name}", is assumed to be a comprehensive course material (textbook, presentation, etc.). The content covers various topics as outlined in the provided index. It likely includes detailed explanations, examples, and exercises related to the subject matter.`;
};

const RoadmapView: React.FC<{ curriculum: GeneratedCurriculum }> = ({ curriculum }) => (
    <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold text-primary mb-4">{curriculum.courseTitle}</h2>
        <h3 className="text-xl font-semibold mb-6">Visual Roadmap</h3>
        <div className="relative pl-6">
            {/* The main timeline bar */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
            
            <div className="space-y-8">
                {curriculum.weeklyBreakdown.map((week, index) => (
                    <div key={week.week} className="relative">
                        <div className="absolute -left-2 top-1.5 w-5 h-5 bg-primary rounded-full ring-4 ring-card"></div>
                        <div className="pl-8">
                            <h4 className="font-bold text-primary">Week {week.week}</h4>
                            <p className="font-semibold text-foreground/90">{week.topic}</p>
                            <p className="text-sm text-muted-foreground">{week.keyConcepts.join(' • ')}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);


const AICurriculumGenerator: React.FC<AICurriculumGeneratorProps> = ({ curriculum, isGenerating, onGenerate, onClear }) => {
    const [courseFile, setCourseFile] = useState<File | null>(null);
    const [courseFileName, setCourseFileName] = usePersistentState<string | null>('maven-curriculum-filename', null);
    const [indexText, setIndexText] = usePersistentState<string>('maven-curriculum-index', '');
    const [isDragging, setIsDragging] = useState(false);
    const toast = useToast();
    
    // Derived state to manage UI flow
    const pageState = curriculum ? 'result' : 'form';
    const [outputView, setOutputView] = useState<'text' | 'roadmap'>('text');


    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];
            const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];
            if (acceptedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt')) {
                setCourseFile(file);
                setCourseFileName(file.name);
            } else {
                toast.error("Please upload a valid PDF or PowerPoint file.");
            }
        }
    };

    const handleGenerate = async () => {
        if (!courseFile) {
            toast.error("Please re-select your course document before generating.");
            return;
        }
        if (!indexText.trim()) {
            toast.error("Please provide the index/table of contents.");
            return;
        }
        onGenerate(courseFile, indexText);
    };

    const handleStartOver = () => {
        setCourseFile(null);
        setCourseFileName(null);
        setIndexText('');
        onClear();
    };
    
    const renderResult = () => {
        if (!curriculum) return null;

        if (outputView === 'roadmap') {
            return (
                <>
                    <div className="flex justify-end mb-4">
                        <button onClick={() => setOutputView('text')} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                            <ArrowLeft size={16}/> Back to Details
                        </button>
                    </div>
                    <RoadmapView curriculum={curriculum} />
                </>
            );
        }

        return (
            <div className="animate-fade-in-up space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-primary">{curriculum.courseTitle}</h2>
                        <p className="text-muted-foreground mt-1">{curriculum.courseDescription}</p>
                    </div>
                     <button onClick={() => setOutputView('roadmap')} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                        <Map size={16}/> Show Visual Roadmap
                    </button>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">Learning Objectives</h3>
                    <ul className="list-disc pl-5 space-y-1 text-foreground/90">
                        {curriculum.learningObjectives.map((obj, i) => <li key={i}>{obj}</li>)}
                    </ul>
                </div>
                <div>
                     <h3 className="text-xl font-semibold mb-4">Weekly Breakdown</h3>
                     <div className="space-y-4">
                        {curriculum.weeklyBreakdown.map(week => (
                            <div key={week.week} className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                                <h4 className="font-bold text-primary">Week {week.week}: {week.topic}</h4>
                                <p className="text-sm font-semibold mt-2">Key Concepts:</p>
                                <p className="text-sm text-muted-foreground">{week.keyConcepts.join(', ')}</p>
                                <p className="text-sm font-semibold mt-2">Reading:</p>
                                <p className="text-sm text-muted-foreground">{week.reading}</p>
                                 <p className="text-sm font-semibold mt-2">Assignment:</p>
                                <p className="text-sm text-muted-foreground">{week.assignment}</p>
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Column */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                <div className="flex justify-between items-start">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Lightbulb /> AI Curriculum Generator</h2>
                    {pageState !== 'form' && (
                        <button onClick={handleStartOver} className="text-sm text-primary hover:underline">Start Over</button>
                    )}
                </div>
                <div className="space-y-6 flex-1 flex flex-col">
                    {/* File Upload */}
                    <div>
                        <label className="font-semibold text-muted-foreground flex items-center gap-2 mb-2"><FileText size={18}/> 1. Upload Subject Document</label>
                        <div
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); handleFileChange(e.dataTransfer.files); }}
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                             <input type="file" id="file-upload" className="hidden" accept=".pdf,.pptx,.ppt" onChange={(e) => handleFileChange(e.target.files)} />
                             <UploadCloud size={32} className="text-muted-foreground mb-2"/>
                             {courseFile ? (
                                <p className="text-sm font-semibold text-primary">{courseFile.name}</p>
                             ) : courseFileName ? (
                                <>
                                    <p className="text-sm font-semibold text-primary text-center">{courseFileName}</p>
                                    <p className="text-xs text-muted-foreground text-center">(Please re-select this file to generate)</p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Drop a PDF or PPTX here, or click to select</p>
                             )}
                        </div>
                    </div>
                    {/* Index Input */}
                    <div className="flex-1 flex flex-col">
                        <label className="font-semibold text-muted-foreground flex items-center gap-2 mb-2"><BookOpen size={18}/> 2. Paste Index / Table of Contents</label>
                        <textarea
                            value={indexText}
                            onChange={(e) => setIndexText(e.target.value)}
                            placeholder="Chapter 1: Introduction..."
                            className="w-full flex-1 bg-input p-3 rounded-md resize-none border-border"
                        />
                    </div>
                </div>
                 <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !courseFile || !indexText.trim()}
                    className="mt-6 w-full bg-primary text-primary-foreground py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                >
                    {isGenerating ? <Loader className="animate-spin" /> : <Wand2 />}
                    Generate Curriculum
                </button>
            </div>
            {/* Output Column */}
            <div className="bg-card border border-border rounded-xl p-6 overflow-y-auto">
                 {isGenerating ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                        <Lightbulb size={48} className="text-primary mb-4 animate-pulse" />
                        <h2 className="text-2xl font-bold">Crafting Your Curriculum...</h2>
                        <p className="text-muted-foreground mt-2 mb-6 max-w-md">The AI is designing a week-by-week plan based on your materials.</p>
                        <div className="w-full max-w-sm">
                            <SimulatedProgressBar isProcessing={isGenerating} />
                        </div>
                    </div>
                ) : pageState === 'result' ? (
                    renderResult()
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                        <Lightbulb size={48} className="text-primary mb-4"/>
                        <h3 className="text-xl font-bold">Your Generated Curriculum Will Appear Here</h3>
                        <p className="mt-2 max-w-sm">Provide a document (PDF/PPTX) and its index, and the AI will craft a complete, week-by-week course plan for you.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const CurriculumView: React.FC<AICurriculumGeneratorProps> = (props) => {
    return <AICurriculumGenerator {...props} />;
};

export default CurriculumView;
