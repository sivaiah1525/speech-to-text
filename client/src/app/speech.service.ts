import { Injectable, NgZone, inject, signal } from '@angular/core';

export type Engine = 'browser' | 'gemini';

/**
 * Real-time speech-to-text with two engines:
 *  - 'browser': Web Speech API (Chrome/Edge). No key needed. Works for Hindi, English and Hinglish (hi-IN).
 *  - 'gemini':  microphone -> 16 kHz PCM -> WebSocket -> server -> Gemini Live API (key stays on server).
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  private zone = inject(NgZone);

  readonly listening = signal(false);
  readonly finalText = signal('');
  readonly interimText = signal('');
  readonly error = signal('');

  private recognition: any = null;
  private socket: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private startedAt = 0;
  private wantListening = false;

  get browserSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  get elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  reset(): void {
    this.finalText.set('');
    this.interimText.set('');
    this.error.set('');
  }

  async start(engine: Engine, language: string): Promise<void> {
    this.error.set('');
    this.startedAt = Date.now();
    this.wantListening = true;
    if (engine === 'browser') this.startBrowser(language);
    else await this.startGemini();
  }

  stop(): void {
    this.wantListening = false;
    this.recognition?.stop();
    this.recognition = null;
    this.socket?.close();
    this.socket = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioCtx?.close();
    this.audioCtx = null;
    if (this.interimText()) this.appendFinal(this.interimText());
    this.interimText.set('');
    this.listening.set(false);
  }

  // ---------- Engine 1: browser Web Speech API ----------
  private startBrowser(language: string): void {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      this.error.set('This browser has no built-in speech recognition. Use Chrome/Edge or the Gemini engine.');
      return;
    }
    const rec = new Ctor();
    rec.lang = language;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => this.zone.run(() => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) this.appendFinal(r[0].transcript);
        else interim += r[0].transcript;
      }
      this.interimText.set(interim);
    });
    rec.onerror = (e: any) => this.zone.run(() => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') this.error.set(`Speech error: ${e.error}`);
    });
    // Chrome stops after silence; restart while the user still wants to listen.
    rec.onend = () => this.zone.run(() => {
      if (this.wantListening && this.recognition === rec) rec.start();
      else this.listening.set(false);
    });

    this.recognition = rec;
    rec.start();
    this.listening.set(true);
  }

  // ---------- Engine 2: Gemini Live via server WebSocket ----------
  private async startGemini(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
    } catch {
      this.error.set('Microphone permission denied.');
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}/ws/transcribe`);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    socket.onmessage = (ev) => this.zone.run(() => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'transcript') {
        this.interimText.set(this.interimText() + msg.text);
        if (msg.final) { this.appendFinal(this.interimText()); this.interimText.set(''); }
      } else if (msg.type === 'error') {
        this.error.set(msg.message);
      }
    });
    socket.onclose = () => this.zone.run(() => this.wantListening && this.stop());

    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    await this.audioCtx.audioWorklet.addModule('pcm-worklet.js');
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    const worklet = new AudioWorkletNode(this.audioCtx, 'pcm16-writer');
    worklet.port.onmessage = (e) => socket.readyState === WebSocket.OPEN && socket.send(e.data);
    source.connect(worklet);
    this.listening.set(true);
  }

  private appendFinal(chunk: string): void {
    const text = chunk.trim();
    if (!text) return;
    this.finalText.set((this.finalText() + ' ' + text).trim());
  }
}
