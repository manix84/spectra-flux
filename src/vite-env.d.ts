/// <reference types="vite/client" />

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

type WakeLockType = 'screen';

interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: WakeLockType;
  release: () => Promise<void>;
}

interface WakeLock {
  request: (type: WakeLockType) => Promise<WakeLockSentinel>;
}

interface Navigator {
  readonly wakeLock: WakeLock;
}
