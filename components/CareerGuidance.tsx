import React, { useState, useEffect, useCallback } from 'react';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { SkillProfile, SkillAnalysis, LearningModule, Page } from '../types';
import usePersistentState from './usePersistentState';
import { Section } from './Section';
import { User, Target, BarChart, Loader, AlertTriangle, Briefcase, RefreshCcw, Edit, TrendingUp, Save, BookOpen, FileText, Bot } from 'lucide-react';
import { useToast } from './Toast';

// --- SCHEMA & HOOK ---

const skillAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        currentSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A summary of the user's current skills based on their input." },
        targetSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A summary of the skills needed for the user's aspirational role." },
        gapAnalysis: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { skill: { type: Type.STRING }, priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }, }
            },
            description: "A list of skills the user is missing, prioritized by importance for their goal."
        },
        personalizedLearningPath: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    moduleNumber: { type: Type.NUMBER },
                    title: { type: Type.STRING, description: "Title of the learning module, e.g., 'Module 1: Mastering React Fundamentals'." },
                    skillsCovered: { type: Type.ARRAY, items: { type: Type.STRING } },
                    description: { type: Type.STRING, description: "A brief overview of what this module covers." },
                    resources: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ['Article', 'Video', 'Course', 'Book', 'Documentation'] },
                                description: { type: Type.STRING, description: "A short description of the resource and why it's useful."}
                            }
                        }
                    },
                    projectIdea: { type: Type.STRING, description: "A practical project idea to apply the skills learned in this module." }
                }
            },
            description: "A step-by-step learning plan to bridge the skill gap."
        }
    }
};


