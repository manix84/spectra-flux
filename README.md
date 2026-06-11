# Canvas Wave Spectrum

A full-screen real-time audio visualizer inspired by Windows Media Player, Winamp, MilkDrop, projectM, and early 2000s desktop music players.

## Features

- File, microphone, and browser-supported tab/system audio capture
- FFT frequency analysis with bass, mid, treble, volume, waveform, and beat data
- Spectrum, oscilloscope, radial spectrum, particle, and abstract visual modes
- Smooth interpolation, decay, beat flashes, and long-running procedural motion
- Rainbow, synthwave, phosphor, monochrome, and ember colour systems
- PWA manifest, service worker, install icons, and offline shell caching
- TypeScript, React, Vite, ESLint flat config, and smart semver bump scripts

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Load an audio file, use the microphone, or share tab/screen audio when the browser prompts you.

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run build` typechecks and builds the production app.
- `npm run lint` runs ESLint with zero warnings allowed.
- `npm run version:bump` infers patch/minor/major from recent conventional commits.
- `npm run version:bump:patch`, `:minor`, and `:major` force a specific semver bump.

## Browser Notes

Microphone and display audio capture require HTTPS or localhost. System audio support depends on the browser and operating system; Chromium browsers usually support tab audio sharing, while OS-wide capture can be restricted.
