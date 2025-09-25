import React, { useState, useEffect, useCallback } from 'react';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { StudentProfile, CareerRecommendation, CareerPath, Page } from '../types';
import usePersistentState from './usePersistentState';
import { Section } from './Section';
import { User, Book, Users, Loader, AlertTriangle, Building, BookOpen, Briefcase, RefreshCcw, Edit, Rocket, Plus, Trash2, Save } from 'lucide-react';
import { useToast } from './Toast';

// --- SCHEMA & HOOK ---

const careerRecommendationSchema = {
    type: Type.OBJECT,
    properties: {
        colleges: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING }, type: { type: Type.STRING, enum: ['IIT', 'NIT', 'State', 'Private', 'International', 'Online'] }, eligibility: { type: Type.NUMBER }, affordability: { type: Type.STRING }, location: { type: Type.STRING }, fees: { type: Type.NUMBER }, cutoffRange: { type: Type.STRING },
                }
            }
        },
        exams: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING }, description: { type: Type.STRING }, eligibility: { type: Type.STRING }, preparationTime: { type: Type.STRING }, careerScope: { type: Type.STRING },
                }
            }
        },
        careerPaths: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING }, description: { type: Type.STRING }, requiredExams: { type: Type.ARRAY, items: { type: Type.STRING } }, avgSalary: { type: Type.STRING }, growthRate: { type: Type.STRING },
                }
            }
        },
        backupOptions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING }, description: { type: Type.STRING }, whenToConsider: { type: Type.STRING }, alternativePaths: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
            }
        },
    }
};

type CareerCache = {
  profile: StudentProfile;
  recommendations: CareerRecommendation;
}