const useSkillAnalyzer = () => {
  const [profile, setProfile] = usePersistentState<SkillProfile | null>('maven-skill-profile', null);
  const [analysis, setAnalysis] = usePersistentState<SkillAnalysis | null>('maven-skill-analysis-cache', null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = useCallback(async (skillProfile: SkillProfile) => {
    if (!geminiAI) {
      setError("AI features are disabled. Please configure your API key in settings.");
      return null;
    }
    setLoading(true);
    setError(null);

    try {
      const prompt = `
        You are an expert tech career coach and curriculum designer. Your task is to provide a detailed skill gap analysis and create a personalized learning path for the user.

        User's Skill Profile:
        ${JSON.stringify(skillProfile, null, 2)}

        ---
        INSTRUCTIONS:
        ---
        1.  Analyze the gap between the user's 'knownSkills'/'currentRole' and their 'skillsToLearn'/'aspirationalRole'.
        2.  Identify missing skills and prioritize them in the 'gapAnalysis' based on their importance for the target role.
        3.  Create a structured, step-by-step 'personalizedLearningPath' with numbered modules.
        4.  For each module in the path, provide a clear description, list the skills it covers, suggest a practical project idea, and recommend 2-3 specific types of learning resources (e.g., a well-known course, a key documentation page, a highly-rated book).
        
        Return ONLY a valid JSON object matching the provided schema. Do not include any text outside the JSON structure.
      `;

      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: skillAnalysisSchema }
      });

      const analysisData: SkillAnalysis = JSON.parse(response.text);
      setAnalysis(analysisData);
      return analysisData;

    } catch (err: any) {
      console.error('Error generating analysis:', err);
      setAnalysis(null);
      setError(`Failed to generate analysis: ${err.message || 'Please try again.'}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setAnalysis]);
  
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, [setAnalysis]);

  return { profile, setProfile, analysis, loading, error, generateAnalysis, clearAnalysis };
};

// --- CHILD COMPONENTS ---

interface ProfileFormProps {
  onSubmit: (data: SkillProfile) => void;
  initialData?: SkillProfile;
  loading: boolean;
  error: string | null;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ onSubmit, initialData, loading, error }) => {
  const [formData, setFormData] = useState<Omit<SkillProfile, 'id' | 'createdAt'>>({
    currentRole: initialData?.currentRole || '',
    aspirationalRole: initialData?.aspirationalRole || '',
    knownSkills: initialData?.knownSkills || [],
    skillsToLearn: initialData?.skillsToLearn || [],
  });

  const handleChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: SkillProfile = { ...formData, id: initialData?.id || crypto.randomUUID(), createdAt: initialData?.createdAt || new Date().toISOString() };
    onSubmit(profile);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Section title="Skill Analyzer Profile">
        <p className="text-card-foreground/80 -mt-4 mb-6">Tell us about your current skills and future goals. The AI will generate a personalized learning path to help you bridge the gap.</p>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-primary"><User size={20}/> Your Roles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">Current Role / Field of Study</label><input type="text" value={formData.currentRole} onChange={e => handleChange('currentRole', e.target.value)} placeholder="e.g., B.Tech Student, Junior Web Developer" className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div><label className="text-sm text-muted-foreground">Aspirational Role / Goal</label><input type="text" value={formData.aspirationalRole} onChange={e => handleChange('aspirationalRole', e.target.value)} placeholder="e.g., AI/ML Engineer, Senior React Developer" className="w-full bg-input p-2 rounded-md mt-1" required /></div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-primary"><Target size={20}/> Your Skills</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">Skills You Know</label><textarea value={formData.knownSkills.join(', ')} onChange={e => handleChange('knownSkills', e.target.value.split(',').map(s => s.trim()))} placeholder="e.g., Python, JavaScript, HTML, CSS" className="w-full bg-input p-2 rounded-md mt-1 h-24" /></div>
              <div><label className="text-sm text-muted-foreground">Skills You Want to Learn</label><textarea value={formData.skillsToLearn.join(', ')} onChange={e => handleChange('skillsToLearn', e.target.value.split(',').map(s => s.trim()))} placeholder="e.g., React, TensorFlow, SQL, AWS" className="w-full bg-input p-2 rounded-md mt-1 h-24" /></div>
            </div>
          </div>
          {error && <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md"><AlertTriangle size={16}/> {error}</div>}
          <button type="submit" disabled={loading} className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95">
            {loading ? <><Loader className="animate-spin"/> Analyzing...</> : <><TrendingUp size={18}/> Analyze My Skill Gap</>}
          </button>
        </form>
      </Section>
    </div>
  );
};

interface AnalysisViewProps {
  analysis: SkillAnalysis;
  onBack: () => void;
  onRegenerate: () => void;
  onNewNote: (title: string, content: string) => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis, onBack, onRegenerate, onNewNote }) => {
    const toast = useToast();
    const handleSavePath = (module: LearningModule) => {
        const title = `Learning Module: ${module.title}`;
        let content = `
            <h2>${module.title}</h2>
            <p><strong>Module Number:</strong> ${module.moduleNumber}</p>
            <p><strong>Description:</strong> ${module.description}</p>
            <h3>Skills Covered:</h3>
            <ul>${module.skillsCovered.map(skill => `<li>${skill}</li>`).join('')}</ul>
            <h3>Recommended Resources:</h3>
            <ul>${module.resources.map(res => `<li><strong>${res.title} (${res.type}):</strong> ${res.description}</li>`).join('')}</ul>
            <h3>Project Idea:</h3>
            <p>${module.projectIdea}</p>
        `;
        onNewNote(title, content);
        toast.success(`Module "${module.title}" saved to notes!`);
    };

    const getPriorityClass = (priority: 'High' | 'Medium' | 'Low') => {
        if (priority === 'High') return 'bg-red-500/20 text-red-300';
        if (priority === 'Medium') return 'bg-yellow-500/20 text-yellow-300';
        return 'bg-green-500/20 text-green-300';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <h1 className="text-3xl font-bold text-foreground">Your Personalized Learning Path</h1>
                <div className="flex-shrink-0 flex items-center gap-2">
                    <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"><Edit size={14}/> Edit Profile</button>
                    <button onClick={onRegenerate} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"><RefreshCcw size={14}/> Regenerate</button>
                </div>
            </div>
            <Section title={<><BarChart size={24}/> Skill Gap Analysis</>}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 not-prose">
                    <div>
                        <h4 className="font-semibold mb-2">Current Skills</h4>
                        <div className="flex flex-wrap gap-2">{analysis.currentSkills.map(s => <span key={s} className="px-2 py-1 text-xs bg-secondary rounded-full">{s}</span>)}</div>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Target Skills</h4>
                        <div className="flex flex-wrap gap-2">{analysis.targetSkills.map(s => <span key={s} className="px-2 py-1 text-xs bg-primary/20 text-primary rounded-full">{s}</span>)}</div>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2">Skills to Develop</h4>
                        <div className="flex flex-wrap gap-2">{analysis.gapAnalysis.map(g => <span key={g.skill} className={`px-2 py-1 text-xs rounded-full ${getPriorityClass(g.priority)}`}>{g.skill} ({g.priority})</span>)}</div>
                    </div>
                </div>
            </Section>
            <Section title={<><Briefcase size={24}/> Learning Modules</>}>
                <div className="space-y-4 not-prose">
                    {analysis.personalizedLearningPath.map((module) => (
                        <div key={module.moduleNumber} className="bg-secondary/50 p-4 rounded-lg border border-border/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-primary">Module {module.moduleNumber}: {module.title}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                                </div>
                                <button onClick={() => handleSavePath(module)} className="flex-shrink-0 ml-4 flex items-center gap-1.5 px-2.5 py-1 text-xs bg-accent text-accent-foreground rounded-md hover:bg-accent/80"><Save size={12}/> Save Module</button>
                            </div>
                            <div className="mt-3">
                                <h5 className="font-semibold text-sm mb-1">Skills Covered:</h5>
                                <div className="flex flex-wrap gap-2">{module.skillsCovered.map(s => <span key={s} className="px-2 py-1 text-xs bg-accent rounded-full">{s}</span>)}</div>
                            </div>
                            <div className="mt-3">
                                <h5 className="font-semibold text-sm mb-2">Key Resources:</h5>
                                <div className="space-y-2">
                                    {module.resources.map(res => (
                                        <div key={res.title} className="flex items-start gap-2 text-sm">
                                            <div className="flex-shrink-0 mt-1">{res.type === 'Video' ? <BookOpen size={14}/> : <FileText size={14}/>}</div>
                                            <div><strong>{res.title} ({res.type}):</strong> <span className="text-muted-foreground">{res.description}</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div className="mt-3">
                                <h5 className="font-semibold text-sm mb-1">Project Idea:</h5>
                                <p className="text-sm text-muted-foreground">{module.projectIdea}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
};


// --- MAIN EXPORTED COMPONENT ---

interface SkillAnalyzerPageProps {
    onNewNote: (title: string, content: string) => Page;
}

const SkillAnalyzerPage: React.FC<SkillAnalyzerPageProps> = ({ onNewNote }) => {
  const { profile, setProfile, analysis, loading, error, generateAnalysis, clearAnalysis } = useSkillAnalyzer();
  const [step, setStep] = useState<'profile' | 'analysis'>(analysis ? 'analysis' : 'profile');

  useEffect(() => {
    setStep(analysis ? 'analysis' : 'profile');
  }, [analysis]);

  const handleProfileSubmit = async (profileData: SkillProfile) => {
    setProfile(profileData);
    const result = await generateAnalysis(profileData);
    if (result) {
      setStep('analysis');
    }
  };
  
  const handleRegenerate = async () => {
    if (profile) await generateAnalysis(profile);
  };
  
  const handleStartOver = () => {
    clearAnalysis();
    setStep('profile');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
      {step === 'profile' ? (
        <ProfileForm onSubmit={handleProfileSubmit} initialData={profile || undefined} loading={loading} error={error} />
      ) : analysis ? (
        <AnalysisView analysis={analysis} onBack={handleStartOver} onRegenerate={handleRegenerate} onNewNote={onNewNote} />
      ) : (
         <div className="flex flex-col items-center justify-center h-full">
            {loading ? (
                <><Loader className="animate-spin text-primary" size={32}/> <p className="mt-4">Generating your learning path...</p></>
            ) : (
                 <><AlertTriangle className="text-destructive" size={32}/> <p className="mt-4 text-center">Something went wrong. Please try again.</p><button onClick={handleStartOver} className="mt-4 px-4 py-2 bg-secondary rounded-md">Go Back</button></>
            )}
        </div>
      )}
    </div>
  );
};

export default SkillAnalyzerPage;