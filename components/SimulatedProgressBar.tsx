import React, { useState, useEffect } from 'react';

interface SimulatedProgressBarProps {
  isProcessing: boolean;
}

const SimulatedProgressBar: React.FC<SimulatedProgressBarProps> = ({ isProcessing }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    if (isProcessing) {
      // Reset progress when a new process starts
      setProgress(0);
      let startTime: number | null = null;
      const duration = 8000; // Simulate over 8 seconds to give a sense of progress

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsedTime = timestamp - startTime;
        // Animate up to 95% and then hold, waiting for the process to finish
        const newProgress = Math.min(95, (elapsedTime / duration) * 100);
        setProgress(newProgress);
        if (elapsedTime < duration) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };
      animationFrameId = requestAnimationFrame(animate);
    } else {
        // When processing finishes, quickly fill the bar.
        // The parent component will then hide this component.
        if (progress > 0 && progress < 100) {
            setProgress(100);
        }
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isProcessing]);

  return (
    <div className="w-full bg-secondary rounded-full h-2.5 my-4">
      <div
        className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

export default SimulatedProgressBar;
