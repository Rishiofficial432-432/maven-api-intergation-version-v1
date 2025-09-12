import React from 'react';
import { Section } from './Section';

export const HelpPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-center text-foreground mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
        Maven: A Deep Dive
      </h1>
      <p className="text-center text-muted-foreground -mt-6 mb-12">Your Intelligent Workspace Explained</p>

      <Section title="1. The Core Philosophy: Your Data, Your Device">
        <p>
          Before diving into the features, it's essential to understand what makes Maven different. It is a <strong>local-first</strong> and <strong>privacy-first</strong> application.
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-4">
          <li>
            <strong>What this means for you:</strong> All your information—every note, task, journal entry, and setting—is stored directly on your computer's hard drive, within your web browser's secure storage. Your data never leaves your device unless you explicitly use an AI feature (which sends only that specific request to Google's servers) or the Google Workspace integration.
          </li>
          <li>
            <strong>The benefits:</strong> You have absolute ownership and privacy. The app works perfectly offline, and there are no accounts or sign-ups required. The one exception to this is the optional Student/Teacher Portal, which requires a cloud database (Supabase) to function, but this is a self-contained module that you control.
          </li>
        </ul>
      </Section>
      
      <Section title="2. The Minimum Viable Product (MVP) - The Core of Maven">
        <p>The core value proposition of Maven is to provide a <strong>private, unified space to capture, organize, and act on your thoughts.</strong> The MVP focuses on delivering this value in the most direct way possible, establishing the foundation upon which all other features are built.</p>
        <h3 className="text-xl font-bold text-white mt-6 mb-2">Feature 1: The Note-Taking Engine</h3>
        <p>This is the foundation for capturing ideas. The MVP consists of a clean, capable, and distraction-free editor. A user can create a new note, give it a title, and write content. This content is automatically saved to their browser as they type. They can create multiple notes and switch between them. This feature single-handedly fulfills the "capture" part of the core value proposition, providing a reliable place to store information.</p>
        
        <h3 className="text-xl font-bold text-white mt-6 mb-2">Feature 2: The Action-Oriented Dashboard</h3>
        <p>To fulfill the "organize and act" part of the value proposition, the MVP includes a simple Dashboard view containing a functional to-do list. A user can type a task into an input field and add it to their list. They can then check a box to mark the task as complete, which visually distinguishes it (e.g., with a strikethrough). This demonstrates immediate utility beyond simple note-taking, allowing users to turn thoughts into concrete, actionable items.</p>
        
        <h3 className="text-xl font-bold text-white mt-6 mb-2">Feature 3: The Intelligent Command Layer (AI Assistant)</h3>
        <p>This feature establishes the "intelligent" and "unified" aspects of Maven from day one. The MVP includes the chat interface on the right side of the screen. Its core purpose is to act as a "do-engine." A user can type a command like <em>"add a task to buy milk"</em> or <em>"create a new note about my project ideas."</em> The AI understands the intent and directly performs the action—adding the task to the Task widget or creating a new, empty note—without the user needing to navigate to the respective modules. This showcases the seamless, command-driven workflow that is central to the Maven experience.</p>

        <h3 className="text-xl font-bold text-white mt-6 mb-2">Feature 4: The Power Switch (Settings)</h3>
        <p>To enable the AI, the user needs to provide their own API key. The MVP includes a basic Settings page with a single input field for the Google Gemini API key. This is a necessary utility to unlock the intelligent aspect of the product. The key is saved securely in the browser's local storage, maintaining the privacy-first principle.</p>
      </Section>

      <Section title="3. The Full Maven Experience - A Comprehensive Tour">
        <p>The current version of Maven has evolved far beyond the MVP, integrating over 15 distinct features into a cohesive whole.</p>

        <h3 className="text-2xl font-bold text-white mt-6 mb-4">The Main Interface: Your Three Control Panels</h3>
        <p>The application is divided into three distinct vertical sections:</p>
        <ol className="list-decimal pl-6 space-y-2 mt-4">
          <li><strong>The Left Sidebar (Navigation):</strong> This is how you move between the major sections of the app: the <strong>Dashboard</strong>, <strong>Academics Hub</strong>, <strong>Notes</strong>, <strong>Journal</strong>, and <strong>DocuMind</strong>, among others.</li>
          <li><strong>The Center Content Area (Your Workspace):</strong> This is the largest section and is where you do your work.</li>
          <li><strong>The Right Sidebar (The AI Assistant):</strong> Your intelligent command center for controlling the entire application.</li>
        </ol>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Module 1: The Dashboard - Your Daily Command Center</h3>
        <p>The Dashboard is a collection of powerful widgets for managing your day-to-day life.</p>
        <ul className="list-disc pl-6 space-y-4 mt-4">
            <li><strong>AI Brain Dump:</strong> Turn chaotic thoughts into organized actions. Paste unstructured text, and the AI will suggest categorized items (tasks, events, notes) that you can approve and add to your workspace with a single click.</li>
            <li><strong>Tasks & Kanban Board:</strong> Beyond a simple to-do list, the Kanban board lets you visualize your workflow by dragging cards through "To Do," "In Progress," and "Done" columns.</li>
            <li><strong>Calendar & Quick Notes:</strong> Schedule events and jot down fleeting thoughts that don't need a full note page.</li>
            <li><strong>Pomodoro Timer & Habit Tracker:</strong> Use the timer for focused work sessions and track daily habits to build streaks and maintain consistency.</li>
            <li><strong>Decision Maker & Personal Suite:</strong> Get help making choices and track personal goals, mood, expenses, and inspirational quotes.</li>
        </ul>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Module 2: The Notes View - Your Knowledge Base</h3>
        <p>This is your primary space for writing. Create unlimited notes with a rich text editor and personalize each with an image or video banner. Use the AI Command Palette (<code className="bg-secondary text-primary px-2 py-1 rounded-md text-xs font-mono">Cmd+K / Ctrl+K</code>) to instantly summarize, improve, or translate your text.</p>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Module 3: The Journal - Your Private Logbook</h3>
        <p>A dedicated space for daily reflection. It features a calendar for easy navigation, and dates with entries are marked, giving you a visual overview of your journaling consistency.</p>
        
        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Module 4: DocuMind - Your Visual Explorer</h3>
        <p>This innovative tool turns static documents (PDF, Word, etc.) into dynamic, interactive mind maps. It automatically visualizes the document's structure, and you can click any node to get an AI-powered explanation of that concept based on the document's content.</p>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Module 5: The Academics Hub - The Educational Core</h3>
        <p>A central place for all learning-related tools.</p>
        <ul className="list-disc pl-6 space-y-4 mt-4">
            <li><strong>The Student/Teacher Portal:</strong> A powerful, real-time attendance system. Teachers can create sessions, generate secure check-in codes, and optionally enforce GPS-based location verification. Students check in instantly, and their attendance appears on the teacher's live dashboard.</li>
            <li><strong>The AI Timetable Scheduler:</strong> Automates the complex task of creating a school timetable. An administrator uploads an Excel file with teacher, subject, and class data, and the system generates a complete, clash-free schedule.</li>
            <li><strong>The AI Daily Routine Planner:</strong> For students, this tool analyzes their fixed schedule and long-term goals to generate a personalized plan, suggesting productive tasks for their free periods.</li>
        </ul>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Module 6: Google Workspace & External Connections</h3>
        <p>Securely connect your Google account to search your Google Drive from within Maven. A single click imports a Google Doc or Sheet as a new, fully-formatted note.</p>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4">Global Intelligence: Features That Work Everywhere</h3>
        <ul className="list-disc pl-6 space-y-4 mt-4">
            <li><strong>The AI Assistant (Right Sidebar):</strong> Your universal command center. Use natural language for any task, from "add a habit to exercise daily" to "schedule a meeting for Friday."</li>
            <li><strong>The Global AI Search (<code className="bg-secondary text-primary px-2 py-1 rounded-md text-xs font-mono">Cmd+P / Ctrl+P</code>):</strong> Your personal search engine. Ask a question like "what were my takeaways from the Project Phoenix meetings?" and the AI will search all your notes, synthesize a direct answer, and link to the sources.</li>
        </ul>
      </Section>
      
      <Section title="4. Conclusion: The Maven Philosophy in Practice">
        <p>Maven brings together over a dozen powerful tools into a single, cohesive application. By starting with a core of capturing and organizing thoughts, and then layering on intelligent, action-oriented features, it creates a workspace that is both powerful and deeply personal. Its unwavering commitment to local-first data ensures that this powerful space is also completely private and secure.</p>
      </Section>
    </div>
  );
};