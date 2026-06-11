export type VisualMode = 'spectrum' | 'oscilloscope' | 'radial' | 'particles' | 'abstract';

export type ColorMode = 'rainbow' | 'synthwave' | 'phosphor' | 'mono' | 'ember';

export interface AudioFrame {
  volume: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
  frequencyBins: Uint8Array;
  waveform: Uint8Array;
}
