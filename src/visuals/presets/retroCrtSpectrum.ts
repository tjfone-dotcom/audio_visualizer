import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { clamp, themeColors } from './helpers';

export const createRetroCrtSpectrum = (): VisualPreset => {
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
      if (context.type !== '2d' || !audioState) return;
      const ctx = context.ctx;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, width, height);

      const barCount = 64;
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; i += 1) {
        const idx = Math.floor((i / barCount) * audioState.fft.length);
        const value = audioState.fft[idx] / 255;
        const barHeight = value * height * 0.6 * audioState.sensitivity * audioState.intensity;
        const color = colors[i % colors.length];
        ctx.fillStyle = color;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.7, barHeight);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1);
      }

      const noise = clamp(audioState.treble * 0.4, 0, 0.4);
      ctx.fillStyle = `rgba(255,255,255,${noise})`;
      for (let i = 0; i < width; i += 6) {
        ctx.fillRect(i, Math.random() * height, 1, 1);
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
