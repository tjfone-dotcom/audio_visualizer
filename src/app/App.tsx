import { useEffect, useMemo, useRef, useState } from 'react';
import { VisualizerCanvas } from '../components/VisualizerCanvas';
import { useAudioAnalyzer } from '../audio/useAudioAnalyzer';
import { PRESETS } from '../visuals/presets';
import type { ColorTheme, PresetDefinition } from '../visuals/renderer/types';

const SUPPORTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg'];
const SUPPORTED_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];

const formatFileName = (name: string) => name.replace(/\.[^.]+$/, '');

const buildRecordingName = (track: string, preset: string) => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${track}_${preset}_${date}_${time}.webm`;
};

const getScaleForTarget = (target: number | 'auto') => {
  if (target === 'auto') return 1;
  return Math.min(1, target / window.innerHeight);
};

const App = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [preset, setPreset] = useState<PresetDefinition>(PRESETS[0]);
  const [audioSrc, setAudioSrc] = useState<string>();
  const [trackName, setTrackName] = useState('track');
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loop, setLoop] = useState(false);
  const [sensitivity, setSensitivity] = useState(1);
  const [intensity, setIntensity] = useState(1);
  const [motionBlur, setMotionBlur] = useState(0.7);
  const [colorTheme, setColorTheme] = useState<ColorTheme>('neon');
  const [renderScale, setRenderScale] = useState(1);
  const [scaleMode, setScaleMode] = useState<'auto' | '720' | '1080'>('auto');
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isMobile = useMemo(() => /Mobi|Android/i.test(navigator.userAgent), []);
  const heavyPresets = new Set(['raymarch', 'milkdrop', 'instanced-grid']);

  const analyzer = useAudioAnalyzer(audioRef, sensitivity, intensity);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.loop = loop;
    }
  }, [volume, loop]);

  useEffect(() => {
    if (scaleMode === 'auto') {
      setRenderScale(1);
    } else if (scaleMode === '720') {
      setRenderScale(getScaleForTarget(720));
    } else {
      setRenderScale(getScaleForTarget(1080));
    }
  }, [scaleMode]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (audioSrc) URL.revokeObjectURL(audioSrc);
    };
  }, [audioSrc]);

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_TYPES.includes(file.type) && !SUPPORTED_EXT.includes(ext ?? '')) {
      setError('지원하지 않는 파일 형식입니다. mp3/wav/m4a/aac/ogg만 가능합니다.');
      return;
    }
    setError(undefined);
    const url = URL.createObjectURL(file);
    setAudioSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setTrackName(formatFileName(file.name));
  };

  const selectPreset = (nextPreset: PresetDefinition) => {
    if (isMobile && heavyPresets.has(nextPreset.id)) {
      const fallback = PRESETS.find((item) => item.id === 'aurora') ?? PRESETS[0];
      setPreset(fallback);
      setError('모바일 환경에서는 고사양 프리셋이 자동으로 대체됩니다.');
      return;
    }
    setError(undefined);
    setPreset(nextPreset);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    await analyzer.resume();
    if (audioRef.current.paused) {
      await audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(event.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const startRecording = () => {
    if (!audioRef.current || !analyzer.mediaStreamDestination) {
      setError('녹화를 시작할 수 없습니다. 오디오가 준비되지 않았습니다.');
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>('.visualizer-canvas[data-active="true"]');
    if (!canvas) {
      setError('캔버스를 찾을 수 없습니다.');
      return;
    }
    if (!('MediaRecorder' in window)) {
      setError('MediaRecorder가 지원되지 않습니다. 다른 브라우저를 사용해주세요.');
      return;
    }

    const videoStream = canvas.captureStream(30);
    const audioTracks = analyzer.mediaStreamDestination.stream.getAudioTracks();
    const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(combined, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = buildRecordingName(trackName, preset.name.replace(/\s+/g, '-'));
        link.click();
        URL.revokeObjectURL(url);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
    } catch (err) {
      setError('녹화를 시작할 수 없습니다. 코덱 지원을 확인해주세요.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const recorderStatus = useMemo(() => {
    if (recording) return `녹화 중 ${recordingTime}s`;
    return '녹화 준비됨';
  }, [recording, recordingTime]);

  return (
    <div className="app" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <aside className="panel">
        <h1>Audio Visualizer</h1>
        <div className="section">
          <div className="label">Upload</div>
          <div className="controls">
            <input type="file" accept={SUPPORTED_EXT.map((ext) => `.${ext}`).join(',')} onChange={handleUpload} />
            <div className="dropzone">드래그 & 드롭으로 오디오 파일을 추가하세요.</div>
            {error && <div className="small">{error}</div>}
            {analyzer.audioContext?.state === 'suspended' && (
              <button onClick={() => analyzer.resume()} className="ghost">
                AudioContext 활성화
              </button>
            )}
          </div>
        </div>

        <div className="section">
          <div className="label">Playback</div>
          <div className="controls">
            <button onClick={togglePlay} className="primary">
              {playing ? 'Pause' : 'Play'}
            </button>
            <div className="seek">
              <input type="range" min={0} max={duration || 0} value={currentTime} onChange={handleSeek} />
              <div className="time-row">
                <span>{analyzer.formatTime(currentTime)}</span>
                <span>{analyzer.formatTime(duration)}</span>
              </div>
            </div>
            <label className="label">Volume</label>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            <button onClick={() => setLoop((value) => !value)}>{loop ? 'Loop On' : 'Loop Off'}</button>
          </div>
        </div>

        <div className="section">
          <div className="label">Presets</div>
          <div className="preset-grid">
            {PRESETS.map((item) => (
              <div
                key={item.id}
                className={`preset-item ${preset.id === item.id ? 'active' : ''}`}
                onClick={() => selectPreset(item)}
              >
                <span>{item.name}</span>
                <span className="badge">{item.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="label">Visual Settings</div>
          <div className="controls">
            <label className="label">Intensity</label>
            <input type="range" min={0.5} max={2} step={0.01} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
            <label className="label">Sensitivity</label>
            <input type="range" min={0.5} max={2} step={0.01} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} />
            <label className="label">Motion Blur</label>
            <input type="range" min={0} max={0.9} step={0.01} value={motionBlur} onChange={(e) => setMotionBlur(Number(e.target.value))} />
            <label className="label">Color Theme</label>
            <select value={colorTheme} onChange={(e) => setColorTheme(e.target.value as ColorTheme)}>
              <option value="neon">Neon</option>
              <option value="warm">Warm</option>
              <option value="cool">Cool</option>
              <option value="mono">Mono</option>
            </select>
            <label className="label">Render Scale</label>
            <select value={scaleMode} onChange={(e) => setScaleMode(e.target.value as 'auto' | '720' | '1080')}>
              <option value="auto">Auto</option>
              <option value="720">720p</option>
              <option value="1080">1080p</option>
            </select>
            <label className="label">FPS</label>
            <button onClick={() => setShowFps((value) => !value)}>{showFps ? 'FPS On' : 'FPS Off'}</button>
            {showFps && <div className="small">{fps.toFixed(1)} fps</div>}
            <button onClick={() => document.documentElement.requestFullscreen?.()}>Fullscreen</button>
          </div>
        </div>

        <div className="section">
          <div className="label">Recording</div>
          <div className="controls">
            <button onClick={recording ? stopRecording : startRecording} className={recording ? '' : 'primary'}>
              {recording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <div className={`status-row ${recording ? 'recording' : ''}`}>{recorderStatus}</div>
            <div className="small">출력: webm / 30fps</div>
          </div>
        </div>
      </aside>

      <main className="visualizer-shell">
        {!audioSrc && <div className="overlay">오디오 파일을 업로드하면 시작됩니다.</div>}
        <VisualizerCanvas
          preset={preset}
          analyzer={analyzer}
          audioRef={audioRef}
          colorTheme={colorTheme}
          motionBlur={motionBlur}
          renderScale={renderScale}
          showFps={showFps}
          onFpsUpdate={setFps}
          onAutoScale={(next) => scaleMode === 'auto' && setRenderScale(next)}
        />
        <audio ref={audioRef} src={audioSrc} />
      </main>
    </div>
  );
};

export default App;
