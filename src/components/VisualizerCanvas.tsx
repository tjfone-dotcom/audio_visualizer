import { useEffect, useMemo, useRef } from 'react';
import type { AnalyzerState } from '../audio/useAudioAnalyzer';
import type { ColorTheme, PresetDefinition, PresetRenderContext, VisualPreset } from '../visuals/renderer/types';

const RESIZE_DEBOUNCE = 120;

type Props = {
  preset: PresetDefinition;
  analyzer: AnalyzerState;
  audioRef: React.RefObject<HTMLAudioElement>;
  colorTheme: ColorTheme;
  motionBlur: number;
  renderScale: number;
  showFps: boolean;
  onFpsUpdate: (fps: number) => void;
  onAutoScale: (nextScale: number) => void;
};

export const VisualizerCanvas = ({
  preset,
  analyzer,
  audioRef,
  colorTheme,
  motionBlur,
  renderScale,
  showFps,
  onFpsUpdate,
  onAutoScale
}: Props) => {
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWebglRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transitionRef = useRef<HTMLCanvasElement | null>(null);
  const presetRef = useRef<VisualPreset | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const resizeTimerRef = useRef<number>();
  const transitionAlphaRef = useRef(0);
  const frameTimes = useRef<number[]>([]);

  const renderContext = useMemo<PresetRenderContext | null>(() => {
    if (preset.type === '2d') {
      const canvas = canvas2dRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      return { type: '2d', ctx };
    }
    const canvas = canvasWebglRef.current;
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    return { type: 'webgl', gl, canvas };
  }, [preset]);

  const updateSize = () => {
    const canvas2d = canvas2dRef.current;
    const canvasWebgl = canvasWebglRef.current;
    const parent = canvas2d?.parentElement ?? canvasWebgl?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = Math.floor(rect.width * dpr * renderScale);
    const scaledHeight = Math.floor(rect.height * dpr * renderScale);
    if (canvas2d) {
      canvas2d.width = scaledWidth;
      canvas2d.height = scaledHeight;
    }
    if (canvasWebgl) {
      canvasWebgl.width = scaledWidth;
      canvasWebgl.height = scaledHeight;
    }
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    if (transitionRef.current) {
      transitionRef.current.width = scaledWidth;
      transitionRef.current.height = scaledHeight;
    }
    const activeCanvas = preset.type === 'webgl' ? canvasWebgl : canvas2d;
    if (!activeCanvas) return;
    const resizeWidth = preset.type === 'webgl' ? activeCanvas.width : rect.width;
    const resizeHeight = preset.type === 'webgl' ? activeCanvas.height : rect.height;
    presetRef.current?.resize(resizeWidth, resizeHeight, dpr * renderScale);
  };

  useEffect(() => {
    const handleResize = () => {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(updateSize, RESIZE_DEBOUNCE);
    };
    window.addEventListener('resize', handleResize);
    updateSize();
    return () => window.removeEventListener('resize', handleResize);
  }, [renderScale]);

  useEffect(() => {
    const canvas2d = canvas2dRef.current;
    const canvasWebgl = canvasWebglRef.current;
    const activeCanvas = preset.type === 'webgl' ? canvasWebgl : canvas2d;
    if (!activeCanvas) return;

    const instance = preset.create();
    presetRef.current?.dispose();
    presetRef.current = instance;

    const parent = activeCanvas.parentElement;
    const rect = parent?.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    instance.init({
      width: preset.type === 'webgl' ? activeCanvas.width : rect?.width ?? activeCanvas.width,
      height: preset.type === 'webgl' ? activeCanvas.height : rect?.height ?? activeCanvas.height,
      dpr: dpr * renderScale,
      colorTheme,
      motionBlur
    });
    updateSize();

    if (transitionRef.current) {
      const ctx = transitionRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, transitionRef.current.width, transitionRef.current.height);
        ctx.drawImage(activeCanvas, 0, 0, transitionRef.current.width, transitionRef.current.height);
        transitionAlphaRef.current = 1;
        transitionRef.current.style.opacity = '1';
      }
    }

    return () => {
      instance.dispose();
    };
  }, [preset, colorTheme, motionBlur, renderScale]);

  useEffect(() => {
    let rafId = 0;
    const loop = (now: number) => {
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const audio = analyzer.updateFeatures(audioRef.current?.currentTime ?? 0, !audioRef.current?.paused);
      const instance = presetRef.current;
      if (instance && renderContext) {
        instance.update(audio, dt);
        instance.render(renderContext);
      }

      if (transitionAlphaRef.current > 0 && transitionRef.current) {
        transitionAlphaRef.current = Math.max(0, transitionAlphaRef.current - dt / 250);
        transitionRef.current.style.opacity = transitionAlphaRef.current.toFixed(2);
      }

      frameTimes.current.push(dt);
      if (frameTimes.current.length > 20) frameTimes.current.shift();
      const avgDt = frameTimes.current.reduce((sum, value) => sum + value, 0) / frameTimes.current.length;
      const fps = 1000 / avgDt;
      if (showFps) onFpsUpdate(fps);
      if (fps < 28 && renderScale > 0.6) {
        onAutoScale(Math.max(0.5, renderScale - 0.1));
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [analyzer, audioRef, renderContext, showFps, renderScale, onFpsUpdate, onAutoScale]);

  return (
    <div className="visualizer-shell">
      <canvas
        ref={canvas2dRef}
        className="visualizer-canvas"
        data-active={preset.type === '2d'}
        style={{ display: preset.type === '2d' ? 'block' : 'none' }}
      />
      <canvas
        ref={canvasWebglRef}
        className="visualizer-canvas"
        data-active={preset.type === 'webgl'}
        style={{ display: preset.type === 'webgl' ? 'block' : 'none' }}
      />
      <canvas ref={transitionRef} className="visualizer-canvas" style={{ opacity: 0 }} />
    </div>
  );
};