const useCareerGuidance = () => {
  const [profile, setProfile] = usePersistentState<StudentProfile | null>('maven-career-profile', null);
  const [cachedData, setCachedData] = usePersistentState<CareerCache | null>('maven-career-cache', null);
  const [recommendations, setRecommendations] = useState<CareerRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && cachedData && JSON.stringify(profile) === JSON.stringify(cachedData.profile)) {
      setRecommendations(cachedData.recommendations);
    } else {
      setRecommendations(null);
    }
  }, [profile, cachedData]);

  const generateRecommendations = useCallback(async (studentProfile: StudentProfile) => {
    if (!geminiAI) {
        setError("AI features are disabled. Please configure your API key in settings.");
        return null;
    }
    setLoading(true);
    setError(null);
    
    try {
      const prompt = `
        You are an expert career and university admissions counselor specializing in the Indian and international education systems. Your task is to provide a highly detailed, personalized, and strategic roadmap for the following student.

        Student Profile:
        ${JSON.stringify(studentProfile, null, 2)}

        ---
        CRUCIAL INSTRUCTIONS - FOLLOW THESE EXACTLY:
        ---

        1.  **Prioritize Student Preferences:** The student has listed preferred universities. These are their top choices. Prioritize these in your college suggestions. Your primary goal is to find pathways to *these specific institutions*.

        2.  **Generate Alternative Admission Pathways:** This is the most important part of your task. Do not just list standard admission routes. You MUST generate creative, practical, and alternative pathways to the student's preferred universities, especially if their primary qualifications (like competitive exam scores) are not sufficient.
            -   **Example Scenario:** If a student wants to study Computer Science at an IIT but has a low JEE score, you MUST suggest options like:
                a.  Pursuing a postgraduate degree (M.Tech/MS) at an IIT after a different bachelor's degree by preparing for the **GATE exam**.
                b.  Enrolling in reputable **online degrees** offered by top institutions, such as the **IIT Madras BS in Data Science and Applications**.
                c.  Exploring lateral entry options if applicable.
                d.  Gaining admission for a different, related degree at the target university and then attempting to switch majors (mention the difficulty of this).
            -   Integrate these alternative pathways into the "careerPaths" and "backupOptions" sections. Make them specific and actionable.

        3.  **Include All Online Degrees:** In your college and career path suggestions, you MUST include high-quality online degree programs from reputable Indian and international universities (like IIT Madras, BITS Pilani, Coursera partnerships, etc.) as viable and primary options, not just backups. Classify them with the 'Online' type.

        4.  **International Universities:** If the student lists international universities, provide suggestions relevant to those institutions' admission processes (e.g., required exams like SAT/ACT/GRE, the importance of application essays, extracurriculars, etc.).

        5.  **Contextualize for India:** All suggestions regarding exams, salaries (in INR), and career trends must be tailored to the current Indian context.

        Return ONLY a valid JSON object matching the provided schema. Do not add any conversational text, introductions, or explanations outside of the JSON structure.
      `;

      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: careerRecommendationSchema }
      });
      
      const text = response.text;
      const recommendationsData: CareerRecommendation = JSON.parse(text);
      setCachedData({ profile: studentProfile, recommendations: recommendationsData });
      setRecommendations(recommendationsData);
      return recommendationsData;

    } catch (err: any) {
      console.error('Error generating recommendations:', err);
      setCachedData(null);
      setError(`Failed to generate career recommendations: ${err.message || 'Please try again.'}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setCachedData]);

  const clearRecommendations = useCallback(() => {
    setCachedData(null);
    setRecommendations(null);
  }, [setCachedData]);

  return { profile, setProfile, recommendations, loading, error, generateRecommendations, clearRecommendations };
};

// --- CHILD COMPONENTS ---

interface ProfileFormProps {
  onSubmit: (data: StudentProfile) => void;
  initialData?: StudentProfile;
  loading: boolean;
  error: string | null;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ onSubmit, initialData, loading, error }) => {
  const [formData, setFormData] = useState<Omit<StudentProfile, 'id' | 'createdAt'>>({
    personalDetails: initialData?.personalDetails || { name: '', age: 16, gender: '', location: '', interests: '', preferences: { universities: [] } },
    academicDetails: initialData?.academicDetails || { tenthScore: 0, twelfthScore: 0, stream: 'Science', dropYear: false, competitiveExams: [] },
    familyBackground: initialData?.familyBackground || { fatherIncome: 0, financialConstraints: false },
  });

  const handleChange = (section: keyof typeof formData, field: string, value: any) => {
    setFormData(prev => ({ ...prev, [section]: { ...(prev[section] as object), [field]: value } }));
  };
  
  const handleExamChange = (id: string, field: 'name' | 'score', value: string) => {
      setFormData(prev => ({ ...prev, academicDetails: { ...prev.academicDetails, competitiveExams: prev.academicDetails.competitiveExams.map(exam => exam.id === id ? { ...exam, [field]: value } : exam) } }));
  };
  const handleAddExam = () => {
      setFormData(prev => ({ ...prev, academicDetails: { ...prev.academicDetails, competitiveExams: [...prev.academicDetails.competitiveExams, { id: crypto.randomUUID(), name: '', score: '' }] } }));
  };
  const handleRemoveExam = (id: string) => {
      setFormData(prev => ({ ...prev, academicDetails: { ...prev.academicDetails, competitiveExams: prev.academicDetails.competitiveExams.filter(exam => exam.id !== id) } }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: StudentProfile = { ...formData, id: initialData?.id || crypto.randomUUID(), createdAt: initialData?.createdAt || new Date().toISOString() };
    onSubmit(profile);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Section title="Pathfinder Profile">
        <p className="text-card-foreground/80 -mt-4 mb-6">Provide your details to receive personalized career and college recommendations from the AI. Your information is saved locally on your device.</p>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-primary"><User size={20}/> Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">Full Name</label><input type="text" value={formData.personalDetails.name} onChange={(e) => handleChange('personalDetails', 'name', e.target.value)} className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div><label className="text-sm text-muted-foreground">Age</label><input type="number" value={formData.personalDetails.age} onChange={(e) => handleChange('personalDetails', 'age', parseInt(e.target.value))} className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div><label className="text-sm text-muted-foreground">Location/City</label><input type="text" value={formData.personalDetails.location} onChange={(e) => handleChange('personalDetails', 'location', e.target.value)} className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div><label className="text-sm text-muted-foreground">Gender</label><select value={formData.personalDetails.gender} onChange={(e) => handleChange('personalDetails', 'gender', e.target.value)} className="w-full bg-input p-2 rounded-md mt-1"><option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div className="md:col-span-2"><label className="text-sm text-muted-foreground">Interests & Hobbies</label><textarea value={formData.personalDetails.interests} onChange={(e) => handleChange('personalDetails', 'interests', e.target.value)} placeholder="e.g., Coding, creative writing, robotics, debating..." className="w-full bg-input p-2 rounded-md mt-1" rows={3}/></div>
              <div className="md:col-span-2"><label className="text-sm text-muted-foreground">Preferred Universities (Optional)</label><textarea value={formData.personalDetails.preferences.universities.join(', ')} onChange={(e) => handleChange('personalDetails', 'preferences', { universities: e.target.value.split(',').map(u => u.trim()).filter(Boolean) })} placeholder="e.g., IIT Bombay, Stanford University, Ashoka University..." className="w-full bg-input p-2 rounded-md mt-1" rows={3} /></div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-primary"><Book size={20}/> Academic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">10th Board Score (%)</label><input type="number" min="0" max="100" step="0.1" value={formData.academicDetails.tenthScore} onChange={(e) => handleChange('academicDetails', 'tenthScore', parseFloat(e.target.value))} className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div><label className="text-sm text-muted-foreground">12th Board Score (%)</label><input type="number" min="0" max="100" step="0.1" value={formData.academicDetails.twelfthScore} onChange={(e) => handleChange('academicDetails', 'twelfthScore', parseFloat(e.target.value))} className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div><label className="text-sm text-muted-foreground">Stream</label><select value={formData.academicDetails.stream} onChange={(e) => handleChange('academicDetails', 'stream', e.target.value as any)} className="w-full bg-input p-2 rounded-md mt-1" required><option value="Science">Science</option><option value="Commerce">Commerce</option><option value="Arts">Arts</option><option value="Diploma">Diploma</option></select></div>
              <div className="flex items-center space-x-2 self-end pb-2"><input type="checkbox" checked={formData.academicDetails.dropYear} onChange={(e) => handleChange('academicDetails', 'dropYear', e.target.checked)} id="dropYear" className="h-4 w-4 rounded bg-input border-border" /><label htmlFor="dropYear">Took a drop year</label></div>
              <div className="md:col-span-2 space-y-2"><label className="text-sm text-muted-foreground">Competitive Exam Scores (Optional)</label>{formData.academicDetails.competitiveExams.map(exam => (<div key={exam.id} className="flex items-center gap-2"><input type="text" value={exam.name} onChange={e => handleExamChange(exam.id, 'name', e.target.value)} placeholder="Exam Name (e.g., JEE Mains)" className="flex-1 bg-input p-2 rounded-md" /><input type="text" value={exam.score} onChange={e => handleExamChange(exam.id, 'score', e.target.value)} placeholder="Score / Percentile / Rank" className="flex-1 bg-input p-2 rounded-md" /><button type="button" onClick={() => handleRemoveExam(exam.id)} className="p-2 text-destructive"><Trash2 size={16}/></button></div>))}<button type="button" onClick={handleAddExam} className="text-sm text-primary flex items-center gap-2"><Plus size={14}/> Add Exam</button></div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-primary"><Users size={20}/> Family Background</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">Father's Annual Income (₹)</label><input type="number" value={formData.familyBackground.fatherIncome} onChange={(e) => handleChange('familyBackground', 'fatherIncome', parseFloat(e.target.value))} className="w-full bg-input p-2 rounded-md mt-1" required /></div>
              <div className="flex items-center space-x-2 self-end pb-2"><input type="checkbox" checked={formData.familyBackground.financialConstraints} onChange={(e) => handleChange('familyBackground', 'financialConstraints', e.target.checked)} id="financialConstraints" className="h-4 w-4 rounded bg-input border-border" /><label htmlFor="financialConstraints">Facing Financial Constraints</label></div>
            </div>
          </div>
          {error && <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md"><AlertTriangle size={16}/> {error}</div>}
          <button type="submit" disabled={loading} className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95">
            {loading ? <><Loader className="animate-spin"/> Generating...</> : <><Rocket size={18}/> Get Career Recommendations</>}
          </button>
        </form>
      </Section>
    </div>
  );
};

interface RecommendationsViewProps {
  recommendations: CareerRecommendation | null;
  onBack: () => void;
  onRegenerate: () => void;
  loading: boolean;
  error: string | null;
  onNewNote: (title: string, content: string) => void;
}

const RecommendationsView: React.FC<RecommendationsViewProps> = ({ recommendations, onBack, onRegenerate, loading, error, onNewNote }) => {
  const toast = useToast();

  const handleSaveToNotes = (career: CareerPath) => {
    const title = `Career Path Analysis: ${career.title}`;
    const content = `
      <h2>${career.title}</h2>
      <p><strong>Description:</strong> ${career.description}</p>
      <p><strong>Average Salary:</strong> ${career.avgSalary}</p>
      <p><strong>Projected Growth Rate:</strong> ${career.growthRate}</p>
      <h3>Required Exams:</h3>
      <ul>${career.requiredExams.map(exam => `<li>${exam}</li>`).join('')}</ul>
      <p><em>Saved from Pathfinder on ${new Date().toLocaleDateString()}</em></p>
    `;
    onNewNote(title, content);
    toast.success(`${career.title} saved to notes!`);
  };
  
  const getEligibilityClass = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-300';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-300';
    return 'bg-red-500/20 text-red-300';
  };

  const getAffordabilityClass = (level: 'High' | 'Medium' | 'Low') => {
    if (level === 'Low') return 'bg-green-500/20 text-green-300';
    if (level === 'Medium') return 'bg-yellow-500/20 text-yellow-300';
    return 'bg-red-500/20 text-red-300';
  };
  
  if (loading) return <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full"><Rocket size={48} className="text-primary mb-4 animate-pulse" /><h2 className="text-2xl font-bold">Charting Your Course...</h2><p>The AI is analyzing your profile to build your personalized career roadmap.</p></div>;
  if (error) return <div className="flex flex-col items-center justify-center p-8 text-destructive"><AlertTriangle className="w-8 h-8 mb-4" /><p className="font-semibold">Generation Failed</p><p className="text-sm text-center mb-4">{error}</p><button onClick={onRegenerate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md"><RefreshCcw size={16}/> Try Again</button></div>;
  if (!recommendations) return <div className="text-center p-8"><p>No recommendations available. Please go back and submit your profile.</p><button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md">Back to Profile</button></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <h1 className="text-3xl font-bold text-foreground">Your Personalized Career Roadmap</h1>
        <div className="flex-shrink-0 flex items-center gap-2"><button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"><Edit size={14}/> Edit Profile</button><button onClick={onRegenerate} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"><RefreshCcw size={14}/> Regenerate</button></div>
      </div>
      <Section title={<><Building size={24}/> College Suggestions</>}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 not-prose">
          {recommendations.colleges.map((college, index) => (
            <div key={index} className="bg-secondary/50 p-4 rounded-lg border border-border/50"><h4 className="font-bold">{college.name}</h4><p className="text-sm text-muted-foreground">{college.type} • {college.location}</p><div className="flex flex-wrap gap-2 text-xs mt-2"><span className={`px-2 py-1 rounded-full ${getEligibilityClass(college.eligibility)}`}>Eligibility: {college.eligibility}%</span><span className={`px-2 py-1 rounded-full ${getAffordabilityClass(college.affordability)}`}>{college.affordability} Affordability</span></div><p className="text-sm mt-2">Fees: ₹{college.fees.toLocaleString()}/year</p><p className="text-sm">Cutoff: {college.cutoffRange}</p></div>
          ))}
        </div>
      </Section>
      <Section title={<><BookOpen size={24}/> Recommended Exams</>}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
          {recommendations.exams.map((exam, index) => (
            <div key={index} className="bg-secondary/50 p-4 rounded-lg border border-border/50"><h4 className="font-bold">{exam.name}</h4><p className="text-sm text-muted-foreground">{exam.description}</p><div className="flex flex-wrap gap-2 text-xs mt-2"><span className="px-2 py-1 rounded-full bg-primary/20 text-primary">Prep Time: {exam.preparationTime}</span></div><p className="text-sm mt-2"><strong>Scope:</strong> {exam.careerScope}</p></div>
          ))}
        </div>
      </Section>
       <Section title={<><Briefcase size={24}/> Potential Career Paths</>}>
         <div className="space-y-4 not-prose">
          {recommendations.careerPaths.map((career, index) => (
            <div key={index} className="bg-secondary/50 p-4 rounded-lg border border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold">{career.title}</h4>
                  <p className="text-sm text-muted-foreground">{career.description}</p>
                </div>
                <button onClick={() => handleSaveToNotes(career)} className="flex-shrink-0 ml-4 flex items-center gap-1.5 px-2.5 py-1 text-xs bg-accent text-accent-foreground rounded-md hover:bg-accent/80"><Save size={12}/> Save</button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs mt-2"><span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">Avg Salary: {career.avgSalary}</span><span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">Growth: {career.growthRate}</span></div><p className="text-sm mt-2"><strong>Exams:</strong> {career.requiredExams.join(', ')}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title={<><RefreshCcw size={24}/> Backup Options</>}>
         <div className="space-y-4 not-prose">
          {recommendations.backupOptions.map((option, index) => (
            <div key={index} className="bg-secondary/50 p-4 rounded-lg border border-border/50"><h4 className="font-bold">{option.title}</h4><p className="text-sm text-muted-foreground">{option.description}</p><p className="text-sm mt-2"><strong>Consider If:</strong> {option.whenToConsider}</p><p className="text-sm mt-2"><strong>Paths:</strong> {option.alternativePaths.join(', ')}</p></div>
          ))}
        </div>
      </Section>
    </div>
  );
};

// --- MAIN EXPORTED COMPONENT ---

interface PathfinderPageProps {
    onNewNote: (title: string, content: string) => Page;
}

const PathfinderPage: React.FC<PathfinderPageProps> = ({ onNewNote }) => {
  const { profile, setProfile, recommendations, loading, error, generateRecommendations, clearRecommendations } = useCareerGuidance();
  
  const [step, setStep] = useState<'profile' | 'recommendations'>(recommendations ? 'recommendations' : 'profile');

  useEffect(() => {
      setStep(recommendations ? 'recommendations' : 'profile');
  }, [recommendations]);

  const handleProfileSubmit = async (profileData: StudentProfile) => {
    setProfile(profileData);
    const result = await generateRecommendations(profileData);
    if (result) {
        setStep('recommendations');
    }
  };

  const handleRegenerate = async () => {
    if (profile) await generateRecommendations(profile);
  };
  
  const handleStartOver = () => {
      clearRecommendations();
      setStep('profile');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
      {step === 'profile' ? (
        <ProfileForm onSubmit={handleProfileSubmit} initialData={profile || undefined} loading={loading} error={error} />
      ) : (
        <RecommendationsView recommendations={recommendations} onBack={handleStartOver} onRegenerate={handleRegenerate} loading={loading} error={error} onNewNote={(title, content) => onNewNote(title, content)} />
      )}
    </div>
  );
};

export default PathfinderPage;