import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { getBannerData } from './db';

interface InspirationPageProps {
  inspirationImageId: string | null;
}

const InspirationPage: React.FC<InspirationPageProps> = ({ inspirationImageId }) => {
  const [imageUrl, setImageUrl] = useState<string>('/assets/mother.jpg'); // Default

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadImage = async () => {
      if (inspirationImageId) {
        try {
          const fileBlob = await getBannerData(inspirationImageId);
          if (fileBlob) {
            objectUrl = URL.createObjectURL(fileBlob);
            setImageUrl(objectUrl);
          } else {
            setImageUrl('/assets/mother.jpg');
          }
        } catch (error) {
          console.error("Failed to load inspiration image:", error);
          setImageUrl('/assets/mother.jpg');
        }
      } else {
        setImageUrl('/assets/mother.jpg');
      }
    };

    loadImage();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [inspirationImageId]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-rose-500/10 animate-gradient-shift z-0"></div>
      <div className="z-10 animate-fade-in-up">
        <img 
          src={imageUrl} 
          alt="Inspiration" 
          className="w-48 h-48 rounded-full object-cover mx-auto mb-6 shadow-2xl ring-4 ring-primary/20"
        />
        <h1 className="text-4xl font-bold text-foreground flex items-center justify-center gap-3">
          <Heart className="w-10 h-10 text-pink-400" />
          My Inspiration
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-lg">
Maven wasn’t built out of theory — it was inspired by watching the real struggles of educators who balance endless papers, shifting timetables, and administrative chaos while still giving their best to students. Seeing that weight up close pushed me to create a tool that could return time, focus, and peace back to teachers. That’s where Maven’s journey truly began. And Ma’am, if you weren’t there that day — Maven would not have been possible.
        </p>
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
            animation: fade-in-up 1s ease-out forwards;
        }
      `}</style>
    </main>
  );
};

export default InspirationPage;