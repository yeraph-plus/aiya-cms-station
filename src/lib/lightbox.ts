import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';

import { Counter, Zoom } from 'yet-another-react-lightbox/plugins';

/**
 * The shared presentation of the two content lightboxes (the article body
 * gallery and the community image grid): immersive scrim, zoom always, the
 * slide counter once there is more than one slide, backdrop click closes.
 * Call sites spread this over their own open/index/slides/close — the
 * configs used to be twin literals that had already drifted in plugin order.
 */
export const lightboxChrome = {
  animation: { zoom: 300 },
  controller: { closeOnBackdropClick: true },
  carousel: { padding: '4%' },
  styles: { container: { backgroundColor: 'var(--scrim-immersive)' } },
} as const;

/** Zoom is always useful; the counter earns its place only with 2+ slides. */
export const lightboxPlugins = (count: number) => (count > 1 ? [Zoom, Counter] : [Zoom]);
