import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <section className="bg-card/50 border border-border/50 rounded-xl shadow-lg p-6 sm:p-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-6 pb-4 border-b border-border">
        {title}
      </h2>
      <div className="prose prose-invert max-w-none prose-p:text-card-foreground/90 prose-li:text-card-foreground/90">
        {children}
      </div>
    </section>
  );
};