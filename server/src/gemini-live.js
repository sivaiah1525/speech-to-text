// WebSocket bridge: browser streams 16 kHz mono PCM16 audio -> this server -> Gemini Live API.
// Gemini returns input-audio transcription, which we forward to the browser as it arrives.
// The API key stays on the server and never reaches the browser.
const { WebSocketServer } = require('ws');

const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-live-2.5-flash-preview';

function attachGeminiLive(server) {
  const wss = new WebSocketServer({ server, path: '/ws/transcribe' });

  wss.on('connection', async (client) => {
    if (!process.env.GEMINI_API_KEY) {
      client.send(JSON.stringify({ type: 'error', message: 'GEMINI_API_KEY is not set on the server' }));
      return client.close();
    }

    let session;
    try {
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: {},
          systemInstruction:
            'You are a transcription service. The speaker may mix Hindi and English (Hinglish). ' +
            'Do not answer or comment; only listen.',
        },
        callbacks: {
          onmessage: (msg) => {
            const t = msg?.serverContent?.inputTranscription;
            if (t?.text && client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'transcript', text: t.text, final: !!t.finished }));
            }
          },
          onerror: (e) => client.send(JSON.stringify({ type: 'error', message: e?.message || 'Gemini error' })),
          onclose: () => client.readyState === client.OPEN && client.close(),
        },
      });
      client.send(JSON.stringify({ type: 'ready', model: MODEL }));
    } catch (err) {
      client.send(JSON.stringify({ type: 'error', message: err.message }));
      return client.close();
    }

    client.on('message', (data, isBinary) => {
      if (!isBinary) return; // control messages are not used yet
      session.sendRealtimeInput({
        audio: { data: Buffer.from(data).toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      });
    });

    client.on('close', () => { try { session?.close(); } catch { /* already closed */ } });
  });
}

module.exports = { attachGeminiLive };
