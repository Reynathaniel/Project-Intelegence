import { UserRole, Project } from '../types';

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
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured. Please add VITE_ANTHROPIC_API_KEY to your environment.');
  }

  const base64 = await fileToBase64(pdfFile);
  const extractionPrompt = buildExtractionPrompt(discipline, projectContext);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true' // Note: In a real production app, this should be handled server-side
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022', // Updated to latest Sonnet
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          },
          {
            type: 'text',
            text: extractionPrompt
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to call Claude API');
  }

  const aiResponse = await response.json();
  const content = aiResponse.content[0].text;
  
  try {
    // Clean up potential markdown blocks if Claude ignored instructions
    const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('AI returned invalid JSON format. Please try again or fill manually.');
  }
};
