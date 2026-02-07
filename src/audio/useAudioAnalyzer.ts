import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioFeatures } from '../visuals/renderer/types';

const DEFAULT_FFT_SIZE = 2048;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatTime = (time: number) => {
  if (!Number.isFinite(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export type AnalyzerState = {
  ready: boolean;
  error?: string;
  features: AudioFeatures;
  audioContext?: AudioContext;
  resume: () => Promise<void>;
  mediaStreamDestination?: MediaStreamAudioDestinationNode;
  formatTime: (time: number) => string;
  updateFeatures: (time: number, playing: boolean) => AudioFeatures;
};

export const useAudioAnalyzer = (
  audioRef: React.RefObject<HTMLAudioElement>,
  sensitivity: number,
  intensity: number
): AnalyzerState => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();
  const destinationRef = useRef<MediaStreamAudioDestinationNode>();
  const fftDataRef = useRef<Uint8Array>(new Uint8Array(DEFAULT_FFT_SIZE / 2));
  const waveformRef = useRef<Uint8Array>(new Uint8Array(DEFAULT_FFT_SIZE));
  const prevEnergyRef = useRef(0);
  const pulseRef = useRef(0);

  const features = useMemo<AudioFeatures>(
    () => ({
      fft: fftDataRef.current,
      waveform: waveformRef.current,
      rms: 0,
      peak: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      spectralCentroid: 0,
      pulse: 0,
      intensity,
      sensitivity,
      time: 0,
      playing: false
    }),
    [intensity, sensitivity]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setup = async () => {
      try {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = DEFAULT_FFT_SIZE;
        analyser.smoothingTimeConstant = 0.8;

        const source = context.createMediaElementSource(audio);
        const destination = context.createMediaStreamDestination();
        source.connect(analyser);
        analyser.connect(context.destination);
        source.connect(destination);

        analyserRef.current = analyser;
        audioContextRef.current = context;
        sourceRef.current = source;
        destinationRef.current = destination;
        setReady(true);
      } catch (err) {
        setError('AudioContext 초기화에 실패했습니다. 브라우저 지원을 확인해주세요.');
        // eslint-disable-next-line no-console
        console.error(err);
      }
    };

    setup();

    return () => {
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      destinationRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, [audioRef]);

  const resume = async () => {
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const updateFeatures = (time: number, playing: boolean) => {
    const analyser = analyserRef.current;
    if (!analyser) return features;

    analyser.getByteFrequencyData(fftDataRef.current);
    analyser.getByteTimeDomainData(waveformRef.current);

    const fft = fftDataRef.current;
    const waveform = waveformRef.current;
    const fftLength = fft.length;
    const sampleRate = audioContextRef.current?.sampleRate ?? 44100;

    let rmsSum = 0;
    let peak = 0;
    let energySum = 0;
    let centroidSum = 0;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let bassCount = 0;
    let midCount = 0;
    let trebleCount = 0;

    for (let i = 0; i < waveform.length; i += 1) {
      const v = (waveform[i] - 128) / 128;
      rmsSum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }

    for (let i = 0; i < fftLength; i += 1) {
      const magnitude = fft[i] / 255;
      const freq = (i * sampleRate) / (2 * fftLength);
      energySum += magnitude;
      centroidSum += freq * magnitude;

      if (freq >= 20 && freq < 150) {
        bassSum += magnitude;
        bassCount += 1;
      } else if (freq >= 150 && freq < 2000) {
        midSum += magnitude;
        midCount += 1;
      } else if (freq >= 2000 && freq < 12000) {
        trebleSum += magnitude;
        trebleCount += 1;
      }
    }

    const rms = Math.sqrt(rmsSum / waveform.length);
    const bass = bassCount ? bassSum / bassCount : 0;
    const mid = midCount ? midSum / midCount : 0;
    const treble = trebleCount ? trebleSum / trebleCount : 0;
    const spectralCentroid = energySum > 0 ? centroidSum / energySum : 0;
    const energy = (bass + mid + treble) / 3;

    const delta = energy - prevEnergyRef.current;
    prevEnergyRef.current = energy;
    pulseRef.current = clamp(pulseRef.current * 0.9 + delta * 1.8, 0, 1);

    features.rms = rms;
    features.peak = peak;
    features.bass = bass;
    features.mid = mid;
    features.treble = treble;
    features.spectralCentroid = spectralCentroid;
    features.pulse = pulseRef.current;
    features.time = time;
    features.playing = playing;
    features.intensity = intensity;
    features.sensitivity = sensitivity;

    return features;
  };

  return {
    ready,
    error,
    features,
    audioContext: audioContextRef.current,
    resume,
    mediaStreamDestination: destinationRef.current,
    formatTime,
    updateFeatures
  };
};
