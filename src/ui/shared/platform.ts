/** True on iOS/iPadOS Safari when the app is not running from the home screen. */
export function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ios && (navigator as any).standalone !== true;
}
