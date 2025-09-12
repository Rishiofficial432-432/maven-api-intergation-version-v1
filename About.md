# About Maven

## Introduction

Maven is your intelligent workspace, an all-in-one productivity suite combining AI-powered notes, task management, and planning tools to organize your life and amplify your creativity. It is designed from the ground up to be a single, unified hub for all your personal and professional productivity needs, operating on a **privacy-first, local-first** principle. All your data is stored securely on your own device, ensuring that you have complete ownership and control over your information.

---

## The Problem Maven Solves

In today's digital landscape, productivity is often fragmented across a dozen different apps: one for notes, another for tasks, a separate one for journaling, another for project planning, and so on. This fragmentation leads to:

-   **Information Silos:** Your ideas, tasks, and reflections are scattered, making it difficult to see the big picture.
-   **Context Switching:** Constantly moving between apps drains mental energy and disrupts focus.
-   **Lack of Integration:** Tools don't talk to each other, forcing manual duplication of information.
-   **Privacy Concerns:** Your sensitive data is stored on third-party servers, often with unclear privacy policies.

Maven addresses these challenges by providing a cohesive, intelligent, and private environment where all your productivity tools coexist and interact seamlessly.

---

## Key Features (Over 15 Powerful Tools)

Maven integrates a comprehensive suite of over 15 distinct features into a single interface, all controllable through a powerful AI assistant.

### 🏛️ Core Modules

1.  **Notes View:** A rich-text editor for distraction-free writing. Supports image embedding, custom banners (images/videos), and an AI command palette for on-the-fly content transformation.
2.  **Dashboard View:** Your daily command center, providing a centralized overview of all your widgets and tools.
3.  **Journal View:** A dedicated space for daily reflection with a beautiful calendar interface to easily navigate past entries.
4.  **DocuMind View:** An innovative tool that automatically generates interactive, explorable mind maps from your documents (.txt, .md, .pdf, .docx, .pptx), helping you visualize and understand complex information.

### 🛠️ Productivity Widgets & Tools

5.  **Task Management:** A simple yet effective to-do list to track pending and completed tasks.
6.  **Kanban Board:** A visual project management tool to organize tasks in "To Do," "In Progress," and "Done" columns.
7.  **Attendance Manager:** A complete solution for educators to manage classes, track student attendance, and import/export student lists via Excel.
8.  **Calendar & Events:** Schedule and view appointments and important dates.
9.  **Pomodoro Timer:** A built-in focus timer to help you work in focused bursts using the Pomodoro Technique.
10. **Decision Maker:** A fun and useful tool to help you make choices when you're undecided, complete with pre-made templates.
11. **Quick Notes:** A scratchpad on your dashboard for jotting down fleeting ideas and temporary information.
12. **Habit Tracker:** Build and maintain good habits by tracking your daily consistency and streaks.
13. **Productivity Analytics:** Get insights into your work patterns with visualizations of completed tasks, habit consistency, and more.
14. **Personal Suite:** A collection of widgets for personal well-being, including a Mood Tracker, a personal Quote collection, a Goal Setter, and an Expense Tracker.
15. **Settings & Data Management:** Customize your experience with multiple themes and securely manage your data with local import/export functionality.

### 🤖 AI-Powered Intelligence

16. **AI Assistant:** The cornerstone of Maven. A conversational chatbot powered by Google's Gemini model that can understand natural language to control the entire application. You can ask it to:
    -   Create, complete, and list tasks.
    -   Schedule events.
    -   Create new notes from a plan or a UI wireframe.
    -   Add journal entries.
    -   Manage your habits.
    -   Provide a daily briefing of your schedule.
    -   ...and much more.

---

## Operational Mechanisms

### Technology & Architecture

-   **Frontend:** Built as a modern single-page application using **React** and **TypeScript**.
-   **Styling:** Utilizes **Tailwind CSS** for a responsive and aesthetically pleasing user interface with robust theme support.
-   **Local-First Data:** Maven is architected to be a **local-first application**. This is a critical design choice for user privacy and offline capability.

### Data Privacy & Storage

Your privacy is a non-negotiable feature. Maven achieves this through its data storage model:

-   **`localStorage` & `IndexedDB`:** All your notes, tasks, journal entries, and settings are stored directly in your web browser's local storage (`localStorage`) and a more robust client-side database (`IndexedDB` for larger files like note banners).
-   **No