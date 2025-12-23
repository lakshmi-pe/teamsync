
export interface Status {
  id: string;
  name: string;
}

export interface Priority {
  id: string;
  name: string;
  color: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface ReferenceLink {
  title: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  referenceLinks?: ReferenceLink[]; // Stored as "Title|URL" newline separated string in sheet
  activityTrail?: string[];  // Stored as newline separated string in sheet
  projectId: string;
  assigneeId: string;
  priorityId: string;
  statusId: string;
  dueDate: string; 
  subtasks?: string[];       // Stored as newline separated string in sheet
  updatedAt: string;
}

export type GroupByOption = 'Status' | 'Priority' | 'Assignee' | 'Project';
