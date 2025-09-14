import React, { useState } from 'react';
import { GeneratedCurriculum, CurriculumWeek } from '../types';
import { Wand2, Loader, UploadCloud, FileText, BookOpen, Lightbulb } from 'lucide-react';
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


const AICurriculumGenerator: React.FC = () => {
    // Rename state to be more generic
    const [courseFile, setCourseFile] = useState<File | null>(null);
    const [indexText, setIndexText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [curriculum, setCurriculum] = useState<GeneratedCurriculum | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const toast = useToast();

    // Update file handling to accept more types
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
        // Initialize with a base structure for streaming
        setCurriculum({
            courseTitle: "Generating Title...",
            courseDescription: "",
            learningObjectives: [],
            weeklyBreakdown: [],
        });

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
Generate a comprehensive 12-week curriculum. Your response MUST be a stream of JSON objects, ONE PER LINE. Follow this exact sequence:
1.  A JSON object for the course title: \`{"courseTitle": "..."}\`
2.  A JSON object for the course description: \`{"courseDescription": "..."}\`
3.  A JSON object for the learning objectives: \`{"learningObjectives": ["...", "..."]}\`
4.  FINALLY, stream a separate JSON object for EACH of the 12 weekly breakdowns, one per line: \`{"weeklyBreakdown": {"week": 1, ...}}\`, then \`{"weeklyBreakdown": {"week": 2, ...}}\`, etc.

Do not include any text outside of the JSON objects. Each JSON object must be on its own line.`;
            
            const responseStream = await geminiAI.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            let buffer = '';
            for await (const chunk of responseStream) {
                buffer += chunk.text;
                let EOL_index;
                while ((EOL_index = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, EOL_index).trim();
                    buffer = buffer.slice(EOL_index + 1);

                    if (line) {
                        try {
                            const parsed = JSON.parse(line);
                            setCurriculum(prev => {
                                if (!prev) return null;
                                if (parsed.weeklyBreakdown) {
                                    return {
                                        ...prev,
                                        weeklyBreakdown: [...prev.weeklyBreakdown, parsed.weeklyBreakdown]
                                    };
                                }
                                return { ...prev, ...parsed };
                            });
                        } catch (e) {
                            console.warn("Could not parse streaming JSON line:", line, e);
                        }
                    }
                }
            }
            toast.success("Curriculum generated successfully!");

        } catch (error: any) {
            console.error("Curriculum generation failed:", error);
            toast.error(`Failed to generate curriculum: ${error.message}`);
            setCurriculum(null); // Clear partial results on error
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Column */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Lightbulb /> AI Curriculum Generator</h2>
                <div className="space-y-6 flex-1 flex flex-col">
                    {/* File Upload - Updated */}
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
                    Generate Full Curriculum
                </button>
            </div>
            {/* Output Column */}
            <div className="bg-card border border-border rounded-xl p-6 overflow-y-auto">
                 {isGenerating || curriculum ? (
                    <div className="animate-fade-in-up space-y-6">
                        <h2 className="text-3xl font-bold text-primary">{curriculum?.courseTitle || '...'}</h2>
                        <p className="text-muted-foreground">{curriculum?.courseDescription || 'Generating description...'}</p>
                        {curriculum?.learningObjectives && curriculum.learningObjectives.length > 0 && (
                             <div>
                                <h3 className="text-xl font-semibold mb-2">Learning Objectives</h3>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/90">
                                    {curriculum.learningObjectives.map((obj, i) => <li key={i}>{obj}</li>)}
                                </ul>
                            </div>
                        )}
                        <div>
                             <h3 className="text-xl font-semibold mb-4">Weekly Breakdown</h3>
                             <div className="space-y-4">
                                {curriculum?.weeklyBreakdown.map(week => (
                                    <div key={week.week} className="p-4 bg-secondary/50 rounded-lg border border-border/50 animate-fade-in-up">
                                        <h4 className="font-bold text-primary">Week {week.week}: {week.topic}</h4>
                                        <p className="text-sm font-semibold mt-2">Key Concepts:</p>
                                        <p className="text-sm text-muted-foreground">{week.keyConcepts.join(', ')}</p>
                                        <p className="text-sm font-semibold mt-2">Reading:</p>
                                        <p className="text-sm text-muted-foreground">{week.reading}</p>
                                         <p className="text-sm font-semibold mt-2">Assignment:</p>
                                        <p className="text-sm text-muted-foreground">{week.assignment}</p>
                                    </div>
                                ))}
                                {isGenerating && curriculum && curriculum.weeklyBreakdown.length < 12 &&
                                    <div className="p-4 bg-secondary/50 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground">
                                        <Loader className="animate-spin w-5 h-5 mr-2" /> Generating week {curriculum.weeklyBreakdown.length + 1}...
                                    </div>
                                }
                             </div>
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
