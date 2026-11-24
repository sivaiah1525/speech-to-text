// AudioWorklet: converts Float32 microphone samples to 16-bit PCM and posts ~100 ms chunks.
class Pcm16Writer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.chunkSize = 1600; // 100 ms at 16 kHz
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input) {
      for (let i = 0; i < input.length; i++) this.buffer.push(input[i]);
      while (this.buffer.length >= this.chunkSize) {
        const frame = this.buffer.splice(0, this.chunkSize);
        const pcm = new Int16Array(frame.length);
        for (let i = 0; i < frame.length; i++) {
          const s = Math.max(-1, Math.min(1, frame[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('pcm16-writer', Pcm16Writer);
