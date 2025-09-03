import React from 'react';
import { Section } from './Section';
import { BrainCircuit, Lock, Zap, FileSearch, Box } from 'lucide-react';

const FeatureItem: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <li className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center mt-1">
            {icon}
        </div>
        <div>
            <h4 className="font-bold text-card-foreground">{title}</h4>
            <p className="text-card-foreground/80 text-sm">{children}</p>
        </div>
    </li>
);

const AboutPage: React.FC = () => {
    return (
        <main className="flex-1 p-8 overflow-y-auto bg-background text-foreground">
            <div className="space-y-8 max-w-5xl mx-auto">
                <Section title="About Maven: Your Intelligent Workspace">
                    <p>
                        Maven is your intelligent workspace, an all-in-one productivity suite combining AI-powered notes, task management, and planning tools to organize your life and amplify your creativity. It is designed from the ground up to be a single, unified hub for all your personal and professional productivity needs, eliminating the clutter and inefficiency of switching between multiple applications.
                    </p>
                    <p>
                        At its core, Maven operates on a <strong>privacy-first, local-first</strong> principle. All your data is stored securely on your own device, ensuring that you have complete ownership and control over your information.
                    </p>
                </Section>

                <Section title="The Problem Maven Solves">
                    <p>
                        In today's digital landscape, productivity is often fragmented across a dozen different apps. This fragmentation leads to information silos, context switching that drains mental energy, lack of integration, and significant privacy concerns.
                    </p>
                    <p>
                        Maven addresses these challenges by providing a cohesive, intelligent, and private environment where all your productivity tools coexist and interact seamlessly.
                    </p>
                </Section>
                
                <Section title="Key Features: An Integrated Powerhouse">
                     <ul className="space-y-6">
                        <FeatureItem icon={<Box size={20} />} title="Over 15 Powerful Tools">
                            Maven integrates a comprehensive suite of features, including a rich-text editor, dashboard with widgets (Tasks, Kanban, Calendar, Pomodoro, Habits, etc.), a dedicated Journal, and an innovative mind-mapping tool.
                        </FeatureItem>
                         <FeatureItem icon={<BrainCircuit size={20} />} title="AI-Powered Intelligence">
                            The AI Assistant, powered by Google's Gemini model, acts as your command center. Use natural language to manage tasks, schedule events, generate content, and control the entire application with unparalleled efficiency.
                        </FeatureItem>
                         <FeatureItem icon={<Lock size={20} />} title="Uncompromising Privacy">
                            All your data is stored 100% locally in your browser. It never leaves your device, giving you a level of security and ownership that cloud-based services cannot match. Your privacy is a feature, not an afterthought.
                        </FeatureItem>
                         <FeatureItem icon={<FileSearch size={20} />} title="Innovative DocuMind View">
                           Automatically generate interactive, explorable mind maps from your documents (.txt, .pdf, .docx, etc.). This unique tool helps you visualize and understand complex information in a new way.
                        </FeatureItem>
                         <FeatureItem icon={<Zap size={20} />} title="Zero-Friction Experience">
                            No accounts, no sign-ups, no subscriptions. Maven is instantly usable, removing all barriers to entry for new users to start organizing their lives immediately.
                        </FeatureItem>
                    </ul>
                </Section>

                <Section title="Unique Selling Propositions (USPs)">
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>True All-in-One Integration:</strong> Maven uniquely combines over 15 tools into a single, cohesive interface, eliminating the need for multiple apps and subscriptions.</li>
                        <li><strong>Privacy-First Architecture:</strong> By storing all data locally, Maven offers a level of privacy that cloud services cannot, making it ideal for sensitive information.</li>
                        <li><strong>Function-Driven AI Command Center:</strong> The AI is a "do-engine," reliably executing commands across the app, making you significantly more efficient.</li>
                        <li><strong>Innovative DocuMind Visualizer:</strong> Turns static documents into active tools for thought, a feature unique to Maven.</li>
                    </ul>
                </Section>

                <Section title="Future Roadmap">
                    <p>To evolve from a powerful local tool into a mainstream competitor, Maven is focused on:</p>
                     <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Optional, End-to-End Encrypted Cloud Sync:</strong> To enable secure multi-device access without compromising privacy.</li>
                        <li><strong>Enhanced Editor:</strong> Adding features like tables, callout blocks, and bi-directional linking to transform it into a true personal knowledge management system.</li>
                        <li><strong>Deeper, Context-Aware AI:</strong> Allowing the AI to perform semantic searches across your entire knowledge base to synthesize answers from your own data.</li>
                        <li><strong>Collaboration Features:</strong> Introducing real-time collaboration on notes and Kanban boards for teams.</li>
                    </ul>
                </Section>
            </div>
        </main>
    );
};

export default AboutPage;