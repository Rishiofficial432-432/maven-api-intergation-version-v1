import React, { useState, useCallback } from 'react';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { Page, JournalEntry, Task, CalendarEvent, Habit, MoodEntry, WeeklyReviewData, ActivityHeatmap } from '../types';
import { Section } from './Section';
import { Loader, Wand2, BarChart, Smile, Clock, BrainCircuit, RefreshCcw } from 'lucide-react';
import { useToast } from './Toast';

// --- PROPS INTERFACE ---
interface LifeOSPageProps {
  pages: Page[];
  journalEntries: JournalEntry[];
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  moodEntries: MoodEntry[];
  weeklyReview: WeeklyReviewData | null;
  setWeeklyReview: (review: WeeklyReviewData | null) => void;
}

// --- SCHEMA FOR AI ---
const weeklyReviewSchema = {
    type: Type.OBJECT,
    properties: {
        timeAnalysis: {
            type: Type.OBJECT,
            properties: {
                mostProductiveDay: { type: Type.STRING },
                mostProductiveTime: { type: Type.STRING },
                activityHeatmap: {
                    type: Type.OBJECT,
                    properties: {
                        Monday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        Tuesday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        Wednesday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        Thursday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        Friday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        Saturday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        Sunday: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    }
                }
            }
        },
        taskAnalysis: {
            type: Type.OBJECT,
            properties: {
                tasksCompleted: { type: Type.NUMBER },
                tasksAdded: { type: Type.NUMBER },
                completionRate: { type: Type.NUMBER }
            }
        },
        moodAnalysis: {
            type: Type.OBJECT,
            properties: {
                overallMood: { type: Type.STRING },
                moodTrend: { type: Type.STRING, enum: ['improving', 'declining', 'stable'] },
                moodCorrelations: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            activity: { type: Type.STRING },
                            moodImpact: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] }
                        }
                    }
                }
            }
        },
        keySummary: { type: Type.STRING, description: "A concise, insightful summary of the user's week." }
    }
};

// --- CHILD COMPONENTS ---

