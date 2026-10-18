export type webOSLaunchParams = Record<string, unknown>;

declare global {
  interface Window {
    launchParams?: webOSLaunchParams;
  }

  interface Document {
    addEventListener(
      eventName: 'webOSRelaunch',
      listener: (evt: CustomEvent<webOSLaunchParams>) => void,
      useCapture?: boolean
    ): void;
  }
}
