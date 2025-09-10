# Maven: MVP Definition & Project Pitch

This document provides a comprehensive, top-to-bottom explanation of the Maven application. It covers the core philosophy, a full breakdown of its features, a compelling pitch, and a clear definition of the Minimum Viable Product (MVP).

---

## 1. The Full Pitch: An Intelligent, Private Workspace

### The Problem

In today's digital world, our productivity is fragmented. We use one app for notes, another for tasks, a separate one for journaling, and yet another for project planning. This fragmentation creates digital clutter and leads to:

-   **Information Silos:** Our ideas, tasks, and reflections are scattered, making it impossible to see the big picture.
-   **Constant Context Switching:** Jumping between apps drains mental energy, breaks focus, and kills productivity.
-   **Pervasive Privacy Concerns:** Our most sensitive personal and professional data is stored on third-party servers with opaque privacy policies, leaving us vulnerable and without true ownership.

### The Solution: Maven

Maven is an intelligent, all-in-one workspace designed to solve these problems by unifying your entire productivity workflow into a single, cohesive, and completely private application. It operates on a **local-first** principle, meaning **all your data is stored securely on your own device**, giving you absolute ownership and offline capability.

Maven is built on three foundational pillars:

1.  **True Integration:** It's not just a collection of tools; it's an ecosystem. An idea from the **AI Brain Dump** becomes a task in your **Kanban Board** and a detailed plan in your **Notes**, all seamlessly.
2.  **Uncompromising Privacy:** By storing all data locally in your browser, Maven offers a level of security that cloud-based services like Notion or Asana cannot match. It's a trusted space for your most important information.
3.  **Action-Oriented Intelligence:** The built-in AI Assistant, powered by Google Gemini, is not a simple chatbot. It's a "do-engine" that uses advanced function calling to reliably execute commands across the entire application, acting as a true command center for your digital life.

---

## 2. Minimum Viable Product (MVP) Explanation

The core value proposition of Maven is to provide a **private, unified space to capture, organize, and act on your thoughts.** The MVP focuses on delivering this value in the most direct way possible, establishing the foundation upon which all other features are built.

### Core MVP Features:

1.  **Notes View & Rich-Text Editor:**
    *   **What:** A clean, capable editor for creating and managing notes. This includes the ability to create, read, update, and delete (CRUD) notes, with all data persisting locally in the browser.
    *   **Why it's MVP:** This is the absolute core of the "capture" value proposition. Without a robust place to write and store information, there is no knowledge base to manage or act upon. It's the foundational block of the entire application.

2.  **A Simplified Dashboard with Task Management:**
    *   **What:** A single, accessible view (the Dashboard) that contains a functional to-do list. Users must be able to add, complete, and delete tasks.
    *   **Why it's MVP:** This introduces the "organize and act" part of the value prop. It turns thoughts and ideas (captured in notes) into concrete, actionable items, demonstrating immediate utility beyond simple note-taking.

3.  **The AI Assistant (Core Command Functionality):**
    *   **What:** The chat interface in the right sidebar, connected to the Gemini API. For the MVP, it must reliably execute a small, critical set of commands: `createNewNote` and `addTask`.
    *   **Why it's MVP:** This establishes the "intelligent" and "unified" aspects of the pitch from day one. It showcases the powerful interaction model that sets Maven apart, proving that the AI is a functional "do-engine," not just a text generator.

4.  **Basic Data & Settings Management:**
    *   **What:** A settings page allowing a user to input and save their Google Gemini API key.
    *   **Why it's MVP:** The AI features are a key differentiator and require an API key to function. This is a necessary utility to unlock the intelligent aspect of the product.

### What the MVP Intentionally Excludes:

To maintain focus, the MVP would exclude the more complex, albeit powerful, features. These include the Journal, DocuMind, Google Workspace integration, Student/Teacher Portal, and most of the advanced Dashboard widgets (Kanban, Habits, Analytics, etc.). These features are extensions of the core value, not the core itself, and can be layered on top of a successful MVP.

---

## 3. Full Feature Manifest (Current Application)

The current version of Maven has evolved far beyond the MVP, integrating a comprehensive suite of over 15 distinct features into a single interface, all controllable through a powerful AI assistant.

### 🏛️ Core Modules

