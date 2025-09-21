import React from 'react';
import { templates, NoteTemplate } from './templates';
import { X, FilePlus } from 'lucide-react';

interface TemplateLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: NoteTemplate) => void;
  onNewBlankPage: () => void;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onNewBlankPage,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-4xl transform transition-all duration-300 m-4 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: '0.3s'}}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Create a new page</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* Blank Page Option */}
            <button
              onClick={onNewBlankPage}
              className="group flex flex-col items-center justify-center p-6 bg-secondary hover:bg-accent border border-border rounded-lg transition-all text-center h-48"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-primary/20 text-primary rounded-lg mb-4 transition-transform group-hover:scale-110">
                <FilePlus />
              </div>
              <h3 className="font-semibold text-foreground">Blank Page</h3>
              <p className="text-xs text-muted-foreground mt-1">Start from scratch.</p>
            </button>
            {/* Template Options */}
            {templates.map((template) => {
              // FIX: The icon is now a component type, so it should be rendered as a component.
              // This fixes a TypeScript error where `cloneElement` could not infer the props of the icon element.
              const IconComponent = template.icon;
              return (
                <button
                  key={template.title}
                  onClick={() => onSelectTemplate(template)}
                  className="group flex flex-col items-center justify-center p-6 bg-secondary hover:bg-accent border border-border rounded-lg transition-all text-center h-48"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-primary/20 text-primary rounded-lg mb-4 transition-transform group-hover:scale-110">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">{template.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateLibrary;
