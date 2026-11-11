/** True on iOS/iPadOS Safari when the app is not running from the home screen. */
export function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && (navigator as Navigator & { standalone?: boolean }).standalone !== true;
}
