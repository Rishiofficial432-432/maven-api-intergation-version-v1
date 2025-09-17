
import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../types';
import CommandPalette from './AiToolbar';
import { TrashIcon, ImageIcon, Wand2Icon } from './Icons';
import { 
    Mail, Music, Facebook, Instagram, Twitter, Pin, BrainCircuit, Search, MessageSquare, Zap, Sparkles
} from 'lucide-react';
import { getBannerData, setBannerData } from './db';

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

// FIX: The component was incomplete, missing its implementation and return statement, which caused the build error.
// The file was truncated. This completes the component with necessary logic and JSX.
// Also, it's changed to a named export to resolve a circular dependency with App.tsx.
export const Editor: React.FC<EditorProps> = ({ page, onUpdatePage, onDeletePage, onNewPage }) => {
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
    { name: 'Twitter', url: 'https://x.com', icon: <Twitter size={18} />, color: 'hover:text-blue-400' },
  ];
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    debouncedUpdate(page.id, { title: newTitle });
  };
  
  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    debouncedUpdate(page.id, { content: newContent });
  };

  const handleAiResult = (result: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = result.replace(/\n/g, '<br />'); // Basic formatting
      debouncedUpdate(page.id, { content: editorRef.current.innerHTML });
    }
  };
  
  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if(editorRef.current) {
        debouncedUpdate(page.id, { content: editorRef.current.innerHTML });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Image = e.target?.result as string;
        const img = document.createElement('img');
        img.src = base64Image;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.margin = '1rem 0';
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, img.outerHTML);
        if (editorRef.current) {
            debouncedUpdate(page.id, { content: editorRef.current.innerHTML });
        }
    };
    reader.readAsDataURL(file);
  };
  
  const handleInsertImage = () => {
    imageInputRef.current?.click();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden">
      <Banner page={page} onUpdatePage={onUpdatePage} />
      <div className="flex-1 flex flex-col overflow-y-auto">
          <header className="px-4 sm:px-6 md:px-8 pt-8">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Untitled Page"
              className="w-full bg-transparent text-3xl sm:text-4xl font-bold focus:outline-none placeholder-muted-foreground/50"
            />
          </header>
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentChange}
            data-placeholder="Start writing, or press Cmd+K for AI..."
            className="relative flex-1 w-full px-4 sm:px-6 md:px-8 py-6 bg-transparent text-foreground/90 focus:outline-none resize-none leading-8 editor-content prose prose-invert max-w-none"
            aria-label="Page content"
          />
          <input type="file" ref={imageInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
      </div>
       <footer className="px-4 sm:px-6 md:px-8 py-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
            <div className="flex items-center gap-2">
                <button onClick={() => setCommandPaletteOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-accent text-accent-foreground rounded-md hover:bg-accent/80 transition-colors">
                    <Sparkles size={14}/> Ask AI
                    <kbd className="ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
                 {isAiLoading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
            </div>
            <div className="flex items-center gap-3">
                {externalTools.map(tool => (
                    <a href={tool.url} target="_blank" rel="noopener noreferrer" key={tool.name} title={tool.name} className={`text-muted-foreground transition-colors ${tool.color}`}>
                        {tool.icon}
                    </a>
                ))}
                 <button onClick={() => onDeletePage(page.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete Page">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </footer>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        text={editorRef.current?.innerText || ''}
        onResult={handleAiResult}
        onLoading={setIsAiLoading}
        onNewPage={onNewPage}
        onDeletePage={() => onDeletePage(page.id)}
        onFormat={handleFormat}
        onInsertImage={handleInsertImage}
      />
    </div>
  );
};