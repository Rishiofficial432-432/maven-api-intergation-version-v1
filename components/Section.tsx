import React from 'react';

interface SectionProps {
  // FIX: Changed title prop from string to React.ReactNode to allow complex titles with icons.
  title: React.ReactNode;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <section className="bg-card/50 border border-border/50 rounded-xl shadow-lg p-6 sm:p-8">
      {/* FIX: Added flex styles to properly align titles that contain icons and text. */}
      <h2 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-6 pb-4 border-b border-border flex items-center gap-3">
        {title}
      </h2>
      <div className="prose prose-invert max-w-none prose-p:text-card-foreground/90 prose-li:text-card-foreground/90">
        {children}
      </div>
    </section>
  );
};