const Heatmap: React.FC<{ data: ActivityHeatmap }> = ({ data }) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 12 }, (_, i) => `${(i * 2)}:00`);
    const maxActivity = Math.max(1, ...Object.values(data).flatMap(d => d));

    return (
        <div className="flex gap-2">
            <div className="flex flex-col text-xs text-muted-foreground pt-6">
                {['Morning', 'Afternoon', 'Evening', 'Night'].map(period => <div key={period} className="flex-1 flex items-center">{period}</div>)}
            </div>
            <div className="flex-1 grid grid-cols-7 gap-1">
                {days.map(day => (
                    <div key={day} className="flex flex-col gap-1 items-center">
                        <div className="text-xs font-semibold text-muted-foreground">{day}</div>
                        {(data[day.replace('Sun', 'Sunday').replace('Mon', 'Monday').replace('Tue', 'Tuesday').replace('Wed', 'Wednesday').replace('Thu', 'Thursday').replace('Fri', 'Friday').replace('Sat', 'Saturday')] || Array(24).fill(0)).map((activity, hour) => (
                            <div
                                key={hour}
                                className="w-full h-3 rounded-sm bg-primary"
                                style={{ opacity: activity / maxActivity }}
                                title={`${activity} activities on ${day} at ${hour}:00`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ReviewDisplay: React.FC<{ review: WeeklyReviewData, onRegenerate: () => void }> = ({ review, onRegenerate }) => {
    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Your Weekly Review</h1>
                    <p className="text-muted-foreground">An AI-powered summary of your productivity and well-being patterns.</p>
                </div>
                <button onClick={onRegenerate} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"><RefreshCcw size={14}/> Regenerate</button>
            </div>
            <Section title="Key Summary">
                <p className="text-lg text-foreground/90">{review.keySummary}</p>
            </Section>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Section title={<><Clock size={20}/> Time Analysis</>}>
                    <p><strong>Most Productive Day:</strong> {review.timeAnalysis.mostProductiveDay}</p>
                    <p><strong>Peak Focus Time:</strong> {review.timeAnalysis.mostProductiveTime}</p>
                    <h4 className="font-semibold mt-4 mb-2">Activity Heatmap</h4>
                    <Heatmap data={review.timeAnalysis.activityHeatmap} />
                </Section>
                <Section title={<><BarChart size={20}/> Task Performance</>}>
                    <div className="space-y-4">
                        <div className="text-center"><p className="text-4xl font-bold text-primary">{review.taskAnalysis.completionRate}%</p><p className="text-sm text-muted-foreground">Completion Rate</p></div>
                        <div className="flex justify-around"><div className="text-center"><p className="text-xl font-bold">{review.taskAnalysis.tasksCompleted}</p><p className="text-xs text-muted-foreground">Completed</p></div><div className="text-center"><p className="text-xl font-bold">{review.taskAnalysis.tasksAdded}</p><p className="text-xs text-muted-foreground">Added</p></div></div>
                    </div>
                </Section>
                 <Section title={<><Smile size={20}/> Mood & Well-being</>}>
                    <p><strong>Overall Mood:</strong> {review.moodAnalysis.overallMood}</p>
                    <p><strong>Weekly Trend:</strong> <span className="capitalize">{review.moodAnalysis.moodTrend}</span></p>
                    <h4 className="font-semibold mt-4 mb-2">Key Correlations</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                        {review.moodAnalysis.moodCorrelations.map((c, i) => <li key={i}><strong className={c.moodImpact === 'positive' ? 'text-green-400' : 'text-red-400'}>{c.moodImpact === 'positive' ? 'Positive' : 'Negative'} impact</strong> from "{c.activity}"</li>)}
                    </ul>
                </Section>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
const LifeOSPage: React.FC<LifeOSPageProps> = (props) => {
  const { pages, journalEntries, tasks, events, habits, moodEntries, weeklyReview, setWeeklyReview } = props;
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const generateReview = useCallback(async () => {
    if (!geminiAI) {
      toast.error("AI features are disabled. Please configure your API key in settings.");
      return;
    }

    setIsLoading(true);
    setWeeklyReview(null);

    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Aggregate and summarize data
        const activityData = {
            tasks: tasks.filter(t => new Date(t.createdAt) >= sevenDaysAgo).map(t => ({ completed: t.completed, createdAt: t.createdAt })),
            events: events.filter(e => new Date(e.date) >= sevenDaysAgo).map(e => ({ date: e.date, time: e.time })),
            journalEntries: journalEntries.filter(j => new Date(j.createdAt) >= sevenDaysAgo).map(j => ({ date: j.date })),
            pagesCreated: pages.filter(p => new Date(p.createdAt) >= sevenDaysAgo).map(p => ({ createdAt: p.createdAt })),
            habits: habits.map(h => ({ name: h.name, history: h.history?.filter(day => new Date(day.date) >= sevenDaysAgo) })),
            moods: moodEntries.filter(m => new Date(m.date) >= sevenDaysAgo)
        };
        
        const prompt = `You are an AI life coach analyzing a user's productivity and well-being data from the past 7 days.
        Data: ${JSON.stringify(activityData)}
        Analyze the provided data to generate a weekly review. Identify patterns, productivity peaks, and correlations between activities and mood.
        Your response must be a single JSON object that adheres to the provided schema. Do not add any text outside the JSON object.
        For the heatmap, each day's array must contain exactly 24 numbers representing activity counts for each hour (0-23).`;

      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: weeklyReviewSchema }
      });
      
      const parsedResult: WeeklyReviewData = JSON.parse(response.text.trim());
      setWeeklyReview(parsedResult);
      toast.success("Weekly review generated!");

    } catch (err: any) {
      console.error("Life OS AI Error:", err);
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [pages, journalEntries, tasks, events, habits, moodEntries, setWeeklyReview, toast]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
        {isLoading ? (
             <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader className="w-12 h-12 text-primary animate-spin mb-4" />
                <h2 className="text-2xl font-bold">Analyzing Your Week...</h2>
                <p className="text-muted-foreground mt-2">This may take a moment as the AI processes your data.</p>
            </div>
        ) : weeklyReview ? (
            <ReviewDisplay review={weeklyReview} onRegenerate={generateReview} />
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <BrainCircuit size={48} className="text-primary mb-4"/>
                <h1 className="text-3xl font-bold">Life OS Insights</h1>
                <p className="text-muted-foreground mt-2 mb-6 max-w-xl">
                    Generate a personalized, AI-powered review of your last seven days. Discover your productivity patterns, activity peaks, and well-being trends to better understand and optimize your life.
                </p>
                <button
                    onClick={generateReview}
                    disabled={isLoading}
                    className="w-full max-w-xs flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg text-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95"
                >
                    <Wand2/> Generate My Weekly Review
                </button>
            </div>
        )}
    </div>
  );
};

export default LifeOSPage;