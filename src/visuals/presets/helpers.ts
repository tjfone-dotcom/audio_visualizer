import type { ColorTheme } from '../renderer/types';

export const themeColors = (theme: ColorTheme) => {
  switch (theme) {
    case 'warm':
      return ['#ff6b6b', '#ffb86b', '#ffd93d', '#f7c1ff'];
    case 'cool':
      return ['#5ee7ff', '#5f7bff', '#3ef2c2', '#87a1ff'];
    case 'mono':
      return ['#f8f8f8', '#b5b5b5', '#6f6f6f', '#2b2b2b'];
    case 'neon':
    default:
      return ['#7afff7', '#a855ff', '#ff5bf7', '#43ff75'];
  }
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
