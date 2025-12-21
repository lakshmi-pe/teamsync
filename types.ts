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

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  referenceLinks?: string[]; // Array of URLs
  comments?: Comment[];      // Activity trail
  projectId: string;
  assigneeId: string;
  priorityId: string;
  statusId: string;
  dueDate: string; 
  subtasks: SubTask[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}