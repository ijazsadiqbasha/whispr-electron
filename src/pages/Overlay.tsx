import React, { useState, useEffect, useCallback, useRef } from 'react';
import { convertToWavAndBase64 } from '../lib/audioConvert.js';
//import { ipcRenderer } from 'electron'; // DOESNT WORK FOR SOME REASON
const { ipcRenderer } = window.require('electron');

const Overlay: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const barCountRef = useRef(50);
  const volumesRef = useRef<number[]>([]);
  const [, forceUpdate] = useState({});

  const log = (message: string) => {
    ipcRenderer.send('log', message);
  };
  
  const startRecording = useCallback(async () => {
    const selectedAudioInput = await ipcRenderer.invoke('getStoreValue', 'selectedAudioInput');
    const constraints = {
      audio: {
        deviceId: selectedAudioInput ? { exact: selectedAudioInput } : undefined,
        channelCount: 1,
        sampleRate: 16000,
      },
      video: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolumes = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const newVolumes = Array.from(dataArray).map(v => v / 255);
          volumesRef.current = newVolumes.slice(0, barCountRef.current);
          forceUpdate({}); // Force a re-render This is a test.
        }
        animationFrameRef.current = requestAnimationFrame(updateVolumes);
      };
      updateVolumes();

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.start(100);
      setMediaRecorder(recorder);
      
      audioChunksRef.current = [];
    } catch (error) {
      log(`Error starting recording: ${error}`);
    }
    setIsRecording(true);
    setIsProcessing(false);
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      setIsRecording(false);
      setIsProcessing(true);
      
      await new Promise(resolve => setTimeout(resolve, 125));

      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());

      if (audioChunksRef.current.length === 0) {
        log('No audio chunks captured during recording');
        ipcRenderer.invoke('overlay-error', 'No audio chunks captured during recording');
        return;
      }

      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const wavBase64 = await convertToWavAndBase64(audioBlob);

        ipcRenderer.invoke('transcribe-audio', wavBase64);
      } catch (error) {
        log(`Error converting audio: ${error}`);
        if (error instanceof Error) {
          log(`Error stack: ${error.stack}`);
        }
        ipcRenderer.invoke('overlay-error', `Error converting audio: ${error}`);
      }
    } else {
      log(`MediaRecorder not stopped. State: ${mediaRecorder?.state}`);
      ipcRenderer.invoke('overlay-error', `MediaRecorder not stopped. State: ${mediaRecorder?.state}`);
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, [mediaRecorder]);

  useEffect(() => {
    ipcRenderer.on('start-recording', startRecording);
    ipcRenderer.on('stop-recording', stopRecording);

    return () => {
      ipcRenderer.removeListener('start-recording', startRecording);
      ipcRenderer.removeListener('stop-recording', stopRecording);
    };
  }, [startRecording, stopRecording]);

  useEffect(() => {
    const updateBarCount = () => {
      const newBarCount = Math.floor(window.innerWidth / 7.7);
      barCountRef.current = Math.min(Math.max(newBarCount, 20), 98);
    };

    updateBarCount();
    window.addEventListener('resize', updateBarCount);

    return () => {
      window.removeEventListener('resize', updateBarCount);
    };
  }, []);

  useEffect(() => {
    ipcRenderer.send('overlay-ready');
  }, []);

  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div 
        className={`
          bg-background flex items-center justify-center 
          transition-all duration-300 ease-in-out h-full 
          origin-center rounded-2xl
          ${isProcessing ? 'w-1/2' : 'w-full'}
        `}
      >
        {isRecording ? (
          <div className="audio-wave w-full">
            {[...Array(barCountRef.current)].map((_, index) => {
              const volume = volumesRef.current[index] || 0;
              const position = index / (barCountRef.current - 1);
              
              const heightFactor = 1 - Math.pow(2 * position - 1, 2);
              const scale = volume * heightFactor;
              
              return (
                <div 
                  key={index} 
                  className={`wave-bar bg-primary volume-${Math.floor(scale * 10)}`}
                ></div>
              );
            })}
          </div>
        ) :  (
          <div className="loading-dots fade-in">
            <div></div>
            <div></div>
            <div></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Overlay;
