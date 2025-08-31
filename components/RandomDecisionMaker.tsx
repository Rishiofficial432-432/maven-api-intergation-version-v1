import React, { useState } from 'react';
import { Plus, Trash2, Dice6 } from 'lucide-react';

type Template = 'yesNo' | 'abc' | 'food' | 'activities' | 'weekend' | 'colors';

interface RandomDecisionMakerProps {
  options: string[];
  setOptions: (options: string[]) => void;
  result: string;
  setResult: (result: string) => void;
  isSpinning: boolean;
  setIsSpinning: (isSpinning: boolean) => void;
  currentSpin: string;
  setCurrentSpin: (currentSpin: string) => void;
}

const RandomDecisionMaker: React.FC<RandomDecisionMakerProps> = ({
  options, setOptions, result, setResult, isSpinning, setIsSpinning, currentSpin, setCurrentSpin
}) => {
  const [newOption, setNewOption] = useState('');

  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const clearOptions = () => {
    setOptions([]);
    setResult('');
  };

  const makeDecision = () => {
    if (options.length < 2) {
      setResult(options.length === 1 ? options[0] : '');
      return;
    }

    setIsSpinning(true);
    setResult('');
    
    let spins = 0;
    const maxSpins = 20 + Math.floor(Math.random() * 15);
    
    const spinInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * options.length);
      setCurrentSpin(options[randomIndex]);
      spins++;
      
      if (spins >= maxSpins) {
        clearInterval(spinInterval);
        setTimeout(() => {
          const finalChoice = options[Math.floor(Math.random() * options.length)];
          setResult(finalChoice);
          setIsSpinning(false);
          setCurrentSpin('');
        }, 500);
      }
    }, 100);
  };

  const loadTemplate = (template: Template) => {
    const templates: Record<Template, string[]> = {
      yesNo: ['Yes', 'No'],
      abc: ['Option A', 'Option B', 'Option C'],
      food: ['Pizza', 'Burger', 'Pasta', 'Salad', 'Tacos', 'Sushi'],
      activities: ['Movie Night', 'Go Out', 'Stay Home', 'Call Friends', 'Read Book', 'Exercise'],
      weekend: ['Beach', 'Shopping', 'Park', 'Museum', 'Restaurant', 'Home'],
      colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']
    };
    
    setOptions(templates[template] || []);
    setResult('');
  };

  const cardClasses = "bg-card border border-border rounded-xl shadow-lg";

  return (
    <div className={`max-w-3xl mx-auto p-6 ${cardClasses}`}>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary to-purple-600 rounded-full mb-4">
          <Dice6 className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
          Random Decision Maker
        </h1>
        <p className="text-muted-foreground mt-2">Can't decide? Let me help you choose!</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground/90 mb-2">
          Add Your Options:
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            placeholder="Enter an option..."
            className="flex-1 bg-input border-border rounded-md px-4 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
            onKeyPress={(e) => e.key === 'Enter' && addOption()}
          />
          <button
            onClick={addOption}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground/90 mb-2">
          Quick Templates:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button onClick={() => loadTemplate('yesNo')} className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">Yes/No</button>
          <button onClick={() => loadTemplate('abc')} className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">A/B/C</button>
          <button onClick={() => loadTemplate('food')} className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">Food Options</button>
          <button onClick={() => loadTemplate('activities')} className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">Activities</button>
          <button onClick={() => loadTemplate('weekend')} className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">Weekend Plans</button>
          <button onClick={() => loadTemplate('colors')} className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">Colors</button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground/90">
            Your Options ({options.length}):
          </label>
          {options.length > 0 && (
            <button onClick={clearOptions} className="text-sm text-destructive hover:text-destructive/90">Clear All</button>
          )}
        </div>
        
        <div className="min-h-24 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
          {options.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Add options above to get started</p>
          ) : (
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                  <span className="flex-1">{option}</span>
                  <button onClick={() => removeOption(index)} className="text-destructive hover:text-destructive/90 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-center mb-6">
        <button
          onClick={makeDecision}
          disabled={options.length < 2 || isSpinning}
          className="px-8 py-4 bg-gradient-to-r from-primary to-purple-500 text-primary-foreground rounded-lg font-semibold text-lg hover:from-primary/90 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
        >
          {isSpinning ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
              <span>Deciding...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Dice6 size={20} />
              <span>Make Decision!</span>
            </div>
          )}
        </button>
      </div>

      {isSpinning && (
        <div className="text-center mb-6 p-4 bg-secondary rounded-lg">
          <div className="text-lg font-semibold text-muted-foreground mb-2">Spinning...</div>
          <div className="text-2xl font-bold text-primary animate-pulse">
            {currentSpin}
          </div>
        </div>
      )}

      {result && !isSpinning && (
        <div className="text-center p-6 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-2">🎯 Decision Made!</h3>
          <div className="text-3xl font-bold mb-2">{result}</div>
          <p className="text-sm opacity-90">There's your answer!</p>
        </div>
      )}

    </div>
  );
};

export default RandomDecisionMaker;