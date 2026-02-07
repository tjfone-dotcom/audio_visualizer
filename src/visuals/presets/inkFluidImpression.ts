import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { clamp, themeColors } from './helpers';

export const createInkFluidImpression = (): VisualPreset => {
  let width = 0;
  let height = 0;
  let dpr = 1;
  let blobs: Array<{ x: number; y: number; radius: number; hue: string; life: number }> = [];
  let colors: string[] = [];
  let time = 0;
  let audioState: AudioFeatures | null = null;

  return {
    init: (params: PresetInitParams) => {
      width = params.width;
      height = params.height;
      dpr = params.dpr;
      colors = themeColors(params.colorTheme);
      blobs = [];
    },
    update: (audio: AudioFeatures, dt: number) => {
      audioState = audio;
      time += dt * 0.001;
      const spawnRate = clamp(audio.rms * 6 * audio.sensitivity, 0.2, 3.5);
      const expand = 20 + audio.bass * 80;
      const ripple = audio.treble * 0.4;

      if (Math.random() < spawnRate * 0.02) {
        blobs.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 20 + Math.random() * 40,
          hue: colors[Math.floor(Math.random() * colors.length)],
          life: 1
        });
      }

      blobs = blobs.filter((blob) => {
        blob.radius += expand * dt * 0.02;
        blob.life -= dt * 0.0003;
        blob.x += Math.sin(time + blob.radius * 0.01) * ripple * 8;
        blob.y += Math.cos(time + blob.radius * 0.01) * ripple * 8;
        return blob.life > 0;
      });
    },
    render: (context: PresetRenderContext) => {
      if (context.type !== '2d' || !audioState) return;
      const ctx = context.ctx;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = 'rgba(5, 6, 10, 0.2)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      blobs.forEach((blob) => {
        const alpha = clamp(blob.life, 0, 1);
        for (let i = 0; i < 4; i += 1) {
          const scale = 1 + i * 0.12;
          ctx.beginPath();
          ctx.fillStyle = `${blob.hue}${Math.floor(alpha * 140).toString(16).padStart(2, '0')}`;
          ctx.ellipse(
            blob.x,
            blob.y,
            blob.radius * scale * audioState.intensity,
            blob.radius * scale * 0.9 * audioState.intensity,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      });

      ctx.restore();
    },
    resize: (nextWidth: number, nextHeight: number, nextDpr: number) => {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      blobs = [];
    },
    dispose: () => {
      blobs = [];
    }
  };
};
