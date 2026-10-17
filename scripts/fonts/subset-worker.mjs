/**
 * Subset worker (harfbuzz runs inside wasm and blocks its thread, so the
 * build fans the ~160 slices per weight across a few of these).
 */
import { readFileSync } from 'node:fs';
import { parentPort } from 'node:worker_threads';
import subsetFont from 'subset-font';

const sources = new Map();

parentPort.on('message', async ({ index, file, text, options }) => {
  try {
    if (!sources.has(file)) sources.set(file, readFileSync(file));
    const buffer = await subsetFont(sources.get(file), text, options);
    parentPort.postMessage({ index, buffer });
  } catch (error) {
    parentPort.postMessage({ index, error: String(error?.message ?? error) });
  }
});
