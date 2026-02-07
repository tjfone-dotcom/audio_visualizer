import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioFeatures } from '../visuals/renderer/types';

const DEFAULT_FFT_SIZE = 2048;
const nodeCache = new WeakMap<HTMLMediaElement, AudioNodeChain>();

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

type AudioNodeChain = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  gain: GainNode;
  destination: MediaStreamAudioDestinationNode;
  connected: boolean;
  refCount: number;
};

const ensureConnected = (chain: AudioNodeChain) => {
  if (chain.connected) return;
  chain.source.connect(chain.analyser);
  chain.analyser.connect(chain.gain);
  chain.gain.connect(chain.context.destination);
  chain.gain.connect(chain.destination);
  chain.connected = true;
};

const getOrCreateChain = (audio: HTMLMediaElement) => {
  const cached = nodeCache.get(audio);
  if (cached) {
    cached.refCount += 1;
    ensureConnected(cached);
    return cached;
  }

  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = DEFAULT_FFT_SIZE;
  analyser.smoothingTimeConstant = 0.8;
  const gain = context.createGain();
  const destination = context.createMediaStreamDestination();
  const source = context.createMediaElementSource(audio);
  const chain: AudioNodeChain = {
    context,
    source,
    analyser,
    gain,
    destination,
    connected: false,
    refCount: 1
  };
  ensureConnected(chain);
  nodeCache.set(audio, chain);
  return chain;
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
  const chainRef = useRef<AudioNodeChain>();
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
        const chain = getOrCreateChain(audio);
        chainRef.current = chain;
        analyserRef.current = chain.analyser;
        audioContextRef.current = chain.context;
        sourceRef.current = chain.source;
        destinationRef.current = chain.destination;
        setReady(true);
      } catch (err) {
        setError(
          'AudioContext 초기화에 실패했습니다. 동일한 오디오 요소에 중복 연결이 발생했는지 확인해주세요.'
        );
        // eslint-disable-next-line no-console
        console.error('[useAudioAnalyzer] AudioContext setup failed.', err);
      }
    };

    setup();

    return () => {
      const chain = chainRef.current;
      if (chain) {
        chain.refCount -= 1;
        if (chain.refCount <= 0) {
          chain.source.disconnect();
          chain.analyser.disconnect();
          chain.gain.disconnect();
          chain.destination.disconnect();
          chain.connected = false;
          chain.refCount = 0;
        }
      }
    };
  }, [audioRef]);

  const resume = async () => {
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const updateFeatures = (time: number, playing: boolean) => {
    const analyser = analyserRef.current;
    if (!analyser) {
      pulseRef.current = clamp(pulseRef.current * 0.9, 0, 1);
      features.time = time;
      features.playing = playing;
      features.intensity = intensity;
      features.sensitivity = sensitivity;
      features.pulse = pulseRef.current;
      return features;
    }

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
