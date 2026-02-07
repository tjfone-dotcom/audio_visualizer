import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { clamp, themeColors } from './helpers';

export const createAuroraGradientRibbons = (): VisualPreset => {
  let width = 0;
  let height = 0;
  let dpr = 1;
  let colors: string[] = [];
  let audioState: AudioFeatures | null = null;
  let time = 0;

  return {
    init: (params: PresetInitParams) => {
      width = params.width;
      height = params.height;
      dpr = params.dpr;
      colors = themeColors(params.colorTheme);
    },
    update: (audio: AudioFeatures, dt: number) => {
      audioState = audio;
      time += dt * 0.001 * (1 + audio.treble * 2);
    },
    render: (context: PresetRenderContext) => {
      if (context.type !== '2d' || !audioState) return;
      const ctx = context.ctx;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = 'rgba(6, 8, 16, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const ribbonCount = 5;
      for (let i = 0; i < ribbonCount; i += 1) {
        const amp = (60 + i * 18) * (0.4 + audioState.bass * 1.2);
        const thickness = (20 + audioState.mid * 50) * audioState.intensity;
        const phase = time + i * 0.4;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        const color = colors[i % colors.length];
        gradient.addColorStop(0, `${color}44`);
        gradient.addColorStop(0.5, `${color}cc`);
        gradient.addColorStop(1, `${color}22`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 20) {
          const y =
            height * (0.3 + i * 0.12) +
            Math.sin(x * 0.01 + phase) * amp +
            Math.cos(x * 0.005 + phase * 1.2) * amp * 0.4;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${clamp(audioState.pulse * 0.2)})`;
      ctx.fillRect(0, 0, width, height);
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
