import React from 'react';
import { StickyNote, ClipboardList, Calendar, BookHeart, LayoutTemplate } from 'lucide-react';

export interface NoteTemplate {
  title: string;
  description: string;
  icon: React.ElementType;
  content: string;
}

export const templates: NoteTemplate[] = [
  {
    title: 'Meeting Notes',
    description: 'Capture decisions and action items from your meetings.',
    icon: ClipboardList,
    content: `
      <h2>Meeting Details</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Attendees:</strong> </p>
      <p><strong>Topic:</strong> </p>
      <hr>
      <h2>Agenda</h2>
      <ul>
        <li>Topic 1</li>
        <li>Topic 2</li>
      </ul>
      <hr>
      <h2>Notes</h2>
      <p></p>
      <hr>
      <h2>Action Items</h2>
      <ul>
        <li>[ ] Action Item 1 (Assigned to: @name, Due: YYYY-MM-DD)</li>
      </ul>
    `,
  },
  {
    title: 'Cornell Notes',
    description: 'A structured system for effective note-taking and review.',
    icon: StickyNote,
    content: `
      <p><strong>Topic:</strong> </p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <hr>
      <table style="width:100%">
        <tbody>
          <tr>
            <td style="width: 30%; border-right: 1px solid hsl(var(--border)); vertical-align: top; padding-right: 15px;">
              <h3>Cues & Questions</h3>
              <p><br></p>
            </td>
            <td style="padding-left: 15px; vertical-align: top;">
              <h3>Notes</h3>
              <p><br></p>
            </td>
          </tr>
        </tbody>
      </table>
      <hr>
      <h3>Summary</h3>
      <p></p>
    `,
  },
  {
    title: 'Weekly Planner',
    description: 'Organize your tasks and goals for the upcoming week.',
    icon: Calendar,
    content: `
      <h2>Week of: ${new Date().toLocaleDateString()}</h2>
      <h3>Top 3 Goals for the Week</h3>
      <ul>
        <li>[ ] Goal 1</li>
        <li>[ ] Goal 2</li>
        <li>[ ] Goal 3</li>
      </ul>
      <hr>
      <h3>Monday</h3>
      <ul><li></li></ul>
      <h3>Tuesday</h3>
      <ul><li></li></ul>
      <h3>Wednesday</h3>
      <ul><li></li></ul>
      <h3>Thursday</h3>
      <ul><li></li></ul>
      <h3>Friday</h3>
      <ul><li></li></ul>
      <h3>Weekend</h3>
      <ul><li></li></ul>
    `,
  },
  {
    title: 'Content Calendar',
    description: 'Plan and track your content across different platforms.',
    icon: LayoutTemplate,
    content: `
      <h2>Content Plan - [Month Year]</h2>
      <table style="width:100%">
        <thead>
          <tr>
            <th style="text-align:left;">Publish Date</th>
            <th style="text-align:left;">Topic / Title</th>
            <th style="text-align:left;">Platform</th>
            <th style="text-align:left;">Status</th>
            <th style="text-align:left;">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>YYYY-MM-DD</td>
            <td>Example: The Future of AI</td>
            <td>Blog</td>
            <td>Idea</td>
            <td>Include expert quotes</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `,
  },
  {
    title: 'Book Wishlist',
    description: 'Keep a running list of books you want to read.',
    icon: BookHeart,
    content: `
      <h2>My Reading Wishlist</h2>
      <table style="width:100%">
        <thead>
          <tr>
            <th style="text-align:left;">Title</th>
            <th style="text-align:left;">Author</th>
            <th style="text-align:left;">Genre</th>
            <th style="text-align:left;">Recommended By</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Example: The Hitchhiker's Guide to the Galaxy</td>
            <td>Douglas Adams</td>
            <td>Sci-Fi Comedy</td>
            <td>A friend</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `,
  },
];
