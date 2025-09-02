import React from 'react';
import DarkVeil from './DarkVeil';

interface LandingPageProps {
    onEnter: () => void;
}

const playLaunchSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const startTime = audioContext.currentTime;
        const duration = 0.7;
        const startFreq = 220; // A3 note
        const endFreq = 880;   // A5 note (two octaves higher)

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(startFreq, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05); // Quick fade-in
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        // Clean up the context after the sound has finished playing
        setTimeout(() => {
            if (audioContext.state !== 'closed') {
                audioContext.close();
            }
        }, (duration * 1000) + 100);
    } catch (e) {
        console.error("Could not play launch sound:", e);
    }
};

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
    // Finalized animation parameters as requested
    const speed = 2.0;
    const hueShift = 360.0;
    const noiseIntensity = 0.2;
    const scanlineFrequency = 10.0;
    const scanlineIntensity = 0.5;
    const warpAmount = 0.1;

    const handleEnter = () => {
        playLaunchSound();
        onEnter();
    };

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                <DarkVeil 
                    speed={speed}
                    hueShift={hueShift}
                    noiseIntensity={noiseIntensity}
                    scanlineIntensity={scanlineIntensity}
                    scanlineFrequency={scanlineFrequency}
                    warpAmount={warpAmount}
                />
            </div>
            
            <div className="z-10 text-center p-4">
                <h1 
                    className="text-5xl sm:text-7xl lg:text-8xl text-foreground tracking-wider mb-6 animate-fade-in-up"
                    style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, animationDelay: '0.3s' }}
                >
                    MAVEN
                </h1>
                <p 
                    className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up"
                    style={{ animationDelay: '0.5s' }}
                >
                    Your intelligent, private workspace.
                    An all-in-one productivity suite to organize your life and amplify your creativity.
                </p>
                <button
                    onClick={handleEnter}
                    className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-primary/30 animate-fade-in-up"
                    style={{ animationDelay: '0.7s' }}
                >
                    Launch App
                </button>
            </div>
             <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.8s ease-out forwards;
                    opacity: 0; /* Start hidden for animation */
                }
            `}</style>
        </div>
    );
};

export default LandingPage;