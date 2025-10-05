import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Notebook, NotebookSource, ChatMessage, Page } from '../types';
import { useToast } from './Toast';
import { usePdfJs } from './usePdfJs';
import { geminiAI } from './gemini';
import { Plus, BookCopy, FileText, UploadCloud, Trash2, Bot, Send, Sparkles, Save, Loader, X, Check } from 'lucide-react';

interface NotebookViewProps {
    notebooks: Notebook[];
    setNotebooks: React.Dispatch<React.SetStateAction<Notebook[]>>;
    sources: NotebookSource[];
    setSources: React.Dispatch<React.SetStateAction<NotebookSource[]>>;
    onNewNote: (title: string, content?: string) => Page;
}

const ActiveNotebookView: React.FC<{
    notebook: Notebook;
    allSources: NotebookSource[];
    updateNotebook: (updates: Partial<Notebook>) => void;
    addSource: (source: NotebookSource) => void;
    deleteSource: (sourceId: string) => void;
    onNewNote: (title: string, content?: string) => Page;
}> = ({ notebook, allSources, updateNotebook, addSource, deleteSource, onNewNote }) => {
    
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedOutput, setGeneratedOutput] = useState('');
    
    const toast = useToast();
    const { pdfjsLib, status: pdfJsStatus } = usePdfJs();
    const chatEndRef = useRef<HTMLDivElement>(null);

    const currentSources = useMemo(() => 
        allSources.filter(s => notebook.sourceIds.includes(s.id)), 
        [allSources, notebook.sourceIds]
    );

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [notebook.conversation]);
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        toast.info(`Processing ${file.name}...`);
        try {
            let content = '';
            if (file.type === 'application/pdf') {
                if (pdfJsStatus !== 'ready' || !pdfjsLib) throw new Error("PDF library is not ready. Please try again.");
                const typedArray = new Uint8Array(await file.arrayBuffer());
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    content += textContent.items.map((item: any) => item.str).join(' ');
                }
            } else if (file.type === 'text/plain' || file.type === 'text/markdown') {
                content = await file.text();
            } else {
                throw new Error("Unsupported file type. Please use PDF, TXT, or MD.");
            }

            const newSource: NotebookSource = {
                id: crypto.randomUUID(),
                fileName: file.name,
                content,
                createdAt: new Date().toISOString()
            };
            addSource(newSource);
            updateNotebook({ sourceIds: [...notebook.sourceIds, newSource.id] });
            toast.success(`${file.name} added as a source.`);
        } catch (err: any) {
            toast.error(`Failed to process file: ${err.message}`);
        } finally {
            e.target.value = ''; // Reset file input
        }
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatting || !geminiAI) return;
        
        const userMessage: ChatMessage = { role: 'user', content: chatInput };
        updateNotebook({ conversation: [...notebook.conversation, userMessage] });
        setChatInput('');
        setIsChatting(true);

        const context = currentSources.map(s => `--- SOURCE: ${s.fileName} ---\n${s.content}`).join('\n\n');
        const prompt = `You are an AI assistant in a tool like NotebookLM. Your task is to answer the user's query based ONLY on the provided source documents.
        
        --- CONTEXT FROM SOURCES ---
        ${context}
        --- END OF SOURCES ---
        
        User Query: "${chatInput}"
        
        Answer the query based strictly on the provided sources.`;
        
        try {
            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const modelMessage: ChatMessage = { role: 'model', content: response.text };
            updateNotebook({ conversation: [...notebook.conversation, userMessage, modelMessage] });
        } catch (err: any) {
            const errorMessage: ChatMessage = { role: 'model', content: `Sorry, I ran into an error: ${err.message}` };
            updateNotebook({ conversation: [...notebook.conversation, userMessage, errorMessage] });
        } finally {
            setIsChatting(false);
        }
    };

    const handleGenerateOutput = async (type: 'summary' | 'faq' | 'takeaways') => {
        if (currentSources.length === 0 || isGenerating || !geminiAI) {
            toast.error("Please add at least one source document first.");
            return;
        }
        setIsGenerating(true);
        setGeneratedOutput('');

        const context = currentSources.map(s => `--- SOURCE: ${s.fileName} ---\n${s.content}`).join('\n\n');
        let prompt = '';
        if (type === 'summary') prompt = "Provide a concise summary of all the provided source documents.";
        if (type === 'faq') prompt = "Generate a list of frequently asked questions (FAQs) and their answers based on the provided source documents.";
        if (type === 'takeaways') prompt = "Extract the key takeaways and main points from the provided source documents as a bulleted list.";
        
        const fullPrompt = `Based on the following source documents, ${prompt}\n\n--- SOURCES ---\n${context}`;

        try {
            const response = await geminiAI.models.generateContent({ model: 'gemini-2.5-flash', contents: fullPrompt });
            setGeneratedOutput(response.text);
        } catch (err: any) {
            setGeneratedOutput(`Error generating output: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveOutput = () => {
        if (!generatedOutput) return;
        const title = `AI Generated Output for ${notebook.title}`;
        const content = `<pre>${generatedOutput}</pre>`;
        onNewNote(title, content);
        toast.success("Output saved as a new note.");
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-accent/20">
            <header className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
                <h2 className="text-xl font-bold">{notebook.title}</h2>
            </header>
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-y-auto">
                {/* Sources Column */}
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
                    <h3 className="font-bold mb-3">Sources ({currentSources.length})</h3>
                    <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                        {currentSources.map(source => (
                            <div key={source.id} className="bg-secondary p-2 rounded-md flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={16} className="flex-shrink-0"/>
                                    <span className="truncate">{source.fileName}</span>
                                </div>
                                <button onClick={() => deleteSource(source.id)} className="text-destructive/70 hover:text-destructive p-1"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                    <label className="mt-4 w-full text-center cursor-pointer bg-primary/10 text-primary p-3 rounded-md text-sm font-semibold block border-2 border-dashed border-primary/20 hover:bg-primary/20">
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.md" />
                        <UploadCloud size={18} className="inline-block mr-2"/> Add Source
                    </label>
                </div>
                {/* Chat Column */}
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
                    <h3 className="font-bold mb-3 flex items-center gap-2"><Bot size={18}/> Ask Your Sources</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-2">
                        {notebook.conversation.map((msg, i) => (
                             <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'model' && <div className="w-6 h-6 rounded-full bg-primary flex-shrink-0"></div>}
                                <div className={`p-2.5 rounded-xl max-w-sm break-words text-sm ${ msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-accent text-accent-foreground/90 rounded-bl-none' }`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        {isChatting && <div className="flex items-start gap-2.5"><div className="w-6 h-6 rounded-full bg-primary flex-shrink-0"></div><div className="p-2.5 rounded-xl bg-accent"><Loader className="w-4 h-4 animate-spin"/></div></div>}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleChatSubmit} className="flex items-center gap-2 mt-auto">
                        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask a question..." className="w-full bg-input p-2 rounded-md text-sm" disabled={isChatting} />
                        <button type="submit" disabled={isChatting || !chatInput.trim()} className="p-2.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"><Send size={16}/></button>
                    </form>
                </div>
                {/* Outputs Column */}
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
                    <h3 className="font-bold mb-3 flex items-center gap-2"><Sparkles size={18}/> Generate Content</h3>
                    <div className="space-y-2 mb-4">
                        <button onClick={() => handleGenerateOutput('summary')} disabled={isGenerating} className="w-full text-left p-2 bg-secondary rounded-md text-sm hover:bg-secondary/80">Generate Summary</button>
                        <button onClick={() => handleGenerateOutput('faq')} disabled={isGenerating} className="w-full text-left p-2 bg-secondary rounded-md text-sm hover:bg-secondary/80">Generate FAQ</button>
                        <button onClick={() => handleGenerateOutput('takeaways')} disabled={isGenerating} className="w-full text-left p-2 bg-secondary rounded-md text-sm hover:bg-secondary/80">List Key Takeaways</button>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-input rounded-md p-3 relative">
                        {isGenerating && <div className="absolute inset-0 flex items-center justify-center bg-input/80"><Loader className="animate-spin"/></div>}
                        <pre className="whitespace-pre-wrap text-sm font-sans">{generatedOutput}</pre>
                    </div>
                    {generatedOutput && <button onClick={handleSaveOutput} className="mt-2 w-full flex items-center justify-center gap-2 p-2 bg-primary/20 text-primary text-sm font-semibold rounded-md"><Save size={16}/> Save to Notes</button>}
                </div>
            </main>
        </div>
    );
};

const NotebookView: React.FC<NotebookViewProps> = ({ notebooks, setNotebooks, sources, setSources, onNewNote }) => {
    const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(localStorage.getItem('maven-last-notebook-id'));
    const [isCreating, setIsCreating] = useState(false);
    const [newNotebookTitle, setNewNotebookTitle] = useState('');
    const newNotebookInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if(selectedNotebookId) localStorage.setItem('maven-last-notebook-id', selectedNotebookId);
        else localStorage.removeItem('maven-last-notebook-id');
    }, [selectedNotebookId]);
    
    useEffect(() => {
        if (isCreating) {
            newNotebookInputRef.current?.focus();
        }
    }, [isCreating]);

    const handleCreateNotebook = () => {
        const title = newNotebookTitle.trim();
        if (title) {
            const newNotebook: Notebook = {
                id: crypto.randomUUID(),
                title,
                sourceIds: [],
                conversation: [],
                createdAt: new Date().toISOString()
            };
            setNotebooks(prev => [newNotebook, ...prev]);
            setSelectedNotebookId(newNotebook.id);
        }
        setNewNotebookTitle('');
        setIsCreating(false);
    };

    const handleNewNotebookKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCreateNotebook();
        } else if (e.key === 'Escape') {
            setNewNotebookTitle('');
            setIsCreating(false);
        }
    };
    
    const handleDeleteNotebook = (id: string) => {
        if (window.confirm("Are you sure you want to delete this notebook and all its associated sources?")) {
            const notebookToDelete = notebooks.find(n => n.id === id);
            if(notebookToDelete) {
                setSources(prev => prev.filter(s => !notebookToDelete.sourceIds.includes(s.id)));
            }
            
            const remainingNotebooks = notebooks.filter(n => n.id !== id);
            setNotebooks(remainingNotebooks);
            
            if (selectedNotebookId === id) {
                 const sortedRemaining = remainingNotebooks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setSelectedNotebookId(sortedRemaining.length > 0 ? sortedRemaining[0].id : null);
            }
        }
    };

    const sortedNotebooks = useMemo(() => 
        [...notebooks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), 
    [notebooks]);

    const selectedNotebook = useMemo(() => 
        notebooks.find(n => n.id === selectedNotebookId),
        [notebooks, selectedNotebookId]
    );

    const updateNotebook = (updates: Partial<Notebook>) => {
        if (!selectedNotebookId) return;
        setNotebooks(prev => prev.map(nb => nb.id === selectedNotebookId ? { ...nb, ...updates } : nb));
    };
    
    const addSource = (source: NotebookSource) => {
        setSources(prev => [...prev, source]);
    };

    const deleteSource = (sourceId: string) => {
        setSources(prev => prev.filter(s => s.id !== sourceId));
        if (selectedNotebook) {
            updateNotebook({ sourceIds: selectedNotebook.sourceIds.filter(id => id !== sourceId) });
        }
    };


    return (
        <div className="flex h-full">
            <aside className="w-64 bg-card/80 border-r border-border/50 flex flex-col">
                <div className="p-3 border-b border-border/50">
                    {isCreating ? (
                        <div className="flex items-center gap-2">
                            <input
                                ref={newNotebookInputRef}
                                type="text"
                                value={newNotebookTitle}
                                onChange={(e) => setNewNotebookTitle(e.target.value)}
                                onKeyDown={handleNewNotebookKeyDown}
                                onBlur={() => { if(!newNotebookTitle) setIsCreating(false); }}
                                placeholder="Notebook Title..."
                                className="w-full bg-input p-2 rounded-md text-sm"
                            />
                            <button onClick={handleCreateNotebook} className="p-2 bg-primary text-primary-foreground rounded-md"><Check size={16}/></button>
                            <button onClick={() => { setIsCreating(false); setNewNotebookTitle(''); }} className="p-2 bg-secondary rounded-md"><X size={16}/></button>
                        </div>
                    ) : (
                        <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 p-2 bg-primary text-primary-foreground rounded-md font-semibold text-sm">
                            <Plus size={16}/> New Notebook
                        </button>
                    )}
                </div>
                <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sortedNotebooks.map(nb => (
                        <div key={nb.id} className="group flex items-center">
                            <button onClick={() => setSelectedNotebookId(nb.id)} className={`flex-1 flex items-center gap-2 p-2 rounded-md text-sm text-left ${selectedNotebookId === nb.id ? 'bg-accent text-accent-foreground font-semibold' : 'text-muted-foreground hover:bg-accent/50'}`}>
                                <BookCopy size={16} className="flex-shrink-0"/>
                                <span className="truncate">{nb.title}</span>
                            </button>
                             <button onClick={() => handleDeleteNotebook(nb.id)} className="p-2 text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </nav>
            </aside>

            {selectedNotebook ? (
                <ActiveNotebookView 
                    notebook={selectedNotebook} 
                    allSources={sources}
                    updateNotebook={updateNotebook}
                    addSource={addSource}
                    deleteSource={deleteSource}
                    onNewNote={onNewNote}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <BookCopy size={48} className="text-primary mb-4"/>
                    <h2 className="text-2xl font-bold">Select or Create a Notebook</h2>
                    <p className="text-muted-foreground mt-2 max-w-sm">Create a notebook, add your source documents, and start asking questions or generating content with AI.</p>
                </div>
            )}
        </div>
    );
};

export default NotebookView;