# Maven's AI Timetable Scheduler: A Technical Explanation

This document provides an in-depth look at the AI Timetable Scheduler feature within the Maven application. It covers its core purpose, the logic behind its features, and defines what constitutes a Minimum Viable Product (MVP) for this module.

---

## 1. What is the AI Timetable Scheduler?

The AI Timetable Scheduler is a powerful utility designed to automate the complex, time-consuming, and error-prone task of creating a weekly academic timetable for an institution.

### The Problem It Solves

Manually creating a timetable is a significant administrative challenge. An administrator must juggle numerous constraints simultaneously:

-   **Teacher Availability:** Which teachers can teach which subjects, and are they free at a given time?
-   **Class Schedules:** Ensuring a single class isn't booked for two different subjects at the same time.
-   **Room Allocation:** Assigning a class to a physical room that is both available and large enough to accommodate the number of students.
-   **Subject Requirements:** Fulfilling the required number of hours per week for each subject for every class.

Doing this by hand for an entire department or school is a logistical puzzle that can take days or weeks to solve and is highly susceptible to human error, resulting in conflicts and inefficiencies.

### The Solution Maven Provides

The scheduler replaces this manual process with a deterministic algorithm. The administrator provides the raw data and constraints (teachers, subjects, classes, and rooms), and the scheduler's engine processes this information to generate a complete, conflict-free timetable in a matter of seconds.

---

## 2. Features and Workflow Explained

The scheduler's user interface is broken down into a simple, step-by-step workflow.

### Feature 1: Room Configuration

-   **What it is:** A simple user interface where an administrator can add, view, and delete the physical rooms available for scheduling. Each room requires a **Name** (e.g., "Room 301", "Physics Lab") and a **Capacity** (the number of students it can hold).
-   **Purpose:** This provides the algorithm with the physical constraints of the institution. The capacity is a critical piece of data used to prevent the algorithm from scheduling a class of 60 students into a room that can only hold 30.

### Feature 2: Data Upload via Excel

-   **What it is:** A drag-and-drop area and file picker that allows the user to upload a single `.xlsx` file. This file must contain three specifically named sheets:
    1.  **`Teachers`**: Lists each teacher's name and the subjects they are qualified to teach (comma-separated).
    2.  **`Subjects`**: Lists each subject and the total number of hours it must be taught per week.
    3.  **`Classes`**: Lists each class (e.g., "Grade 10A"), the subjects they take, and their total number of students.
-   **Purpose:** This is the primary method for inputting the complex academic and human-resource constraints into the system. Using a widely-used format like Excel makes the tool accessible to administrators who already manage this data in spreadsheets.

### Feature 3: Data Summary View

-   **What it is:** After a successful file upload, the UI displays a quick summary of the data it has parsed, showing the total count of teachers, subjects, and classes loaded.
-   **Purpose:** This provides immediate feedback to the user, confirming that their file was read correctly and giving them a high-level overview of the scale of the scheduling problem before they commit to generating the timetable.

### Feature 4: "Generate Timetable" & The Core Algorithm

-   **What it is:** The main action button that initiates the scheduling process. When clicked, it displays a loading state and triggers the core algorithm, which runs in a **Web Worker** to prevent the user's browser from freezing during the computationally intensive task.
-   **The Algorithm:** The scheduler uses a **greedy, constraint-satisfaction algorithm**. It first creates a master list of every single lecture period that needs to be scheduled for the week. Then, it iterates through this list one by one, and for each period, it systematically searches for the very first available `(Day, Time Slot, Teacher, Room)` combination that does not violate any constraints. By checking for conflicts *before* placing each period, it guarantees by design that the final output is conflict-free.
-   **Purpose:** This is the heart of the feature. It performs the complex logical puzzle-solving that a human administrator would otherwise have to do manually.

### Feature 5: Timetable Display

-   **What it is:** The final, successful output. The UI renders a series of clear, grid-based tables—one for each class. Each grid shows the days of the week as columns and time slots as rows, with the cells populated by the scheduled subject, assigned teacher, and allocated room.
-   **Purpose:** To present the generated solution in a format that is immediately readable, understandable, and usable by administrators, teachers, and students.

### Feature 6: Download Template

-   **What it is:** A helper button that allows the user to download a pre-formatted Excel file containing the correct sheet names and column headers.
-   **Purpose:** This is a user-experience enhancement that lowers the barrier to entry. It guides the user on the exact data format required, significantly reducing the likelihood of upload or parsing errors.

---

## 3. The Scheduler MVP: Defining the Core

To define the Minimum Viable Product (MVP) for the scheduler, we must identify the absolute essential features required to solve the core problem: **generating a basic, conflict-free timetable from a set of constraints.**

### Essential MVP Features:

1.  **Room Configuration:** **(MVP)** The algorithm cannot function without knowing the available physical spaces and their capacities. This is a fundamental constraint that must be provided. The UI for adding/managing rooms is essential.

2.  **Data Upload (Excel):** **(MVP)** A method for inputting the core academic constraints (teachers, subjects, classes) is non-negotiable. The Excel upload is the most efficient way to handle this volume of data, making it a core part of the MVP. A manual, form-based input for every single entity would be too cumbersome to be considered viable.

3.  **Core Algorithm ("Generate" Button):** **(MVP)** This is the engine of the entire feature. The button to trigger the process and the underlying scheduling logic are the absolute heart of the product.

4.  **Timetable Display:** **(MVP)** A solution is useless if the user cannot see it. A basic, functional display of the generated timetable grids is essential for the feature to have any value.

### Features Excluded from the MVP:

1.  **Data Summary View:** (Not MVP) While helpful, this is a confirmation step. In a lean MVP, a user can infer success from the final timetable being displayed.

2.  **Template Download:** (Not MVP) This is a quality-of-life feature. An MVP can rely on written documentation to instruct the user on the required Excel format, saving development time.

3.  **Editing & Exporting the Timetable:** (Not MVP) The MVP's sole focus is on *generation*. The ability to manually tweak the generated schedule or export it to another format (like PDF or Excel) are powerful but secondary features that can be added later.

In summary, the Scheduler MVP consists of the essential components to **input constraints**, **run the core logic**, and **display a valid result**. It proves the core value proposition of automated, conflict-free scheduling.