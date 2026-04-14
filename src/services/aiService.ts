import { UserRole, Project } from '../types';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY 
});

export const buildExtractionPrompt = (discipline: UserRole, project: Project): string => {
  const basePrompt = `You are an expert EPC (Engineering, Procurement, and Construction) data analyst. 
Extract all data from this ${discipline} Daily Report PDF for project "${project.name}" into JSON matching the exact structure provided below.
Return ONLY valid JSON, no explanation, no markdown formatting (no \`\`\`json blocks). 
If a field is not found, use 0 for numbers, [] for arrays, '' for strings, and null for optional objects.
Ensure all numeric values are actual numbers, not strings.`;

  switch (discipline) {
    case 'HSE':
      return `${basePrompt}
{
  "permits": [{"number": "string", "status": "Open" | "Close"}],
  "manhours": {"direct": number, "indirect": number, "overtime": number, "total": number},
  "safetyInduction": {"entries": [{"description": "string", "photos": []}]},
  "toolboxMeeting": {"entries": [{"description": "string", "photos": []}]},
  "safetyPatrol": {"entries": [{"description": "string", "photos": []}]},
  "safetyMeeting": {"entries": [{"description": "string", "photos": []}]},
  "unsafeAction": {"entries": [{"description": "string", "photos": []}]},
  "unsafeCondition": {"entries": [{"description": "string", "photos": []}]},
  "nearMiss": {"entries": [{"description": "string", "photos": []}]},
  "accident": {"entries": [{"description": "string", "photos": []}]},
  "p3k": {"entries": [{"description": "string", "photos": []}]},
  "apd": {"entries": [{"description": "string", "photos": []}]},
  "rambu": {"entries": [{"description": "string", "photos": []}]},
  "others": {"entries": [{"description": "string", "photos": []}]},
  "healthStatus": {"directSick": number, "directHealthy": number, "indirectSick": number, "indirectHealthy": number},
  "stopWorkOrders": [{"type": "string", "number": "string", "cause": "string", "impact": "string"}],
  "notes": "string"
}`;
    case 'Supervisor':
      return `${basePrompt}
{
  "supervisorName": "string",
  "activities": [{
    "workItem": "string", 
    "area": "string", 
    "location": "string", 
    "discipline": "string",
    "progress": number, 
    "unit": "string", 
    "manpowerDirect": number,
    "equipment": "string", 
    "notes": "string", 
    "assistanceNeeded": "string"
  }],
  "notes": "string"
}`;
    case 'Logistics':
      return `${basePrompt}
{
  "spbUpdates": [{
    "spbNo": "string",
    "itemName": "string",
    "status": "Proses" | "Done",
    "receipts": [{"volume": number, "price": number, "total": number}],
    "usages": [{"volume": number, "workItem": "string", "area": "string"}]
  }],
  "fuelIn": [{"date": "string", "volume": number, "source": "string"}],
  "fuelOut": [{"date": "string", "vehicleName": "string", "volume": number}],
  "notes": "string"
}`;
    case 'QC':
      return `${basePrompt}
{
  "inspections": [{"workItem": "string", "status": "string", "remarks": "string"}],
  "nonConformity": [{"issue": "string", "status": "string"}],
  "testResults": [{"testName": "string", "result": "string"}],
  "punchList": [{"item": "string", "status": "string"}],
  "notes": "string"
}`;
    case 'HR':
      return `${basePrompt}
{
  "personnelList": [{
    "manpowerId": "string",
    "name": "string",
    "position": "string",
    "classification": "Direct" | "Indirect",
    "siteStatus": "On Site" | "Off Site",
    "activeStatus": "Active" | "Resign"
  }],
  "notes": "string"
}`;
    case 'Project Control':
      return `${basePrompt}
{
  "todaysActual": "string",
  "tomorrowsPlan": "string",
  "scheduleVariance": "string",
  "costStatus": "string",
  "narrative": "string",
  "notes": "string"
}`;
    default:
      return `${basePrompt}
{
  "notes": "string"
}`;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const processPDFWithAI = async (
  pdfFile: File,
  discipline: UserRole,
  projectContext: Project
): Promise<any> => {
  const base64 = await fileToBase64(pdfFile);
  const extractionPrompt = buildExtractionPrompt(discipline, projectContext);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64
          }
        },
        {
          text: extractionPrompt
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const content = response.text;
    if (!content) {
      throw new Error('AI returned an empty response.');
    }

    // Clean up potential markdown blocks if Gemini ignored instructions
    const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    if (error.message?.includes('API key')) {
      throw new Error('Gemini API key is missing or invalid. Please configure VITE_GEMINI_API_KEY or use the platform key selector.');
    }
    throw new Error(error.message || 'Failed to process PDF with Gemini AI');
  }
};
