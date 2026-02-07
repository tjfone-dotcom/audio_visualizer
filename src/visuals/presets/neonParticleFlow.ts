import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { clamp, themeColors } from './helpers';

export const createNeonParticleFlow = (): VisualPreset => {
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  let colors: string[] = [];
  let time = 0;
  let motionBlur = 0.7;
  let audioState: AudioFeatures | null = null;

  const initParticles = (count: number) => {
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      life: Math.random()
    }));
  };

  return {
    init: (params: PresetInitParams) => {
      width = params.width;
      height = params.height;
      dpr = params.dpr;
      motionBlur = params.motionBlur;
      colors = themeColors(params.colorTheme);
      initParticles(420);
    },
    update: (audio: AudioFeatures, dt: number) => {
      audioState = audio;
      time += dt * 0.001;
      const speed = (0.6 + audio.bass * 2) * audio.sensitivity;
      const turbulence = 0.4 + audio.mid * 1.5;
      const sparkle = audio.treble * 1.5;

      particles.forEach((p) => {
        const angle =
          Math.sin((p.y / height) * Math.PI * 2 + time * 1.2) * turbulence +
          Math.cos((p.x / width) * Math.PI * 2 - time * 0.7) * turbulence;
        p.vx += Math.cos(angle) * speed * dt * 0.04;
        p.vy += Math.sin(angle) * speed * dt * 0.04;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt * 0.0002;

        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20 || p.life <= 0) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.vx = 0;
          p.vy = 0;
          p.life = 1;
        }

        if (Math.random() < sparkle * 0.01) {
          p.vx += (Math.random() - 0.5) * 3;
          p.vy += (Math.random() - 0.5) * 3;
        }
      });
    },
    render: (context: PresetRenderContext) => {
      if (context.type !== '2d' || !audioState) return;
      const ctx = context.ctx;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = `rgba(8, 8, 16, ${0.2 + (1 - motionBlur) * 0.8})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      particles.forEach((p, index) => {
        const color = colors[index % colors.length];
        const alpha = clamp(p.life, 0, 1);
        ctx.strokeStyle = `${color}${Math.floor(alpha * 200).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 1.2 + audioState.intensity * 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 8, p.y - p.vy * 8);
        ctx.stroke();
      });

      ctx.restore();
    },
    resize: (nextWidth: number, nextHeight: number, nextDpr: number) => {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      initParticles(420);
    },
    dispose: () => {
      particles = [];
    }
  };
};
