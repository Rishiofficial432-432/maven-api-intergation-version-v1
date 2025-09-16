import React, { useState } from 'react';
import { GeneratedCurriculum, CurriculumWeek } from '../types';
import { Wand2, Loader, UploadCloud, FileText, BookOpen, Lightbulb, ArrowLeft } from 'lucide-react';
import { geminiAI } from './gemini';
import { useToast } from './Toast';
import { Type } from '@google/genai';

// Make the simulation more generic
const simulateFileExtraction = async (file: File): Promise<string> => {
    // In a real app, this would involve a library like PDF.js or a PPTX parser.
    // For this client-side simulation, we'll return a generic summary based on the file name.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    return `The document, "${file.name}", is assumed to be a comprehensive course material (textbook, presentation, etc.). The content covers various topics as outlined in the provided index. It likely includes detailed explanations, examples, and exercises related to the subject matter.`;
};


const CurriculumRoadmap: React.FC<{ weeks: CurriculumWeek[] }> = ({ weeks }) => {
    const nodeColors = [
        'bg-sky-400', 'bg-teal-400', 'bg-rose-400', 'bg-amber-400',
        'bg-indigo-400', 'bg-lime-400', 'bg-pink-400', 'bg-cyan-400',
        'bg-purple-400', 'bg-green-400', 'bg-red-400', 'bg-blue-400'
    ];

    const nodePositions = [
        { top: '4%', left: '20%', tooltip: 'top' }, 
        { top: '4%', left: '50%', tooltip: 'top' }, 
        { top: '4%', left: '80%', tooltip: 'top' },
        { top: '47.5%', left: '70%', tooltip: 'bottom' }, 
        { top: '47.5%', left: '45%', tooltip: 'bottom' }, 
        { top: '47.5%', left: '20%', tooltip: 'bottom' },
        { top: '44.5%', left: '30%', tooltip: 'top' }, 
        { top: '44.5%', left: '55%', tooltip: 'top' }, 
        { top: '44.5%', left: '80%', tooltip: 'top' },
        { top: '87.5%', left: '70%', tooltip: 'bottom' }, 
        { top: '87.5%', left: '45%', tooltip: 'bottom' }, 
        { top: '87.5%', left: '15%', tooltip: 'bottom' },
    ];

    const roadPath = "M 50 70 H 800 C 950 70, 950 150, 800 150 H 200 C 50 150, 50 230, 200 230 H 800 C 950 230, 950 310, 800 310 H 150";

    return (
        <div 
            className="w-full max-w-6xl mx-auto my-4 p-4 rounded-xl shadow-lg bg-card"
            style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)',
                backgroundSize: '20px 20px',
            }}
        >
            <div className="relative h-[400px]">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
                    {/* Road shadow/border */}
                    <path
                        d={roadPath}
                        fill="none"
                        stroke="hsl(var(--card))"
                        strokeWidth="38"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Main road surface */}
                    <path
                        d={roadPath}
                        fill="none"
                        stroke="#27272a"
                        strokeWidth="30"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Dashed center line */}
                    <path
                        d={roadPath}
                        fill="none"
                        strokeWidth="2"
                        strokeDasharray="15 15"
                        style={{ stroke: 'hsl(var(--border))' }}
                    />
                </svg>

                <div className="absolute" style={{ top: '17.5%', left: '2%' }}>
                    <div className="w-20 h-20 rounded-full bg-secondary border-4 border-border flex items-center justify-center font-bold text-lg shadow-lg -translate-x-1/2 -translate-y-1/2">
                        START
                    </div>
                </div>

                <div className="absolute" style={{ top: '77.5%', left: '12%' }}>
                     <div className="w-20 h-20 rounded-full bg-secondary border-4 border-border flex items-center justify-center font-bold text-lg shadow-lg -translate-x-1/2 -translate-y-1/2">
                        FINISH
                    </div>
                </div>

                {/* Week nodes */}
                {weeks.map((week, index) => {
                    const pos = nodePositions[index % nodePositions.length];
                    return (
                        <div
                            key={week.week}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group"
                            style={{top: pos.top, left: pos.left}}
                        >
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-lg cursor-pointer transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl border-4 border-card ${nodeColors[index % nodeColors.length]}`}>
                                {week.week}
                            </div>
                            <div className={`absolute w-48 p-3 bg-popover border border-border text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center transform -translate-x-1/2 left-1/2 ${pos.tooltip === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'}`}>
                                <p className="font-bold text-primary">Week {week.week}: {week.topic}</p>
                                <p className="text-muted-foreground mt-1">{week.assignment}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const AICurriculumGenerator: React.FC = () => {
    const [courseFile, setCourseFile] = useState<File | null>(null);
    const [indexText, setIndexText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [curriculum, setCurriculum] = useState<GeneratedCurriculum | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [viewMode, setViewMode] = useState<'form' | 'curriculum' | 'roadmap'>('form');
    const toast = useToast();

    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];
            const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];
            if (acceptedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt')) {
                setCourseFile(file);
            } else {
                toast.error("Please upload a valid PDF or PowerPoint file.");
            }
        }
    };

    const handleGenerate = async () => {
        if (!courseFile || !indexText.trim()) {
            toast.error("Please upload a document and provide the index/table of contents.");
            return;
        }
        if (!geminiAI) {
            toast.error("AI features are disabled. Please configure your API key in settings.");
            return;
        }

        setIsGenerating(true);
        setCurriculum(null);
        setViewMode('form');

        try {
            const simulatedFileContent = await simulateFileExtraction(courseFile);
            const prompt = `You are an expert curriculum designer for a university. Your task is to create a detailed, 12-week semester curriculum based on a course document.

CONTEXT:
- Document Name: ${courseFile.name}
- Document Summary: ${simulatedFileContent}
- Document Index/Table of Contents:
---
${indexText}
---

INSTRUCTIONS:
Based on all the provided context, generate a comprehensive 12-week curriculum. The curriculum should be logically sequenced, starting with foundational concepts and progressing to more advanced topics.
Your response MUST be a single JSON object that adheres to the provided schema. Do not include any text outside of the JSON object.
`;
            
            const schema = {
                type: Type.OBJECT,
                properties: {
                    courseTitle: { type: Type.STRING, description: "A suitable title for the course based on the document." },
                    courseDescription: { type: Type.STRING, description: "A brief, engaging description of the course." },
                    learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-5 key learning objectives for students." },
                    weeklyBreakdown: {
                        type: Type.ARRAY,
                        description: "A breakdown of the 12-week semester.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                week: { type: Type.NUMBER },
                                topic: { type: Type.STRING, description: "The main topic for the week." },
                                keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of key concepts to be covered." },
                                reading: { type: Type.STRING, description: "The assigned reading from the document (e.g., 'Chapters 1-2' or 'Slides 1-50')." },
                                assignment: { type: Type.STRING, description: "A relevant assignment or activity for the week." },
                            }
                        }
                    }
                }
            };

            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema }
            });

            const jsonStr = response.text.trim();
            const parsedResult: GeneratedCurriculum = JSON.parse(jsonStr);
            setCurriculum(parsedResult);
            setViewMode('curriculum');
            toast.success("Curriculum generated successfully!");

        } catch (error: any) {
            console.error("Curriculum generation failed:", error);
            toast.error(`Failed to generate curriculum: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartOver = () => {
        setCourseFile(null);
        setIndexText('');
        setCurriculum(null);
        setViewMode('form');
    };

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Column */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                <div className="flex justify-between items-start">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Lightbulb /> AI Curriculum Generator</h2>
                    {viewMode !== 'form' && (
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
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Loader className="w-12 h-12 animate-spin text-primary mb-4" />
                        <p className="text-lg font-semibold">Generating your curriculum...</p>
                        <p>This may take a moment.</p>
                    </div>
                ) : viewMode === 'curriculum' && curriculum ? (
                    <div className="animate-fade-in-up space-y-6">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h2 className="text-3xl font-bold text-primary">{curriculum.courseTitle}</h2>
                                <p className="text-muted-foreground mt-1">{curriculum.courseDescription}</p>
                            </div>
                            <button
                                onClick={() => setViewMode('roadmap')}
                                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-accent flex items-center gap-2 flex-shrink-0"
                            >
                                <Wand2 size={16}/> Gen Roadmap
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
                ) : viewMode === 'roadmap' && curriculum ? (
                    <div className="animate-fade-in-up h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-primary">Visual Roadmap</h2>
                            <button
                                onClick={() => setViewMode('curriculum')}
                                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-accent flex items-center gap-2"
                            >
                                <ArrowLeft size={16} /> Back to Details
                            </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <CurriculumRoadmap weeks={curriculum.weeklyBreakdown} />
                        </div>
                    </div>
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


const CurriculumView: React.FC = () => {
    return <AICurriculumGenerator />;
};

export default CurriculumView;
