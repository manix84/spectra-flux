import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioFrame } from '../visualizer/types';

const fftSize = 2048;
const smoothingTimeConstant = 0.76;
const beatHoldMs = 220;
const beatThreshold = 1.35;
const telemetryIntervalMs = 125;

const emptyFrame: AudioFrame = {
  volume: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: false,
  frequencyBins: new Uint8Array(fftSize / 2),
  waveform: new Uint8Array(fftSize),
};

type AudioStatus = 'Idle' | 'Listening' | 'Playing' | 'Paused';

function averageRange(data: Uint8Array, start: number, end: number) {
  let total = 0;
  const safeEnd = Math.min(end, data.length);
  for (let index = start; index < safeEnd; index += 1) {
    total += data[index];
  }
  return total / Math.max(1, safeEnd - start) / 255;
}

export function useAudioEngine() {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const streamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const lowHistoryRef = useRef<number[]>([]);
  const lastBeatRef = useRef(0);
  const lastTelemetryRef = useRef(0);
  const smoothedRef = useRef({ volume: 0, bass: 0, mid: 0, treble: 0 });
  const audioFrameRef = useRef<AudioFrame>(emptyFrame);
  const [audioFrame, setAudioFrame] = useState<AudioFrame>(emptyFrame);
  const [inputLabel, setInputLabel] = useState('');
  const [status, setStatus] = useState<AudioStatus>('Idle');
  const [error, setError] = useState('');

  const isPlaying = useMemo(() => status === 'Playing' || status === 'Listening', [status]);

  const ensureContext = useCallback(() => {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    const context = contextRef.current ?? new AudioContextConstructor();
    contextRef.current = context;

    const analyser = analyserRef.current ?? context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;
    analyserRef.current = analyser;

    return { context, analyser };
  }, []);

  const stopStream = useCallback(() => {
    streamSourceRef.current?.disconnect();
    streamSourceRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const startSampling = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const frequencyBins = new Uint8Array(fftSize / 2);
    const waveform = new Uint8Array(fftSize);

    const sample = () => {
      const analyser = analyserRef.current;
      if (!analyser) {
        return;
      }

      analyser.getByteFrequencyData(frequencyBins);
      analyser.getByteTimeDomainData(waveform);

      const bass = averageRange(frequencyBins, 1, 18);
      const mid = averageRange(frequencyBins, 18, 160);
      const treble = averageRange(frequencyBins, 160, 520);
      const volume = averageRange(frequencyBins, 1, 700);
      const history = lowHistoryRef.current;
      history.push(bass);
      if (history.length > 48) {
        history.shift();
      }

      const rollingBass = history.reduce((total, value) => total + value, 0) / Math.max(1, history.length);
      const now = performance.now();
      const beat = bass > Math.max(0.18, rollingBass * beatThreshold) && now - lastBeatRef.current > beatHoldMs;
      if (beat) {
        lastBeatRef.current = now;
      }

      const target = { volume, bass, mid, treble };
      const previous = smoothedRef.current;
      const smoothing = beat ? 0.38 : 0.18;
      smoothedRef.current = {
        volume: previous.volume + (target.volume - previous.volume) * smoothing,
        bass: previous.bass + (target.bass - previous.bass) * smoothing,
        mid: previous.mid + (target.mid - previous.mid) * smoothing,
        treble: previous.treble + (target.treble - previous.treble) * smoothing,
      };

      audioFrameRef.current = {
        ...smoothedRef.current,
        beat,
        frequencyBins,
        waveform,
      };

      if (beat || now - lastTelemetryRef.current > telemetryIntervalMs) {
        lastTelemetryRef.current = now;
        setAudioFrame(audioFrameRef.current);
      }

      animationRef.current = requestAnimationFrame(sample);
    };

    sample();
  }, []);

  const connectFile = useCallback(
    async (file: File) => {
      setError('');
      stopStream();
      const audio = audioElementRef.current;
      if (!audio) {
        return;
      }

      const { context, analyser } = ensureContext();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (!mediaSourceRef.current) {
        mediaSourceRef.current = context.createMediaElementSource(audio);
        mediaSourceRef.current.connect(analyser);
        analyser.connect(context.destination);
      }

      objectUrlRef.current = URL.createObjectURL(file);
      audio.src = objectUrlRef.current;
      audio.loop = true;
      await context.resume();
      await audio.play();
      setInputLabel(file.name);
      setStatus('Playing');
      startSampling();
    },
    [ensureContext, startSampling, stopStream],
  );

  const connectStream = useCallback(
    async (stream: MediaStream, label: string) => {
      setError('');
      stopStream();
      audioElementRef.current?.pause();
      const { context, analyser } = ensureContext();
      const streamSource = context.createMediaStreamSource(stream);
      streamSource.connect(analyser);
      streamSourceRef.current = streamSource;
      mediaStreamRef.current = stream;
      await context.resume();
      setInputLabel(label);
      setStatus('Listening');
      startSampling();
    },
    [ensureContext, startSampling, stopStream],
  );

  const connectMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      await connectStream(stream, 'Microphone');
    } catch {
      setError('Microphone permission was denied or unavailable.');
    }
  }, [connectStream]);

  const connectSystemAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const audioTracks = stream.getAudioTracks();
      stream.getVideoTracks().forEach((track) => track.stop());
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        setError('No tab or system audio track was shared.');
        return;
      }
      await connectStream(new MediaStream(audioTracks), 'Tab or system audio');
    } catch {
      setError('Audio capture was cancelled or unavailable in this browser.');
    }
  }, [connectStream]);

  const togglePlayback = useCallback(async () => {
    const audio = audioElementRef.current;
    if (audio?.src) {
      if (audio.paused) {
        await audio.play();
        await contextRef.current?.resume();
        setStatus('Playing');
      } else {
        audio.pause();
        setStatus('Paused');
      }
      return;
    }

    if (contextRef.current?.state === 'running') {
      await contextRef.current.suspend();
      setStatus('Paused');
      return;
    }

    await contextRef.current?.resume();
    if (inputLabel) {
      setStatus('Listening');
    }
  }, [inputLabel]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      stopStream();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      void contextRef.current?.close();
    };
  }, [stopStream]);

  return {
    audioElementRef,
    audioFrame,
    audioFrameRef,
    inputLabel,
    isPlaying,
    status,
    error,
    connectFile,
    connectMicrophone,
    connectSystemAudio,
    togglePlayback,
  };
}
