import { openCount } from '../domain/dataset';
import { app } from './app.svelte';

/** Calls `cb` now and whenever an open count appears or disappears. Returns a stop function. */
export function watchOpenCount(cb: (open: boolean) => void): () => void {
  return $effect.root(() => {
    $effect(() => { cb(openCount(app.ds) !== undefined); });
  });
}
