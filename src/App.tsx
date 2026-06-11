import {
  AudioLines,
  CircleDot,
  FileAudio,
  Fullscreen,
  Mic,
  MonitorSpeaker,
  Pause,
  Play,
  Shuffle,
  Sparkles,
  Waves,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { VisualizerCanvas } from './VisualizerCanvas';
import { useAudioEngine } from './audio/useAudioEngine';
import type { ColorMode, VisualMode } from './visualizer/types';

const visualModes: Array<{ value: VisualMode; label: string; icon: LucideIcon }> = [
  { value: 'spectrum', label: 'Spectrum', icon: AudioLines },
  { value: 'oscilloscope', label: 'Scope', icon: Waves },
  { value: 'radial', label: 'Radial', icon: CircleDot },
  { value: 'particles', label: 'Particles', icon: Sparkles },
  { value: 'abstract', label: 'Abstract', icon: Shuffle },
];

const colorModes: Array<{ value: ColorMode; label: string }> = [
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'synthwave', label: 'Synthwave' },
  { value: 'phosphor', label: 'Phosphor' },
  { value: 'mono', label: 'Mono' },
  { value: 'ember', label: 'Ember' },
];

function App() {
  const [visualMode, setVisualMode] = useState<VisualMode>('radial');
  const [colorMode, setColorMode] = useState<ColorMode>('synthwave');
  const [sensitivity, setSensitivity] = useState(1.12);
  const [particleCount, setParticleCount] = useState(1400);
  const [showChrome, setShowChrome] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    audioElementRef,
    audioFrame,
    inputLabel,
    isPlaying,
    status,
    error,
    connectFile,
    connectMicrophone,
    connectSystemAudio,
    togglePlayback,
  } = useAudioEngine();

  const currentMode = useMemo(
    () => visualModes.find((mode) => mode.value === visualMode) ?? visualModes[0],
    [visualMode],
  );

  const handleFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void connectFile(file);
      }
      event.target.value = '';
    },
    [connectFile],
  );

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      return;
    }
    void document.exitFullscreen();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <main className="app-shell" onDoubleClick={() => setShowChrome((value) => !value)}>
      <VisualizerCanvas
        audioFrame={audioFrame}
        colorMode={colorMode}
        particleCount={particleCount}
        sensitivity={sensitivity}
        visualMode={visualMode}
      />

      <audio ref={audioElementRef} className="audio-element" controls={false} />
      <input ref={fileInputRef} className="visually-hidden" type="file" accept="audio/*" onChange={handleFile} />

      <section className={`control-surface ${showChrome ? 'is-visible' : 'is-hidden'}`} aria-label="Visualizer controls">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <AudioLines size={22} />
          </div>
          <div>
            <h1>Canvas Wave Spectrum</h1>
            <p>{inputLabel ? `${inputLabel} · ${status}` : status}</p>
          </div>
        </div>

        <div className="primary-actions">
          <button className="icon-button primary" type="button" onClick={() => fileInputRef.current?.click()} title="Load audio file">
            <FileAudio size={20} />
          </button>
          <button className="icon-button" type="button" onClick={() => void connectMicrophone()} title="Use microphone">
            <Mic size={20} />
          </button>
          <button className="icon-button" type="button" onClick={() => void connectSystemAudio()} title="Capture tab or system audio">
            <MonitorSpeaker size={20} />
          </button>
          <button className="icon-button" type="button" onClick={() => void togglePlayback()} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className="icon-button" type="button" onClick={handleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Fullscreen size={20} />
          </button>
        </div>

        <div className="mode-row" role="tablist" aria-label="Visualization mode">
          {visualModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                aria-selected={visualMode === mode.value}
                className="mode-button"
                role="tab"
                type="button"
                onClick={() => setVisualMode(mode.value)}
                title={mode.label}
              >
                <Icon size={18} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="settings-grid">
          <label>
            <span>Colour</span>
            <select value={colorMode} onChange={(event) => setColorMode(event.target.value as ColorMode)}>
              {colorModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sensitivity</span>
            <input
              type="range"
              min="0.55"
              max="2"
              step="0.01"
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Particles</span>
            <input
              type="range"
              min="300"
              max="3200"
              step="100"
              value={particleCount}
              onChange={(event) => setParticleCount(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="telemetry" aria-live="polite">
          <span>{currentMode.label}</span>
          <span>Bass {Math.round(audioFrame.bass * 100)}%</span>
          <span>Mid {Math.round(audioFrame.mid * 100)}%</span>
          <span>Treble {Math.round(audioFrame.treble * 100)}%</span>
          {audioFrame.beat ? <strong>Beat</strong> : null}
        </div>

        {error ? <p className="error-message">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
