export type PresetRenderContext =
  | { type: '2d'; ctx: CanvasRenderingContext2D }
  | { type: 'webgl'; gl: WebGL2RenderingContext; canvas: HTMLCanvasElement };

export type PresetInitParams = {
  width: number;
  height: number;
  dpr: number;
  colorTheme: ColorTheme;
  motionBlur: number;
};

export type AudioFeatures = {
  fft: Uint8Array;
  waveform: Uint8Array;
  rms: number;
  peak: number;
  bass: number;
  mid: number;
  treble: number;
  spectralCentroid: number;
  pulse: number;
  intensity: number;
  sensitivity: number;
  time: number;
  playing: boolean;
};

export type PresetDefinition = {
  id: string;
  name: string;
  type: '2d' | 'webgl';
  create: () => VisualPreset;
};

export type ColorTheme = 'warm' | 'cool' | 'mono' | 'neon';

export type VisualPreset = {
  init: (params: PresetInitParams) => void;
  update: (audio: AudioFeatures, dt: number) => void;
  render: (context: PresetRenderContext) => void;
  resize: (width: number, height: number, dpr: number) => void;
  dispose: () => void;
};
