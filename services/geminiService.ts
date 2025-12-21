import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "../types";

/**
 * Uses Gemini to parse natural language input into structured task data.
 */
export const parseTaskWithGemini = async (
  input: string
): Promise<Partial<Task> | null> => {
  if (!input.trim()) return null;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract task details from this input: "${input}". 
      If a due date is mentioned, use YYYY-MM-DD format. 
      If no due date is found, use today's date (${new Date().toISOString().split('T')[0]}).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Short and clear title for the task.',
            },
            description: {
              type: Type.STRING,
              description: 'Detailed explanation of the task.',
            },
            dueDate: {
              type: Type.STRING,
              description: 'Due date in YYYY-MM-DD format.',
            }
          },
          required: ["title", "dueDate"],
          propertyOrdering: ["title", "description", "dueDate"],
        },
      },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini parse error:", error);
    // Graceful fallback to basic extraction
    return {
      title: input.trim(),
      description: "",
      dueDate: new Date().toISOString().split('T')[0]
    };
  }
};

/**
 * Generates subtasks based on task context using Gemini.
 */
export const generateSubtasks = async (taskTitle: string, taskDescription: string): Promise<string[]> => {
  if (!taskTitle) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a logical list of 3-5 subtasks for:
      Task: ${taskTitle}
      Description: ${taskDescription || 'No description provided.'}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) return [];
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini subtasks error:", error);
    return [];
  }
};
