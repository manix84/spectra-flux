/// <reference types="vite/client" />

interface Window {
  readonly launchQueue: LaunchQueue;
  webkitAudioContext?: typeof AudioContext;
}

interface LaunchParams {
  readonly files: FileSystemFileHandle[];
  readonly targetURL: string;
}

interface LaunchQueue {
  setConsumer: (consumer: (launchParams: LaunchParams) => void) => void;
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