1.  **Notes View:** A rich-text editor for distraction-free writing. Supports image embedding, custom banners (images/videos), and an AI command palette for on-the-fly content transformation.
2.  **Dashboard View:** Your daily command center, providing a centralized overview of all your widgets and tools.
3.  **Journal View:** A dedicated space for daily reflection with a beautiful calendar interface to easily navigate past entries.
4.  **DocuMind View:** An innovative tool that automatically generates interactive, explorable mind maps from your documents (.txt, .md, .pdf, .docx, .pptx), helping you visualize and understand complex information.
5.  **Google Workspace Integration:** Securely connect to your Google Drive to search for and import content from Google Docs and Sheets directly into your notes.
6.  **Student/Teacher Portal:** A complete, real-time attendance management system with secure check-ins (OTP & optional location-awareness), live dashboards, curriculum logging, and attendance analytics.
7.  **About Page:** An in-app page detailing the application's features and philosophy.

### 🛠️ Productivity Widgets & Tools

8.  **Task Management:** A simple yet effective to-do list to track pending and completed tasks.
9.  **Kanban Board:** A visual project management tool to organize tasks in "To Do," "In Progress," and "Done" columns.
10. **Attendance Manager (Legacy):** A local-only tool for educators to manage classes, track student attendance, and import/export student lists via Excel.
11. **Calendar & Events:** Schedule and view appointments and important dates.
12. **Pomodoro Timer:** A built-in focus timer to help you work in focused bursts using the Pomodoro Technique.
13. **Decision Maker:** A fun and useful tool to help you make choices when you're undecided, complete with pre-made templates.
14. **Quick Notes:** A scratchpad on your dashboard for jotting down fleeting ideas and temporary information.
15. **Habit Tracker:** Build and maintain good habits by tracking your daily consistency and streaks.
16. **Productivity Analytics:** Get insights into your work patterns with visualizations of completed tasks, habit consistency, and more.
17. **Personal Suite:** A collection of widgets for personal well-being, including a Mood Tracker, a personal Quote collection, a Goal Setter, and an Expense Tracker.
18. **Settings & Data Management:** Customize your experience with multiple themes and securely manage your data with local import/export functionality and API key configuration.

### 🤖 AI-Powered Intelligence

19. **AI Assistant:** A conversational chatbot that can understand natural language to control the entire application. It can create tasks, schedule events, manage habits, provide a daily briefing, and much more.
20. **Global AI Search:** A universal search palette (`Cmd+P`) that performs semantic searches across your entire knowledge base to synthesize direct answers to your questions, citing the source notes.
21. **AI Brain Dump:** An intelligent parser that transforms unstructured "brain dumps" of text into categorized, actionable items (tasks, events, notes).

---

## 4. Operational Mechanisms

### Technology & Architecture

-   **Frontend:** Built as a modern single-page application using **React** and **TypeScript**.
-   **Styling:** Utilizes **Tailwind CSS** for a responsive and aesthetically pleasing user interface with robust theme support.
-   **Local-First Data:** Maven is architected to be a **local-first application**. This is a critical design choice for user privacy and offline capability.

### Data Privacy & Storage

Your privacy is a non-negotiable feature. Maven achieves this through its data storage model:

-   **`localStorage` & `IndexedDB`:** All your notes, tasks, journal entries, and settings are stored directly in your web browser's local storage (`localStorage`) and a more robust client-side database (`IndexedDB` for larger files like note banners).
-   **No Server-Side Storage:** Your personal data **never** leaves your device. It is not sent to or stored on any external servers (with the exception of the optional, self-hosted Student/Teacher Portal database via Supabase).
-   **Full Control:** You have complete ownership. The "Export Data" feature allows you to create a full backup of your workspace at any time.

### AI Integration

-   **Google Gemini API:** The AI Assistant and in-note AI features are powered by the `gemini-2.5-flash` model via the official `@google/genai` SDK.
-   **Tool-Based Function Calling:** The AI Assistant intelligently interacts with the application's features by using a predefined set of "tools." When you ask it to "add a task," the model identifies the correct tool (`addTask`), extracts the necessary information (the task's text), and sends this structured request back to the application to execute. This makes the AI highly functional and reliable.

---

## 5. Unique Selling Propositions (USPs)

1.  **True All-in-One Integration:** Maven uniquely combines over 15 tools, from journaling and habit tracking to mind mapping and attendance management, into a single, cohesive interface.
2.  **Uncompromising Privacy-First Architecture:** By storing all data locally, it offers a level of privacy and security that cloud-based services cannot match.
3.  **Function-Driven AI Command Center:** The AI Assistant is a "do-engine," using advanced function calling to reliably execute commands across the entire application.
4.  **Innovative DocuMind Visualizer:** The ability to automatically generate an interactive mind map from a document offers a new way to understand and engage with information.
5.  **Zero-Friction Experience:** No accounts, no sign-ups, no subscriptions. Maven is instantly usable, removing all barriers to entry.