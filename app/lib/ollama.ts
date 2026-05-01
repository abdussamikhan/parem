export async function queryLocalHealthcareModel(prompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Jayasimma/healthcare',
        prompt: `You are a clinical AI assistant triaging patient symptoms. Analyze the following patient message: "${prompt}". Assess severity and provide a concise, medically sound response under 50 words. If symptoms sound severe (e.g., chest pain, shortness of breath, severe bleeding), reply with "SOS_TRIGGERED".`,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Local Ollama Error:", error);
    // Fallback if local model is down or unreachable
    return "I'm having trouble analyzing your symptoms right now. If this is an emergency, please call your local emergency number or go to the nearest hospital.";
  }
}
