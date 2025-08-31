import React from 'react';
import { Page, View } from '../App';
import { PlusIcon, FileTextIcon, BookIcon, LayoutGridIcon } from './Icons';
import { 
  Home, CheckSquare, List, Calendar, Timer, Target, BarChart3, User, Settings, HelpCircleIcon, FileText, Dice6, BookText, Clipboard, FileSearch,
  ChevronLeft, ChevronRight, Briefcase, Users, BrainCircuit, Search
} from 'lucide-react';


interface SidebarProps {
  pages: Page[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onNewPage: (title?: string) => Page;
  view: View;
  setView: (view: View) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onToggleSearch: () => void;
}

const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'braindump', icon: BrainCircuit, label: 'AI Brain Dump' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
    { id: 'kanban', icon: List, label: 'Kanban Board' },
    { id: 'attendance', icon: Clipboard, label: 'Attendance' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'timer', icon: Timer, label: 'Pomodoro' },
    { id: 'decision', icon: Dice6, label: 'Decision Maker' },
    { id: 'notes', icon: FileText, label: 'Quick Notes' },
    { id: 'habits', icon: Target, label: 'Habit Tracker' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'personal', icon: User, label: 'Personal' },
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'help', icon: HelpCircleIcon, label: 'Help & Guide' },
];

const Sidebar: React.FC<SidebarProps> = ({
  pages, activePageId, onSelectPage, onNewPage, view, setView, activeTab, setActiveTab, isCollapsed, setIsCollapsed, onToggleSearch
}) => {
  return (
    <aside className={`bg-card/80 backdrop-blur-xl flex flex-col border-l border-border/50 flex-shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex-shrink-0">
        <div className="p-4 border-b border-border/50 flex items-center justify-center">
           <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-lg">M</span>
              </div>
              {!isCollapsed && <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">Maven</h1>}
           </div>
        </div>

        <nav className="p-3 space-y-2 border-b border-border/50">
             <button
                onClick={onToggleSearch}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                title="AI Search (Cmd/Ctrl+P)"
            >
                <Search className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="flex-1 text-left">AI Search</span>}
                {!isCollapsed && (
                    <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-xs">⌘</span>P
                    </kbd>
                )}
            </button>
            <button
                onClick={() => setView('notes')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'} ${view === 'notes' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}`}
                title="Notes"
            >
                <BookIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>Notes</span>}
            </button>
            <button
                onClick={() => setView('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'} ${view === 'dashboard' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}`}
                title="Dashboard"
            >
                <LayoutGridIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
            </button>
             <button
                onClick={() => setView('journal')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'} ${view === 'journal' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}`}
                title="Journal"
            >
                <BookText className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>Journal</span>}
            </button>
            <button
                onClick={() => setView('documind')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'} ${view === 'documind' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}`}
                title="DocuMind"
            >
                <FileSearch className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>DocuMind</span>}
            </button>
            <button
                onClick={() => setView('workspace')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'} ${view === 'workspace' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}`}
                title="Google Workspace"
            >
                <Briefcase className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>Workspace</span>}
            </button>
             <button
                onClick={() => setView('portal')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'} ${view === 'portal' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}`}
                title="Student Portal"
            >
                <Users className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>Portal</span>}
            </button>
        </nav>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {view === 'notes' ? (
          <>
            <div className="p-3">
              <button
                onClick={() => onNewPage()}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors duration-200 shadow-[0_0_20px_rgba(100,100,255,0.2)] focus:outline-none focus:ring-2 focus:ring-ring`}
                aria-label="Create new page"
                title="New Page"
              >
                <PlusIcon className="w-4 h-4" />
                {!isCollapsed && <span>New Page</span>}
              </button>
            </div>
            <nav className="p-2 space-y-1">
              {pages.map((page) => (
                <a
                  key={page.id}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectPage(page.id);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-150 group ${isCollapsed ? 'justify-center' : ''} ${
                    activePageId === page.id
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                  }`}
                   title={page.title}
                >
                  <FileTextIcon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span className="truncate flex-1">{page.title}</span>}
                </a>
              ))}
            </nav>
          </>
        ) : view === 'dashboard' ? (
            <nav className="p-4 space-y-2">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors text-left text-foreground/80 ${isCollapsed ? 'justify-center' : ''} ${activeTab === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}
                        title={item.label}
                    >
                        <item.icon size={18} className="flex-shrink-0 w-5 h-5"/>
                        {!isCollapsed && <span>{item.label}</span>}
                    </button>
                ))}
            </nav>
        ) : (
          <div className={`p-4 text-center text-muted-foreground text-sm flex flex-col items-center`}>
             {view === 'journal' && <BookText className="w-8 h-8 mx-auto mb-2"/>}
             {view === 'documind' && <FileSearch className="w-8 h-8 mx-auto mb-2"/>}
             {view === 'workspace' && <Briefcase className="w-8 h-8 mx-auto mb-2"/>}
             {view === 'portal' && <Users className="w-8 h-8 mx-auto mb-2"/>}
            {!isCollapsed && <p className="capitalize">{view}</p>}
          </div>
        )}
      </div>
       <div className="mt-auto p-3 border-t border-border/50">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;