import React, { useState, useEffect } from 'react';
import { geminiAI } from './gemini';
import { Loader } from 'lucide-react';

interface WelcomePlaceholderProps {
    onNewPage: () => void;
}

const getSalutation = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

const defaultQuotes = [
    "The secret of getting ahead is getting started.",
    "The best way to predict the future is to create it.",
    "Believe you can and you're halfway there."
];

export const WelcomePlaceholder: React.FC<WelcomePlaceholderProps> = ({ onNewPage }) => {
    const salutation = getSalutation();
    const [quote, setQuote] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchQuotes = async () => {
            setIsLoading(true);
            if (!geminiAI) {
                setQuote(defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)]);
                setIsLoading(false);
                return;
            }

            try {
                const prompt = "Generate 3 short, complimentary, and motivational quotes for a sophisticated user of a productivity app. Separate each quote with a newline. Do not add any other text like titles or bullet points.";

                const response = await geminiAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });

                const rawText = response.text.trim();
                const generatedQuotes = rawText.split('\n').filter(q => q.trim() !== '' && !q.trim().startsWith('*'));

                if (generatedQuotes.length > 0) {
                    const randomQuote = generatedQuotes[Math.floor(Math.random() * generatedQuotes.length)];
                    setQuote(randomQuote);
                } else {
                    const randomDefaultQuote = defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)];
                    setQuote(randomDefaultQuote);
                }
            } catch (error) {
                console.error("Failed to fetch quotes from Gemini:", error);
                const randomDefaultQuote = defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)];
                setQuote(randomDefaultQuote);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuotes();
    }, []);


    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/10 animate-gradient-shift"></div>
            <div className="w-full max-w-4xl min-h-[12rem] flex flex-col items-center justify-center z-10">
                <h1 
                    className="text-5xl sm:text-6xl lg:text-7xl text-foreground tracking-wider mb-6 animate-fade-in-up"
                    style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, animationDelay: '0s' }}
                >
                    MAVEN
                </h1>
                <p 
                  className="text-xl sm:text-2xl lg:text-3xl font-medium text-muted-foreground leading-tight animate-fade-in-up"
                  style={{ animationDelay: '0.2s' }}
                >
                    Hello. {salutation}.
                </p>
                 <div className="mt-8 space-y-3 h-28 flex flex-col justify-center items-center">
                    {isLoading ? (
                         <Loader className="w-6 h-6 text-muted-foreground animate-spin"/>
                    ) : (
                        quote && (
                            <p 
                                className="text-md font-light text-muted-foreground italic animate-fade-in-up"
                                style={{ animationDelay: `0.5s` }}
                            >
                                "{quote}"
                            </p>
                        )
                    )}
                </div>
            </div>
            <style>{`
                @keyframes gradient-shift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-shift {
                    background-size: 200% 200%;
                    animation: gradient-shift 15s ease infinite;
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.8s ease-out forwards;
                }
            `}</style>
        </div>
    );
};