import Groq from 'groq-sdk';

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key', // prevent initialization crash if undefined locally
});

export async function generateGeneralResponse(prompt: string): Promise<string> {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a compassionate, professional AI medical assistant communicating via WhatsApp. Keep responses concise (under 50 words), factual, and empathetic. For general queries, answer directly. DO NOT provide medical diagnoses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 150,
    });
    
    return chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't process that right now.";
  } catch (error) {
    console.error("GROQ API Error:", error);
    return "I'm currently experiencing technical difficulties. Please contact the clinic directly if this is urgent.";
  }
}
