# Maven: In-Depth Technical Explanations

This document provides a detailed, precise explanation of each key feature within the Maven application, breaking down the core logic and algorithms that power them.

---

## 1. Core Architecture: Local-First & Privacy-First

Maven is architected as a **local-first application**. This is the most critical design choice, ensuring user privacy and full offline capability.

-   **Data Storage:**
    -   **`localStorage`**: Used for storing smaller, structured data like tasks, journal entries, settings, and other widget states. Data is serialized to JSON strings for storage.
    -   **`IndexedDB`**: A more robust, client-side database used for storing larger binary data (blobs), primarily for image and video banners associated with notes (`MavenDB`) and for the entire Student/Teacher Portal module (`MavenPortalDB`). This avoids bloating `localStorage` and provides better performance for file handling.
-   **State Management:** The application uses React's built-in state management (`useState`, `useEffect`). A custom hook, `usePersistentState`, is employed to abstract the logic of reading from and writing to `localStorage`, ensuring data persists across browser sessions.
-   **Web Workers:** Computationally intensive tasks, specifically the **Timetable Generation**, are offloaded to a Web Worker. This prevents the main UI thread from freezing, ensuring a responsive user experience even during complex calculations.

---

## 2. The Dashboard & Core Widgets

### Concept & Logic: CRUD Operations

The underlying logic for most dashboard widgets (Tasks, Kanban, Habits, etc.) is a classic **CRUD** (Create, Read, Update, Delete) operation model, managed locally.

**Algorithm (Example: Toggling a Task):**
1.  **Event Trigger:** User clicks a checkbox. The `onClick` handler receives the unique `id` of the target task.
2.  **State Update:** The `setTasks` state function iterates through the tasks array using `.map()`. It finds the task with the matching `id` and returns a new object with the `completed` property flipped. All other tasks are returned unmodified. This adheres to React's immutability principles.
3.  **Persistence:** The `usePersistentState` hook automatically triggers a `useEffect`, which serializes the entire new `tasks` array to a JSON string and saves it to `localStorage`.
4.  **UI Re-render:** React re-renders the component to reflect the new state.

This approach is performant (no network latency), simple, reliable, and works entirely offline.

---

## 3. AI Feature Implementations

Maven's intelligence layer is powered by **Google's `gemini-2.5-flash` model**.

### AI Brain Dump Logic

-   **Concept:** To parse unstructured text into structured, actionable data.
-   **Algorithm Flow:**
    1.  **Prompt Engineering:** A detailed prompt is constructed that assigns the AI the role of a "text processing engine." It includes the user's raw text and contextual information like the current date to resolve relative terms (e.g., "tomorrow").
    2.  **Schema Enforcement:** The most critical step is defining a strict `responseSchema` in the API call that matches the desired JSON output structure (`tasks`, `events`, `quickNotes`, etc.). The `config` for the API call specifies `responseMimeType: "application/json"` and provides this schema.
    3.  **Reliable Parsing:** This forces the Gemini model to return a valid, parsable JSON object, dramatically increasing the feature's reliability and preventing conversational or malformed responses.
    4.  **User Verification:** The parsed JSON is used to render a verification UI, where the user has the final say on which items are saved, ensuring they remain in control.

### Global AI Search (`Cmd+P`)

-   **Concept:** To perform a semantic search across the user's entire local knowledge base.
-   **Algorithm Flow:**
    1.  **Knowledge Base Aggregation:** All of the user's notes (`pages`) are compiled. The HTML content of each note is stripped down to plain text to create a clean knowledge base.
    2.  **Prompt Engineering:** A prompt is sent to the AI, instructing it to act as a "search assistant." The prompt includes the user's query and the entire aggregated knowledge base as context.
    3.  **Synthesized Answer:** The AI is instructed to provide a direct, synthesized answer to the query based *only* on the provided context, and to cite the source notes it used.
    4.  **Schema Enforcement:** Like the Brain Dump, this feature uses a `responseSchema` to force the AI to return a structured JSON object containing the `summary` and an array of `source_notes`. This allows the UI to be reliably populated with the answer and clickable source links.

---

## 4. Student/Teacher Portal (Local-First Version)

### Concept & Logic

The portal is a secure, real-time system for classroom attendance, built to work without any external database setup.

-   **Database:** It uses **`IndexedDB`** (`MavenPortalDB`) for all data storage, including user profiles, session information, and attendance records. All operations are handled through the `components/portal-db.ts` module.
-   **Real-Time Mechanism:** The live attendance dashboard is powered by the browser's native **`BroadcastChannel` API.**
    -   When a student successfully checks in, their browser tab posts a message to the `portal-attendance-channel`.
    -   The teacher's browser tab, which is listening to this same channel, receives the message and dynamically updates the UI to show the new student's name. This creates a real-time experience across different tabs or windows on the same device without a server.

-   **Location Verification Algorithm:**
    1.  When a teacher starts a location-enforced session, the browser's Geolocation API (`navigator.geolocation.getCurrentPosition`) captures their `latitude` and `longitude`. This data is stored with the session in `IndexedDB`.
    2.  When a student checks in, their location is also captured.
    3.  The **Haversine formula** is executed client-side to calculate the great-circle distance between the two sets of coordinates.
    4.  The calculated distance is checked against the teacher-defined radius. If it's within the limit, the check-in proceeds; otherwise, it fails.

---

## 5. AI Timetable Scheduler

### Concept & Logic

This feature automates the creation of a conflict-free academic timetable using a deterministic algorithm that runs in a Web Worker.

-   **Data Structures:** The system first parses an uploaded Excel file into structured arrays of `Teachers`, `Subjects`, `Classes`, and `Rooms`.
-   **Core Algorithm: Greedy Constraint-Satisfaction**
    1.  **Session Generation:** The system creates a master list of every single class period that needs to be scheduled for the week (e.g., if "Math" is 4 hours/week for "Grade 10A", four such sessions are added to the list).
    2.  **Constraint Prioritization:** This master list is sorted to prioritize the most constrained sessions first (e.g., subjects with the most hours per week), which increases the likelihood of finding a valid solution.
    3.  **Iterative Placement:** The algorithm iterates through the sorted list of sessions one by one. For each session, it iterates through every possible `Day` and `Time Slot`.
    4.  **Conflict Checking:** In each potential slot, it performs a series of checks:
        -   Is the **Class** already busy at this time?
        -   Is there an eligible **Teacher** who is available at this time?
        -   Is there an eligible **Room** (with sufficient capacity) that is available at this time?
    5.  **Greedy Placement:** The moment it finds the *very first* combination of a Teacher and Room that satisfies all constraints for that slot, it "books" the session. It updates the availability schedules for that Class, Teacher, and Room.
    6.  **Iteration:** It then moves on to the next session in the master list and repeats the process.

-   **Why it Works:** By design, this algorithm can never produce a schedule with conflicts, because it confirms that a slot is free for all three entities (Class, Teacher, Room) *before* placing a session. If it cannot find a valid slot for any session, it fails and reports the conflict to the user.
