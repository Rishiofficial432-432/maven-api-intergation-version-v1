import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Page } from '../App';
import { geminiAI } from './gemini';
import { Type } from '@google/genai';
import { Search, X, Loader, FileText, AlertTriangle } from 'lucide-react';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  onSelectPage: (id: string) => void;
}

interface SearchResult {
  summary: string;
  source_notes: {
    id: string;
    title: string;
    relevance_score: number;
    snippet: string;
  }[];
}

const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, pages, onSelectPage }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setQuery('');
      setResult(null);
      setError(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !geminiAI) return;

    setIsSearching(true);
    setResult(null);
    setError(null);

    const tempDiv = document.createElement('div');
    const knowledgeBase = pages.map(page => {
        tempDiv.innerHTML = page.content;
        return {
            id: page.id,
            title: page.title,
            content: tempDiv.innerText, // Use innerText to strip HTML for a cleaner prompt
        };
    });

    const prompt = `You are a highly intelligent search assistant for a user's personal knowledge base. Your task is to answer the user's query based *only* on the provided content from their notes.

Here is the user's entire knowledge base, provided as a JSON array of notes:
--- KNOWLEDGE BASE START ---
${JSON.stringify(knowledgeBase)}
--- KNOWLEDGE BASE END ---

Here is the user's query:
--- QUERY START ---
${query}
--- QUERY END ---

Your response MUST be in a strict JSON format. Do not add any text before or after the JSON block. Analyze the knowledge base, find the most relevant information to the query, generate a summary, and identify up to 3 of the most relevant source notes.`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING, description: "A concise, synthesized answer to the user's query, based on the information found. If no relevant information is found, state that clearly." },
            source_notes: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: "The ID of the source note." },
                        title: { type: Type.STRING, description: "The title of the source note." },
                        relevance_score: { type: Type.NUMBER, description: "A number between 0 and 1 indicating relevance." },
                        snippet: { type: Type.STRING, description: "A short, relevant excerpt from the note that supports the summary." }
                    }
                }
            }
        }
    };

    try {
        const response = await geminiAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        const jsonStr = response.text.trim();
        const parsedResult: SearchResult = JSON.parse(jsonStr);
        setResult(parsedResult);

    } catch (err: any) {
        console.error("AI Search Error:", err);
        setError("Sorry, I couldn't process that search. The AI might be unavailable or the request was invalid.");
    } finally {
        setIsSearching(false);
    }
  };
  
  const handleSelectNote = (id: string) => {
      onSelectPage(id);
      onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSearch}>
            <div className="flex items-center gap-3 p-3 border-b border-border">
                <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything about your notes..."
                    className="w-full bg-transparent focus:outline-none text-foreground placeholder-muted-foreground"
                    autoFocus
                />
                <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-accent">
                    <X className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-4">
            {isSearching && (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <Loader className="w-8 h-8 animate-spin text-primary mb-4" />
                    <p className="font-semibold">Searching your knowledge base...</p>
                </div>
            )}
            {error && (
                 <div className="flex flex-col items-center justify-center p-8 text-destructive">
                    <AlertTriangle className="w-8 h-8 mb-4" />
                    <p className="font-semibold">Search Failed</p>
                    <p className="text-sm text-center">{error}</p>
                </div>
            )}
            {result && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Answer</h3>
                        <p className="text-foreground/90 leading-relaxed">{result.summary}</p>
                    </div>
                    {result.source_notes && result.source_notes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Sources</h3>
                            <div className="space-y-2">
                                {result.source_notes.map(note => (
                                    <button 
                                        key={note.id}
                                        onClick={() => handleSelectNote(note.id)}
                                        className="w-full text-left p-3 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-3 font-semibold text-primary">
                                            <FileText size={16} />
                                            <p>{note.title}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 pl-7 italic">"...{note.snippet}..."</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {!isSearching && !result && !error && (
                 <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <p>Find information instantly across all your notes.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SearchPalette;
