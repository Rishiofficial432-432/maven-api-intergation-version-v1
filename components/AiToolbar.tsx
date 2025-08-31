import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from './Spinner';
import { BrainCircuitIcon, CommandIcon, FileTextIcon, LanguagesIcon, ListTodoIcon, MessageSquareQuoteIcon, PlusIcon, TrashIcon, XIcon, ImageIcon } from './Icons';
import { Bold, Italic, Underline, Strikethrough, Heading1, Heading2, List, ListOrdered } from 'lucide-react';
import { geminiAI } from './gemini';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  onResult: (result: string) => void;
  onLoading: (isLoading: boolean) => void;
  onNewPage: () => void;
  onDeletePage: () => void;
  onFormat: (command: string, value?: string) => void;
  onInsertImage: () => void;
}

type Command = {
    name: string;
    section: 'AI' | 'General' | 'Formatting';
    icon: React.ReactElement;
    action: () => void;
    template?: (text: string) => string;
}


const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, text, onResult, onLoading, onNewPage, onDeletePage, onFormat, onInsertImage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleAiAction = async (promptTemplate: (text: string) => string) => {
    onClose();
    if (!geminiAI) {
        setError("AI features are disabled. API key is not configured.");
        setTimeout(() => setError(null), 5000);
        return;
    }

    if (!text.trim() && !promptTemplate('').includes('Brainstorm')) {
        setError("Please write some content first to use this command.");
        setTimeout(() => setError(null), 3000);
        return;
    }

    onLoading(true);
    setError(null);
    try {
      const prompt = promptTemplate(text);
      
      const response = await geminiAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
      });

      const responseText = response.text;
      if (!responseText && (response as any).promptFeedback?.blockReason) {
        throw new Error(`Request was blocked by the API. Reason: ${(response as any).promptFeedback.blockReason}`);
      }
      
      if (!responseText.trim()) {
          throw new Error('The AI returned an empty response. Please try rephrasing your content.');
      }

      onResult(responseText.trim());
    } catch (err: any) {
      console.error("Gemini API error:", err);
      setError(err.message || "Failed to generate content. Please check your API key and try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      onLoading(false);
    }
  };

    const commands: Command[] = useMemo(() => [
        { name: 'New Page', section: 'General', icon: <PlusIcon className="w-5 h-5"/>, action: () => { onClose(); onNewPage(); } },
        { name: 'Delete Page', section: 'General', icon: <TrashIcon className="w-5 h-5"/>, action: () => { onClose(); onDeletePage(); } },
        { name: 'Insert Image', section: 'General', icon: <ImageIcon className="w-5 h-5"/>, action: () => { onClose(); onInsertImage(); } },
        
        { name: 'Bold', section: 'Formatting', icon: <Bold size={20}/>, action: () => { onClose(); onFormat('bold'); } },
        { name: 'Italic', section: 'Formatting', icon: <Italic size={20}/>, action: () => { onClose(); onFormat('italic'); } },
        { name: 'Underline', section: 'Formatting', icon: <Underline size={20}/>, action: () => { onClose(); onFormat('underline'); } },
        { name: 'Strikethrough', section: 'Formatting', icon: <Strikethrough size={20}/>, action: () => { onClose(); onFormat('strikeThrough'); } },
        { name: 'Heading 1', section: 'Formatting', icon: <Heading1 size={20}/>, action: () => { onClose(); onFormat('formatBlock', '<h1>'); } },
        { name: 'Heading 2', section: 'Formatting', icon: <Heading2 size={20}/>, action: () => { onClose(); onFormat('formatBlock', '<h2>'); } },
        { name: 'Bulleted List', section: 'Formatting', icon: <List size={20}/>, action: () => { onClose(); onFormat('insertUnorderedList'); } },
        { name: 'Numbered List', section: 'Formatting', icon: <ListOrdered size={20}/>, action: () => { onClose(); onFormat('insertOrderedList'); } },
        
        { name: 'Summarize', section: 'AI', icon: <FileTextIcon className="w-5 h-5"/>, action: () => {}, template: t => `Summarize the following text concisely:\n\n${t}` },
        { name: 'Improve Writing', section: 'AI', icon: <BrainCircuitIcon className="w-5 h-5"/>, action: () => {}, template: t => `Improve the writing of the following text. Fix any grammar or spelling mistakes, and make it more clear and professional:\n\n${t}` },
        { name: 'Brainstorm Ideas', section: 'AI', icon: <BrainCircuitIcon className="w-5 h-5"/>, action: () => {}, template: t => `Brainstorm a list of 3-5 related ideas based on the following text. If the text is empty, brainstorm ideas about productivity. Format the output as a bulleted list:\n\n${t}` },
        { name: 'Find Action Items', section: 'AI', icon: <ListTodoIcon className="w-5 h-5"/>, action: () => {}, template: t => `Extract any action items or tasks from the following text. Format as a checklist:\n\n${t}` },
        { name: 'Translate to Spanish', section: 'AI', icon: <LanguagesIcon className="w-5 h-5"/>, action: () => {}, template: t => `Translate the following text to Spanish:\n\n${t}` },
        { name: 'Change Tone to Formal', section: 'AI', icon: <MessageSquareQuoteIcon className="w-5 h-5"/>, action: () => {}, template: t => `Rewrite the following text in a more formal tone:\n\n${t}` },
  ], [onNewPage, onDeletePage, onClose, onFormat, onInsertImage]);
  
  const filteredCommands = useMemo(() => {
    if (!searchTerm) return commands;
    return commands.filter(cmd => cmd.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, commands]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredCommands.length);
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const command = filteredCommands[activeIndex];
        if (command) executeCommand(command);
    }
  }, [onClose, filteredCommands, activeIndex]);

  useEffect(() => {
    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
      if(!isOpen) {
          setSearchTerm('');
          setActiveIndex(0);
      }
  }, [isOpen]);

  useEffect(() => {
      setActiveIndex(0);
  }, [searchTerm])
  

  const executeCommand = (command: Command) => {
      if (command.template) {
          handleAiAction(command.template);
      } else {
          command.action();
      }
  }


  if (!isOpen) return null;

  const renderCommands = (section: string) => {
      const sectionCommands = filteredCommands.filter(cmd => cmd.section === section);
      if (sectionCommands.length === 0) return null;
      return (
          <div>
              <h3 className="text-xs text-muted-foreground font-medium px-3 pt-4 pb-2">{section}</h3>
              <ul className="space-y-1">
                  {sectionCommands.map(cmd => {
                      const globalIndex = filteredCommands.findIndex(c => c.name === cmd.name && c.section === cmd.section);
                      const isActive = globalIndex === activeIndex;
                      return (
                        <li key={cmd.name}>
                            <button
                                onClick={() => executeCommand(cmd)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-md transition-colors ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-foreground/80 hover:bg-accent'
                                }`}
                            >
                                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{cmd.icon}</div>
                                <span>{cmd.name}</span>
                            </button>
                        </li>
                      );
                  })}
              </ul>
          </div>
      )
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-20 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-popover border border-border rounded-xl shadow-2xl w-full max-w-lg transform transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-3 border-b border-border">
          <CommandIcon className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ask AI or type a command..."
            className="w-full bg-transparent focus:outline-none text-foreground placeholder-muted-foreground"
            autoFocus
          />
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <XIcon className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
            {renderCommands('General')}
            {renderCommands('Formatting')}
            {renderCommands('AI')}
            {filteredCommands.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">No commands found.</p>
            )}
        </div>
        {error && (
            <div className="p-3 border-t border-border text-destructive text-sm">
                {error}
            </div>
        )}
      </div>
    </div>
  );
};

export default CommandPalette;
