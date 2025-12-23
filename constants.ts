
import { Priority, Project, Status, Task, User } from "./types";

export const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbye2krg4-fZEwhBADB4N0uRXEa4TcIpR0hjZh_hvgf90NWVzBOU35QhMyt7dtYCG02dQg/exec";

export const DEFAULT_STATUSES: Status[] = [
  { id: 's1', name: 'To Do' },
  { id: 's2', name: 'In Progress' },
  { id: 's3', name: 'Review' },
  { id: 's4', name: 'Done' },
];

export const DEFAULT_PRIORITIES: Priority[] = [
  { id: 'pr1', name: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { id: 'pr2', name: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'pr3', name: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'pr4', name: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@company.com', avatar: 'https://picsum.photos/seed/alice/40/40' },
  { id: 'u2', name: 'Bob Smith', email: 'bob@company.com', avatar: 'https://picsum.photos/seed/bob/40/40' },
  { id: 'u3', name: 'Charlie Davis', email: 'charlie@company.com', avatar: 'https://picsum.photos/seed/charlie/40/40' },
  { id: 'u4', name: 'Diana Prince', email: 'diana@company.com', avatar: 'https://picsum.photos/seed/diana/40/40' },
  { id: 'u5', name: 'Evan Wright', email: 'evan@company.com', avatar: 'https://picsum.photos/seed/evan/40/40' },
];

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Website Redesign', color: 'bg-blue-100 text-blue-800', description: 'Overhaul of the corporate website with new branding.' },
  { id: 'p2', name: 'Q4 Marketing', color: 'bg-green-100 text-green-800', description: 'End of year campaigns and social media push.' },
  { id: 'p3', name: 'Internal Audit', color: 'bg-purple-100 text-purple-800', description: 'Review of security protocols and compliance.' },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Design Home Page Mockups',
    description: 'Create high-fidelity mockups for the new homepage based on wireframes.',
    referenceLinks: [
        { title: 'PRD', url: 'https://docs.google.com/document/d/1example' },
        { title: 'Inspiration', url: 'https://dribbble.com/shots/example' }
    ],
    activityTrail: [
      'Initial design draft completed.'
    ],
    projectId: 'p1',
    assigneeId: 'u1',
    priorityId: 'pr3',
    statusId: 's2',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    subtasks: [
      'Header section',
      'Hero banner',
      'Footer'
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 't2',
    title: 'Draft Social Media Posts',
    description: 'Write copy for LinkedIn and Twitter for the product launch.',
    referenceLinks: [],
    activityTrail: [],
    projectId: 'p2',
    assigneeId: 'u2',
    priorityId: 'pr2',
    statusId: 's1',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    subtasks: [],
    updatedAt: new Date().toISOString()
  }
];
