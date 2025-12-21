import { GoogleGenAI, Type } from "@google/genai";
import { Task, Status, Priority, Project, User } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = "gemini-3-flash-preview";

export const parseTaskWithGemini = async (
  input: string, 
  projects: Project[], 
  users: User[], 
  statuses: Status[], 
  priorities: Priority[]
): Promise<Partial<Task> | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const projectNames = projects.map(p => p.name).join(", ");
    const userNames = users.map(u => u.name).join(", ");
    const statusNames = statuses.map(s => s.name).join(", ");
    const priorityNames = priorities.map(p => p.name).join(", ");

    const prompt = `
      Current date: ${today}.
      Available Projects: ${projectNames}.
      Available Users: ${userNames}.
      Available Statuses: ${statusNames}.
      Available Priorities: ${priorityNames}.
      
      Analyze the following task input and extract structured data.
      If a project, user, status, or priority matches one of the available ones, return its name.
      Input: "${input}"
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priorityName: { type: Type.STRING },
            statusName: { type: Type.STRING },
            dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
            suggestedProjectName: { type: Type.STRING },
            suggestedAssigneeName: { type: Type.STRING }
          },
          required: ["title"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      
      const project = projects.find(p => p.name.toLowerCase() === data.suggestedProjectName?.toLowerCase());
      const user = users.find(u => u.name.toLowerCase().includes(data.suggestedAssigneeName?.toLowerCase() || ""));
      const status = statuses.find(s => s.name.toLowerCase() === data.statusName?.toLowerCase()) || statuses[0];
      const priority = priorities.find(p => p.name.toLowerCase() === data.priorityName?.toLowerCase()) || priorities[1];

      return {
        title: data.title,
        description: data.description,
        priorityId: priority?.id,
        statusId: status?.id,
        dueDate: data.dueDate || today,
        projectId: project?.id,
        assigneeId: user?.id,
        subtasks: []
      };
    }
    return null;
  } catch (error) {
    console.error("Gemini parse error:", error);
    return null;
  }
};

export const generateSubtasks = async (taskTitle: string, taskDescription: string): Promise<string[]> => {
  try {
    const prompt = `Generate 3-5 concrete, actionable subtasks for the task: "${taskTitle}". Description: "${taskDescription}". Return a JSON array of strings.`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error("Gemini subtask error:", error);
    return [];
  }
};