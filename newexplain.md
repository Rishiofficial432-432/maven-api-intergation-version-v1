

# Maven: A Deep Dive into Your Intelligent Workspace

This document provides a comprehensive, top-to-bottom explanation of the Maven application. It covers the core philosophy, the application's features, and detailed walkthroughs of each workflow, from creating a simple note to generating a complex academic timetable.

---

## 1. The Core Philosophy: Your Data, Your Device

Before diving into the features, it's essential to understand what makes Maven different. It is a **local-first** and **privacy-first** application.

-   **What this means for you:** All your information—every note, task, journal entry, and setting—is stored directly on your computer's hard drive, within your web browser's secure storage. Your data never leaves your device unless you explicitly use an AI feature or the Google Workspace integration.
-   **The benefits:** You have absolute ownership and privacy. The app works perfectly offline, and there are no accounts or sign-ups required. The one exception to this is the optional Student/Teacher Portal, which requires a cloud database (Supabase) to function, but this is a self-contained module that you control.

---

## 2. The Minimum Viable Product (MVP) - The Core of Maven

The core value proposition of Maven is to provide a **private, unified space to capture, organize, and act on your thoughts.** The MVP focuses on delivering this value in the most direct way possible, establishing the foundation upon which all other features are built.

### Feature 1: The Note-Taking Engine

This is the foundation for capturing ideas. The MVP consists of a clean, capable, and distraction-free editor. A user can create a new note, give it a title, and write content. This content is automatically saved to their browser as they type. They can create multiple notes and switch between them. This feature single-handedly fulfills the "capture" part of the core value proposition, providing a reliable place to store information.

### Feature 2: The Action-Oriented Dashboard

To fulfill the "organize and act" part of the value proposition, the MVP includes a simple Dashboard view containing a functional to-do list. A user can type a task into an input field and add it to their list. They can then check a box to mark the task as complete, which visually distinguishes it (e.g., with a strikethrough). This demonstrates immediate utility beyond simple note-taking, allowing users to turn thoughts into concrete, actionable items.

### Feature 3: The Intelligent Command Layer (AI Assistant)

This feature establishes the "intelligent" and "unified" aspects of Maven from day one. The MVP includes the chat interface on the right side of the screen. Its core purpose is to act as a "do-engine." A user can type a command like *"add a task to buy milk"* or *"create a new note about my project ideas."* The AI understands the intent and directly performs the action—adding the task to the Task widget or creating a new, empty note—without the user needing to navigate to the respective modules. This showcases the seamless, command-driven workflow that is central to the Maven experience.

### Feature 4: The Power Switch (Settings)

To enable the AI, the user needs to provide their own API key. The MVP includes a basic Settings page with a single input field for the Google Gemini API key. This is a necessary utility to unlock the intelligent aspect of the product. The key is saved securely in the browser's local storage, maintaining the privacy-first principle.

---

## 3. The Full Maven Experience - A Comprehensive Tour

The current version of Maven has evolved far beyond the MVP, integrating over 15 distinct features into a cohesive whole.

### The Main Interface: Your Three Control Panels

The application is divided into three distinct vertical sections:

1.  **The Left Sidebar (Navigation):** This is how you move between the major sections of the app: the **Dashboard**, **Academics Hub**, **Notes**, **Journal**, and **DocuMind**, among others.
2.  **The Center Content Area (Your Workspace):** This is the largest section and is where you do your work.
3.  **The Right Sidebar (The AI Assistant):** Your intelligent command center for controlling the entire application.

### Module 1: The Dashboard - Your Daily Command Center

The Dashboard is a collection of powerful widgets for managing your day-to-day life.

-   **AI Brain Dump:** This is for turning chaotic thoughts into organized actions. You can type or paste a block of unstructured text (e.g., *"remind me to call John tomorrow at 2pm, buy groceries, also I had an idea for a new blog post"*). The AI processes this and suggests categorized items: a calendar event, a task, and a new note idea. You can then approve these suggestions, and Maven will automatically add them to the correct places in the app.
-   **Tasks & Kanban Board:** Beyond a simple to-do list, the Kanban board allows you to visualize your workflow. You can create cards in a "To Do" column and drag them to "In Progress" and "Done" as you work on them.
-   **Calendar & Quick Notes:** The Calendar allows you to schedule events, while Quick Notes is a simple scratchpad for fleeting thoughts that don't need a full, separate note page.
-   **Pomodoro Timer & Habit Tracker:** Use the Pomodoro timer to work in focused 25-minute bursts. The Habit Tracker lets you add habits (e.g., "Read for 15 minutes") and mark them off daily to build a streak.
-   **Decision Maker & Personal Suite:** The Decision Maker helps you choose between options when you're stuck. The Personal Suite is a collection of widgets for tracking personal goals, mood, expenses, and inspirational quotes.

