import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../App';
import CommandPalette from './AiToolbar';
import { TrashIcon, ImageIcon, Wand2Icon } from './Icons';
import { 
    Mail, Music, Facebook, Instagram, Twitter, Pin, BrainCircuit, Search, MessageSquare, Zap, Sparkles
} from 'lucide-react';
import { getBannerData, setBannerData } from '../App';

interface EditorProps {
  page: Page;
  onUpdatePage: (id: string, updates: Partial<Omit<Page, 'id'>>) => void;
  onDeletePage: (id: string) => void;
  onNewPage: () => void;
}

interface BannerProps {
    page: Page;
    onUpdatePage: (id: string, updates: Partial<Omit<Page, 'id'>>) => void;
}

const Banner: React.FC<BannerProps> = ({ page, onUpdatePage }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [displayUrl, setDisplayUrl] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        
        const loadBanner = async () => {
            if (page.bannerUrl) {
                if (page.bannerUrl.startsWith('data:')) {
                    // Handle legacy base64 URLs
                    setDisplayUrl(page.bannerUrl);
                } else {
                    // Fetch from IndexedDB
                    try {
                        const fileBlob = await getBannerData(page.bannerUrl);
                        if (fileBlob) {
                            objectUrl = URL.createObjectURL(fileBlob);
                            setDisplayUrl(objectUrl);
                        } else {
                            console.warn(`Banner file not found in DB: ${page.bannerUrl}`);
                            setDisplayUrl(null); 
                        }
                    } catch (error) {
                        console.error("Failed to load banner from DB:", error);
                        setDisplayUrl(null);
                    }
                }
            } else {
                setDisplayUrl(null);
            }
        };

        loadBanner();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [page.bannerUrl]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const bannerId = crypto.randomUUID();
            await setBannerData(bannerId, file);
            const bannerType = file.type.startsWith('video/') ? 'video' : 'image';
            onUpdatePage(page.id, { bannerUrl: bannerId, bannerType });
        } catch (error) {
            console.error("Failed to save banner to DB:", error);
            alert("Could not save banner. The file might be too large or there was a database error.");
        }
    };

    const handleRemoveBanner = () => {
        onUpdatePage(page.id, { bannerUrl: undefined, bannerType: undefined });
    };

    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div className="w-full h-48 bg-card/50 group relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/mp4,video/webm,video/ogg"
            />
            {displayUrl ? (
                 <>
                    {page.bannerType === 'video' ? (
                        <video src={displayUrl} className="w-full h-full object-cover" autoPlay loop muted />
                    ) : (
                        <img src={displayUrl} alt="Banner" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={triggerFileSelect} className="px-3 py-1.5 text-xs bg-background/50 text-white rounded-md hover:bg-background/80 backdrop-blur-sm">Change</button>
                         <button onClick={handleRemoveBanner} className="p-1.5 bg-background/50 text-white rounded-md hover:bg-background/80 backdrop-blur-sm"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                </>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <button onClick={triggerFileSelect} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-accent rounded-md hover:bg-accent/80 transition-colors opacity-50 group-hover:opacity-100">
                        <ImageIcon className="w-4 h-4" />
                        Add Banner
                    </button>
                </div>
            )}
        </div>
    );
}

const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
    const timeoutRef = useRef<number | null>(null);
    return (...args: any[]) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => callback(...args), delay);
    };
};

