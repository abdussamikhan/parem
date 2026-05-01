import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendWhatsAppMessage(to: string, body: string) {
  if (!twilioClient) {
    console.warn('Twilio client not initialized. Cannot send message to', to);
    return;
  }
  
  try {
    const from = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
    const toWithPrefix = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    await twilioClient.messages.create({
      body,
      from,
      to: toWithPrefix,
    });
    console.log(`Sent WhatsApp message to ${to}`);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}