### Module 2: The Notes View - Your Knowledge Base

This is your primary space for writing. You can create an unlimited number of notes. The editor allows for rich text formatting, and you can personalize each note with an image or video banner. By pressing `Cmd+K` (or `Ctrl+K`), you can open an AI palette to perform actions on your text, such as summarizing it, improving the writing, or translating it.

### Module 3: The Journal - Your Private Logbook

This view provides a dedicated space for daily reflection. It features a calendar on the left and a writing area on the right. You can click on any date to create or view an entry for that day. Dates with existing entries are marked, giving you a visual overview of your journaling consistency.

### Module 4: DocuMind - Your Visual Explorer

This innovative tool turns static documents into dynamic, interactive mind maps. You upload a document (like a PDF research paper or a Word document with meeting notes), and Maven automatically generates a mind map where the main topics are central nodes and sub-topics are connected branches. You can then explore this map visually, and clicking on any node prompts the AI to provide a concise explanation of that concept based on the document's content.

### Module 5: The Academics Hub - The Educational Core

This is the central place for all academic and learning-related tools.

-   **The Student/Teacher Portal:** This is a powerful, real-time attendance system.
    -   **For Teachers:** A teacher can create classes and manage student rosters. To take attendance, they start a "session," which generates a unique 6-digit code. They can enable "Location-Aware" mode, which uses GPS to ensure students are physically present. As students check in, their names appear in real-time on the teacher's live dashboard. Teachers can also use the "Curriculum Copilot" to get AI assistance in planning the day's lesson.
    -   **For Students:** A student logs in and enters the 6-digit code provided by the teacher to check in. If location is enforced, their device will verify they are in the classroom. They receive immediate confirmation and can view their complete attendance history.

-   **The AI Timetable Scheduler:** This tool automates the complex task of creating a school timetable.
    -   **The Workflow:** An administrator first configures the physical assets by adding a list of available rooms and their capacities. Next, they upload a single Excel file containing three sheets: one for **Teachers** (listing their names and the subjects they can teach), one for **Subjects** (listing subject names and how many hours they occur per week), and one for **Classes** (listing class names, their student count, and the subjects they take). With the data loaded, they click "Generate Timetable." The system's algorithm processes all the constraints and produces a complete, clash-free timetable, displayed in a clear grid format for each class.

-   **The AI Daily Routine Planner:** This tool is designed for students to structure their free time. It analyzes the student's fixed events from their calendar and their long-term goals. It then generates a personalized daily schedule, suggesting specific, goal-oriented tasks to work on during their free periods between classes.

-   **Analytics:** This section is designed for teachers to view attendance trends and other classroom analytics, providing data-driven insights to help improve student engagement.

### Module 6: Google Workspace & External Connections

You can securely connect your Google account to Maven. Once connected, you can search your Google Drive from within the app. When you find a Google Doc or Sheet you want to import, a single click will create a new note in Maven containing the full content of that file, preserving its formatting.

### Global Intelligence: Features That Work Everywhere

-   **The AI Assistant (Right Sidebar):** This is your universal command center. You can ask it to do almost anything in the app, from *"add a habit to exercise daily"* to *"schedule a meeting for Friday at 4pm"* to *"give me my daily briefing."* It reliably understands your intent and executes the command.

-   **The Global AI Search (`Cmd+P`):** This is your personal search engine for your own knowledge. Pressing `Cmd+P` opens a search bar. You can ask a question in natural language, like *"what were my main takeaways from the Project Phoenix meetings?"* The AI will search across all your notes, understand the context, and provide a direct, synthesized answer, along with links to the source notes it used.

---

## 4. Conclusion: The Maven Philosophy in Practice

Maven brings together over a dozen powerful tools into a single, cohesive application. By starting with a core of capturing and organizing thoughts, and then layering on intelligent, action-oriented features, it creates a workspace that is both powerful and deeply personal. Its unwavering commitment to local-first data ensures that this powerful space is also completely private and secure.