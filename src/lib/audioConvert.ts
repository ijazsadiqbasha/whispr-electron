const WHISPER_SAMPLE_RATE = 16000;
const WHISPER_AUDIO_FORMAT = {
  numChannels: 1,
  sampleRate: WHISPER_SAMPLE_RATE,
  bitsPerSample: 16
};

export function createWavFile(audioBuffer: AudioBuffer, format: typeof WHISPER_AUDIO_FORMAT): ArrayBuffer {
  const { numChannels, sampleRate, bitsPerSample } = format;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioBuffer.length * blockAlign;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  const uint8Array = new Uint8Array(arrayBuffer);

  // Write WAV header
  uint8Array.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, bufferSize - 8, true);
  uint8Array.set(new TextEncoder().encode('WAVE'), 8);
  uint8Array.set(new TextEncoder().encode('fmt '), 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  uint8Array.set(new TextEncoder().encode('data'), 36);
  view.setUint32(40, dataSize, true);

  // Write audio data
  const channelData = new Float32Array(audioBuffer.getChannelData(0));
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return arrayBuffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function convertToWavAndBase64(audioBlob: Blob): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const resampledBuffer = audioBuffer.sampleRate !== WHISPER_SAMPLE_RATE
    ? await resampleAudio(audioBuffer, WHISPER_SAMPLE_RATE)
    : audioBuffer;

  const wavArrayBuffer = createWavFile(resampledBuffer, WHISPER_AUDIO_FORMAT);
  return arrayBufferToBase64(wavArrayBuffer);
}

async function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  
  // Add a low-pass filter to prevent aliasing
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = targetSampleRate / 2;
  lowpass.Q.value = 0.707;

  source.connect(lowpass);
  lowpass.connect(offlineCtx.destination);
  
  source.start();
  return offlineCtx.startRendering();
}
