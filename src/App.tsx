import {
  AudioLines,
  CircleDot,
  FileAudio,
  Fullscreen,
  PanelBottomClose,
  PanelLeftClose,
  PanelLeftOpen,
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
import { useScreenWakeLock } from './useScreenWakeLock';
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

const audioFileExtensions = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)$/i;

function isAudioFile(file: File) {
  return file.type.startsWith('audio/') || audioFileExtensions.test(file.name);
}

function hasFileDrag(event: React.DragEvent<HTMLElement>) {
  const { items, types } = event.dataTransfer;
  return Array.from(items).some((item) => item.kind === 'file') || Array.from(types).includes('Files');
}

function getDroppedAudioFile(fileList: FileList) {
  return Array.from(fileList).find(isAudioFile) ?? null;
}

function App() {
  useScreenWakeLock();

  const [visualMode, setVisualMode] = useState<VisualMode>('radial');
  const [colorMode, setColorMode] = useState<ColorMode>('synthwave');
  const [sensitivity, setSensitivity] = useState(1.12);
  const [particleCount, setParticleCount] = useState(900);
  const [showChrome, setShowChrome] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioDragActive, setIsAudioDragActive] = useState(false);
  const [fps, setFps] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawerToggleRef = useRef<HTMLButtonElement | null>(null);
  const openedFromFloatingToggleRef = useRef(false);
  const dragDepthRef = useRef(0);
  const {
    audioElementRef,
    audioFrame,
    audioFrameRef,
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

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsAudioDragActive(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsAudioDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsAudioDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasFileDrag(event)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = 0;
      setIsAudioDragActive(false);

      const file = getDroppedAudioFile(event.dataTransfer.files);
      if (file) {
        void connectFile(file);
      }
    },
    [connectFile],
  );

  useEffect(() => {
    if (!('launchQueue' in window)) {
      return;
    }

    window.launchQueue.setConsumer((launchParams) => {
      const [fileHandle] = launchParams.files;
      if (!fileHandle) {
        return;
      }

      void fileHandle.getFile().then((file) => connectFile(file));
    });
  }, [connectFile]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      return;
    }
    void document.exitFullscreen();
  }, []);

  const showControlsFromFloatingToggle = useCallback(() => {
    openedFromFloatingToggleRef.current = true;
    setShowChrome(true);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!showChrome || !openedFromFloatingToggleRef.current) {
      return;
    }

    openedFromFloatingToggleRef.current = false;
    requestAnimationFrame(() => drawerToggleRef.current?.focus());
  }, [showChrome]);

  return (
    <main
      className="app-shell"
      onDoubleClick={() => setShowChrome((value) => !value)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <VisualizerCanvas
        audioFrameRef={audioFrameRef}
        colorMode={colorMode}
        onFpsChange={setFps}
        particleCount={particleCount}
        sensitivity={sensitivity}
        visualMode={visualMode}
      />

      <audio ref={audioElementRef} className="audio-element" controls={false} />
      <input ref={fileInputRef} className="visually-hidden" type="file" accept="audio/*" onChange={handleFile} />

      <div className={`drop-target-overlay ${isAudioDragActive ? 'is-active' : ''}`} aria-hidden={!isAudioDragActive}>
        <div className="drop-target-panel">
          <FileAudio size={34} />
          <span>Drop audio to load</span>
        </div>
      </div>

      {!showChrome ? (
        <button
          aria-label="Show controls"
          className="floating-drawer-toggle is-visible"
          type="button"
          onClick={showControlsFromFloatingToggle}
          title="Show controls"
        >
          <PanelLeftOpen size={18} />
        </button>
      ) : null}

      <section className={`control-surface ${showChrome ? 'is-visible' : 'is-hidden'}`} aria-label="Visualizer controls">
        <div className="control-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <AudioLines size={22} />
            </div>
            <div>
              <h1>SpectraFlux</h1>
              <p>{inputLabel ? `${inputLabel} · ${status}` : status}</p>
            </div>
          </div>
          <button
            aria-label={showChrome ? 'Hide controls' : 'Show controls'}
            aria-expanded={showChrome}
            className="drawer-toggle"
            ref={drawerToggleRef}
            type="button"
            onClick={() => setShowChrome((value) => !value)}
            title={showChrome ? 'Hide controls' : 'Show controls'}
          >
            <PanelLeftClose className="drawer-icon-landscape" size={18} />
            <PanelBottomClose className="drawer-icon-portrait" size={18} />
          </button>
        </div>

        <div className="control-body">
          <section className="control-group" aria-labelledby="sources-heading">
            <h2 id="sources-heading">Audio Source</h2>
            <div className="primary-actions">
              <button className="icon-button primary" type="button" onClick={() => fileInputRef.current?.click()} title="Load audio file">
                <FileAudio size={20} />
              </button>
              <button className="icon-button" type="button" onClick={() => void connectMicrophone()} title="Use microphone; browser permission required">
                <Mic size={20} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => void connectSystemAudio()}
                title="Capture tab or system audio; browser permission required"
              >
                <MonitorSpeaker size={20} />
              </button>
              <button className="icon-button" type="button" onClick={() => void togglePlayback()} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={handleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Fullscreen size={20} />
              </button>
            </div>
          </section>

          <section className="control-group" aria-labelledby="modes-heading">
            <h2 id="modes-heading">Visualization</h2>
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
          </section>

          <section className="control-group" aria-labelledby="settings-heading">
            <h2 id="settings-heading">Appearance</h2>
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
                  max="2200"
                  step="100"
                  value={particleCount}
                  onChange={(event) => setParticleCount(Number(event.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="control-group" aria-labelledby="signal-heading">
            <h2 id="signal-heading">Signal</h2>
            <div className="telemetry" aria-live="polite">
              <span>{currentMode.label}</span>
              <span>Bass {Math.round(audioFrame.bass * 100)}%</span>
              <span>Mid {Math.round(audioFrame.mid * 100)}%</span>
              <span>Treble {Math.round(audioFrame.treble * 100)}%</span>
              <span>{fps} FPS</span>
              <strong className={audioFrame.beat ? 'is-active' : undefined}>Beat</strong>
            </div>
          </section>
        </div>

        {error ? <p className="error-message">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
