import React from 'react';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const trimmedCode = code.trim();
  return (
    <div className="bg-secondary rounded-lg overflow-hidden border border-border my-4">
      <div className="flex justify-between items-center px-4 py-2 bg-accent border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
         <button 
            onClick={() => navigator.clipboard.writeText(trimmedCode)} 
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
            aria-label="Copy code"
        >
            Copy
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className={`language-${language}`}>{trimmedCode}</code>
      </pre>
    </div>
  );
};