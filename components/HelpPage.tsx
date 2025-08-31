import React from 'react';
import { Section } from './Section';
import { Table } from './Table';
import { CodeBlock } from './CodeBlock';

export const HelpPage: React.FC = () => {

    const notesAndContentCommands = [
        ['`createNewNote`', 'Creates a new, empty note.', '"Create a new note titled \'Weekly Goals\'"'],
        ['`deleteNote`', 'Deletes a note by its title.', '"Delete the note named \'Project Phoenix\'"'],
        ['`generateCreativeContent`', 'Appends generated text to your active note.', '"Write a short poem about the rain"'],
        ['`createPlanAndNote`', 'Generates a structured plan and saves it as a new note.', '"Make a plan for my new website"'],
        ['`createWireframeAndNote`', 'Creates a textual UI wireframe and saves it as a new note.', '"Create a wireframe for a login screen"'],
        ['`addQuickNote`', 'Jots down a temporary note on the dashboard.', '"add a quick note: remember to check the oven"'],
        ['`listQuickNotes`', 'Displays all your current quick notes.', '"what are my quick notes?"'],
    ];

    const taskCommands = [
        ['`listTasks`', 'Shows all your current tasks, sorted by status.', '"What are my tasks?"'],
        ['`addTask`', 'Creates a new task in your to-do list.', '"Add a task to buy milk"'],
        ['`completeTask`', 'Marks a task as completed.', '"Mark the task \'finish report\' as done"'],
        ['`deleteTask`', 'Deletes a task by its name.', '"Delete the \'call mom\' task"'],
    ];

    const journalCommands = [
        ['`addJournalEntry`', 'Adds a journal entry. Defaults to today if no date is specified.', '"journal: Today I learned how to use the new feature." or "add a journal entry for 2024-07-20: Went to the beach"'],
    ];
    
    const habitCommands = [
       ['`addHabit`', 'Adds a new habit to the tracker.', '"add a new habit: drink water"'],
       ['`completeHabit`', 'Marks a habit as done for today.', '"complete my \'drink water\' habit"'],
       ['`deleteHabit`', 'Removes a habit from the tracker.', '"delete the water habit"'],
       ['`listHabits`', 'Shows all your tracked habits and streaks.', '"show me my habits"'],
    ];
    
    const personalSuiteCommands = [
        ['`addGoal`', 'Sets a new personal goal.', '"Set a goal to run a 5k"'],
        ['`logMood`', 'Logs your mood for the day.', '"Log my mood as happy" or "I feel productive today"'],
        ['`addExpense`', 'Adds a new expense to the tracker.', '"Log an expense of $5 for coffee"'],
        ['`addPersonalQuote`', 'Saves a new quote to your collection.', '"add a quote: The journey of a thousand miles begins with a single step"'],
    ];

    const productivityToolCommands = [
        ['`startPomodoro`', 'Starts or resumes the Pomodoro timer.', '"start the pomodoro timer"'],
        ['`pausePomodoro`', 'Pauses the timer.', '"pause pomodoro"'],
        ['`resetPomodoro`', 'Resets the timer to its initial state.', '"reset the timer"'],
        ['`makeDecision`', 'Chooses a random option. You can provide options or use saved ones.', '"decide between pizza, burgers, or salad"'],
        ['`addDecisionOption`', 'Adds a single option to the Decision Maker.', '"add \'go for a walk\' to my decision options"'],
        ['`addDecisionOptions`', 'Adds multiple options to the Decision Maker at once.', '"add options movie, dinner, and game night"'],
        ['`clearDecisionOptions`', 'Clears all saved decision options.', '"clear all my decision options"'],
    ];

    const kanbanCommands = [
        ['`moveKanbanCard`', 'Moves a card on the Kanban board.', '"Move \'design mockups\' to In Progress"'],
    ];

    const generalCommands = [
        ['`addEvent`', 'Schedules an event in your calendar.', '"Schedule a meeting for tomorrow at 2pm about the Q3 report"'],
        ['`getDailyBriefing`', 'Summarizes your tasks and events for today.', '"Give me a rundown of my day"'],
    ];

    return (
        <div className="space-y-8">
            <Section title="Welcome to Maven - Your Personal Command Center">
                <p>
                    Maven is an all-in-one productivity suite designed to be your intelligent workspace. It combines AI-powered notes, task management, journaling, and planning tools to help you organize your life and amplify your creativity.
                </p>
                <p>
                    This guide provides a comprehensive overview of all features. The most powerful way to interact with Maven is via the <strong>AI Assistant</strong> in the right-hand sidebar, which can control almost every aspect of the app using natural language.
                </p>
            </Section>

            <Section title="Getting Started: The Maven Interface">
                <p>The application is divided into three main areas:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Main Sidebar (Left):</strong> This is your primary navigation. Switch between the core views: Notes, Dashboard, Journal, and DocuMind. Depending on the view, this sidebar will also show your list of notes or dashboard module navigation.</li>
                    <li><strong>Main Content Area (Center):</strong> This is where you'll do your work, whether it's writing in the editor, managing your dashboard, or building a mind map.</li>
                    <li><strong>AI Assistant (Right):</strong> Your command center. Chat with the AI to manage tasks, create content, get daily briefings, and much more. It's the fastest way to get things done.</li>
                </ul>
            </Section>

            <Section title="Core Features Breakdown">
                <h3 className="text-xl font-bold text-white mb-2">1. Notes View</h3>
                <p>A powerful, rich-text editor for all your thoughts and ideas. You can format text, insert images from your computer, and add beautiful video or image banners to each note for personalization. It's designed for focused, distraction-free writing.</p>

                <h3 className="text-xl font-bold text-white mt-6 mb-2">2. Dashboard View</h3>
                <p>Your daily control panel. The Dashboard is a collection of widgets designed to give you a complete overview of your life at a glance. It includes:</p>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                    <li><strong>Task Management:</strong> A simple and effective to-do list to keep track of your responsibilities.</li>
                    <li><strong>Kanban Board:</strong> Visualize your workflow with 'To Do', 'In Progress', and 'Done' columns.</li>
                    <li>
                        <strong>Attendance Manager:</strong> A comprehensive tool designed for educators.
                        <ul className="list-['-_'] pl-6 mt-2 space-y-1 text-card-foreground/80">
                            <li><strong>Class Management:</strong> Easily create and manage multiple classes. Deleting a class will also remove all associated students and their attendance records.</li>
                            <li><strong>Student Management:</strong> Add students to a class individually or bulk-import from an Excel file. The file must contain columns for student names (e.g., 'Name') and enrollment numbers (e.g., 'Enrollment' or 'No').</li>
                            <li><strong>Daily Tracking:</strong> For any selected day, you can mark each student as 'Present' or 'Absent' with a single click.</li>
                            <li><strong>Effortless Navigation:</strong> Use the built-in calendar to jump to any date, or use the 'Previous Day', 'Next Day', and 'Today' buttons for quick navigation.</li>
                            <li><strong>Export to Excel:</strong> Generate and download a complete attendance report for the selected class as an Excel spreadsheet. This report includes all students and their status for every recorded day.</li>
                        </ul>
                    </li>
                    <li><strong>Calendar:</strong> Schedule your events and appointments to keep your day organized.</li>
                    <li><strong>Quick Notes:</strong> For jotting down fleeting thoughts without creating a full note page.</li>
                    <li><strong>Pomodoro Timer:</strong> A built-in timer to help you focus using the Pomodoro Technique.</li>
                    <li><strong>Habit Tracker:</strong> Build good habits and track your streaks over time with a visual 7-day overview.</li>
                    <li><strong>Decision Maker:</strong> Can't decide? Add your options and let the app choose for you. Comes with helpful templates.</li>
                    <li><strong>Settings:</strong> Change themes and manage your application data (import/export).</li>
                </ul>

                <h3 className="text-xl font-bold text-white mt-6 mb-2">3. Journal View</h3>
                <p>A dedicated space for daily reflection. The Journal features a calendar interface where you can easily navigate between months and days. Days with entries are marked, allowing you to quickly look back on your thoughts over time.</p>

                <h3 className="text-xl font-bold text-white mt-6 mb-2">4. DocuMind View</h3>
                <p>A dynamic, canvas-based mind mapping tool for visual brainstorming and organizing ideas. Create interconnected nodes to map out projects, study topics, or complex thoughts. The drag-and-drop interface, along with pan and zoom controls, makes it easy to structure and navigate your ideas visually.</p>
            </Section>

            <Section title="The AI Assistant: Your Power Tool">
                <p className="mb-6">
                    The AI Assistant is the heart of Maven's intelligent experience. It understands conversational commands to execute functions across the app. Below is a complete list of its capabilities.
                </p>

                <h3 className="text-xl font-bold text-white mt-6 mb-4">Notes &amp; Content Creation</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={notesAndContentCommands} />

                <h3 className="text-xl font-bold text-white mt-8 mb-4">Task Management</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={taskCommands} />

                <h3 className="text-xl font-bold text-white mt-8 mb-4">Journaling</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={journalCommands} />
                
                <h3 className="text-xl font-bold text-white mt-8 mb-4">Habit Tracking</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={habitCommands} />
                
                <h3 className="text-xl font-bold text-white mt-8 mb-4">Personal Suite</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={personalSuiteCommands} />

                <h3 className="text-xl font-bold text-white mt-8 mb-4">Productivity Tools (Pomodoro &amp; Decision Maker)</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={productivityToolCommands} />

                <h3 className="text-xl font-bold text-white mt-8 mb-4">Kanban Board</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={kanbanCommands} />

                <h3 className="text-xl font-bold text-white mt-8 mb-4">General &amp; Daily Planning</h3>
                <Table headers={['Function', 'Description', 'Example Command']} rows={generalCommands} />
            </Section>

            <Section title="Keyboard Shortcuts">
                <p>Use these shortcuts to speed up your workflow.</p>
                <CodeBlock 
                    language="Keyboard Shortcut"
                    code="Cmd + K (or Ctrl + K): Opens the AI Command Palette within an active note. This allows you to quickly run AI actions like 'Summarize' or 'Improve Writing' on your note's content."
                />
            </Section>

             <Section title="Data Management &amp; Privacy">
                <p>
                    Your privacy is paramount. All your data—notes, tasks, events, etc.—is stored <strong>100% locally</strong> in your browser's IndexedDB and localStorage. It never leaves your device.
                </p>
                <p>
                    To back up your data, navigate to the <strong>Dashboard</strong> view, then click <strong>Settings</strong> in the sidebar. You can export all your data to a single JSON file. You can also import this file back into Maven on any device.
                </p>
                 <CodeBlock 
                    language="info"
                    code="Tip: Regularly export your data for peace of mind!"
                />
            </Section>
        </div>
    );
};