const Editor: React.FC<EditorProps> = ({ page, onUpdatePage, onDeletePage, onNewPage }) => {
  const [title, setTitle] = useState(page.title);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const debouncedUpdate = useDebounce(onUpdatePage, 500);

  // This effect synchronizes the page prop to the DOM editor and title state.
  // It makes the component "uncontrolled" during typing, but controlled when the page prop changes.
  useEffect(() => {
    if (editorRef.current && page.content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = page.content;
    }
    setTitle(page.title);
  }, [page]);


  const externalTools = [
    { name: 'Gmail', url: 'https://mail.google.com', icon: <Mail size={18} />, color: 'hover:text-red-500' },
    { name: 'Spotify', url: 'https://open.spotify.com', icon: <Music size={18} />, color: 'hover:text-green-500' },
    { name: 'Facebook', url: 'https://facebook.com', icon: <Facebook size={18} />, color: 'hover:text-blue-600' },
    { name: 'Instagram', url: 'https://instagram.com', icon: <Instagram size={18} />, color: 'hover:text-pink-500' },
    { name: 'Twitter', url: 'https://x.com', icon: <Twitter size={18} />, color: 'hover:text-sky-500' },
    { name: 'Pinterest', url: 'https://pinterest.com', icon: <Pin size={18} />, color: 'hover:text-red-700' },
    { divider: true },
    { name: 'Gemini', url: 'https://gemini.google.com', icon: <Sparkles size={18} />, color: 'hover:text-blue-500' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: <BrainCircuit size={18} />, color: 'hover:text-teal-500' },
    { name: 'Perplexity', url: 'https://perplexity.ai', icon: <Search size={18} />, color: 'hover:text-blue-400' },
    { name: 'Claude', url: 'https://claude.ai', icon: <MessageSquare size={18} />, color: 'hover:text-orange-600' },
    { name: 'Grok', url: 'https://grok.x.ai', icon: <Zap size={18} />, color: 'hover:text-purple-600' }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(isOpen => !isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    debouncedUpdate(page.id, { title: e.target.value });
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    debouncedUpdate(page.id, { content: newContent });
  };
  
  const handleAiResult = (result: string) => {
      if (!editorRef.current || !result.trim()) return;

      const formattedResult = `<br/><p>${result.replace(/\n/g, '<br/>')}</p>`;
      
      // Append new content
      editorRef.current.innerHTML += formattedResult;

      // Focus and move cursor to the very end
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false); // false to collapse to the end
          selection.removeAllRanges();
          selection.addRange(range);
      }
      
      // Manually trigger input event to save
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      editorRef.current.dispatchEvent(inputEvent);
  };

  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageUrl = event.target?.result as string;
            const imgHtml = `<img src="${imageUrl}" alt="user image" />`;
            editorRef.current?.focus();
            document.execCommand('insertHTML', false, imgHtml);
            // Manually trigger input event to save
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            editorRef.current.dispatchEvent(inputEvent);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleFormat = (command: string, value?: string) => {
    if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
        // Manually trigger input event to save changes
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        editorRef.current.dispatchEvent(inputEvent);
    }
  };


  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
        <style>{`
            .editor-content:empty:before {
                content: attr(data-placeholder);
                color: hsl(var(--muted-foreground));
                pointer-events: none;
                position: absolute;
                top: 0;
                left: 0;
            }
        `}</style>
        <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageInsert}
            className="hidden"
            accept="image/*"
        />
        <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onResult={handleAiResult}
            onLoading={setIsAiLoading}
            text={editorRef.current?.innerText || ''}
            onNewPage={onNewPage}
            onDeletePage={() => onDeletePage(page.id)}
            onFormat={handleFormat}
            onInsertImage={() => imageInputRef.current?.click()}
        />
      
        <div className="flex-1 flex flex-col overflow-y-auto" key={page.id}>
            <Banner page={page} onUpdatePage={onUpdatePage}/>
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-8 flex flex-col">
                <div className="flex items-center justify-between mb-4 gap-4">
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled Page"
                        className="w-full bg-transparent text-4xl font-bold text-foreground placeholder-muted-foreground focus:outline-none"
                        aria-label="Page title"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {externalTools.map((tool, index) => (
                            tool.divider ?
                            <div key={`divider-${index}`} className="w-px h-6 bg-border mx-2"></div>
                            :
                            <a
                                key={tool.name}
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={tool.name}
                                className={`w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-accent ${tool.color}`}
                            >
                                {tool.icon}
                            </a>
                        ))}
                        <div className="w-px h-6 bg-border mx-2"></div>
                        <button onClick={() => imageInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent rounded-full transition-colors" aria-label="Insert image">
                            <ImageIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDeletePage(page.id)} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-accent rounded-full transition-colors" aria-label="Delete page">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div
                    ref={editorRef}
                    contentEditable={!isAiLoading}
                    onInput={handleContentChange}
                    data-placeholder="Start writing, or press Cmd+K for AI..."
                    className="relative flex-1 w-full bg-transparent text-foreground/90 focus:outline-none resize-none leading-8 text-lg editor-content"
                    aria-label="Page content"
                />
            </main>
        </div>
         {isAiLoading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center text-foreground">Generating...</div>}
         <button
            onClick={() => setCommandPaletteOpen(true)}
            className="absolute bottom-8 right-8 w-14 h-14 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/50 hover:bg-primary/90 transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-primary/50"
            aria-label="Open AI Command Palette"
        >
            <Wand2Icon className="w-7 h-7" />
        </button>
    </div>
  );
};

export default Editor;
