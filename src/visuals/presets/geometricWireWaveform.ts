import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { themeColors } from './helpers';

export const createGeometricWireWaveform = (): VisualPreset => {
  let width = 0;
  let height = 0;
  let dpr = 1;
  let colors: string[] = [];
  let audioState: AudioFeatures | null = null;

  return {
    init: (params: PresetInitParams) => {
      width = params.width;
      height = params.height;
      dpr = params.dpr;
      colors = themeColors(params.colorTheme);
    },
    update: (audio: AudioFeatures) => {
      audioState = audio;
    },
    render: (context: PresetRenderContext) => {
      if (context.type !== '2d') return;
      if (!audioState) return;
      const ctx = context.ctx;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, width, height);

      const layers = 4;
      const amplitudeBoost = 1 + audioState.mid * 1.5;
      const microJitter = audioState.treble * 0.8;
      for (let layer = 0; layer < layers; layer += 1) {
        const color = colors[layer % colors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 + layer * 0.6 + audioState.mid * 1.2;
        ctx.beginPath();
        const offset = (height / (layers + 1)) * (layer + 1);
        const amplitude = (40 + layer * 18) * amplitudeBoost;
        const jitter = (layer + 1) * 0.3 + microJitter;

        for (let i = 0; i < 512; i += 1) {
          const x = (i / 511) * width;
          const idx = Math.floor((i / 511) * audioState.waveform.length);
          const sample = (audioState.waveform[idx] - 128) / 128;
          const y = offset + sample * amplitude + Math.sin(i * 0.08) * jitter;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      ctx.restore();
    },
    resize: (nextWidth: number, nextHeight: number, nextDpr: number) => {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
    },
    dispose: () => undefined
  };
};
