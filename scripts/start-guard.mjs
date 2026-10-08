/**
 * Start guard for the built server (npm start). The @astrojs/node entry
 * treats an occupied port as a per-request unhandled rejection and keeps
 * serving half-bound, which surfaces as "the page sometimes works" instead
 * of an error. Probe BOTH address families up front — the recurring trap is
 * one stack held by a leftover `astro dev` (::1) while the other looks
 * free — and refuse to start with a plain-language reason. An explicit
 * HOST narrows the probe to that stack, mirroring the entry's own binding;
 * PORT is honored the same way the entry honors it. Zero dependencies:
 * the real server command chains after this exits 0 (package.json).
 */
import net from 'node:net';

const port = Number(process.env.PORT ?? '') || 4321;
const host = process.env.HOST ?? '';
const stacks = host !== '' ? [host] : ['127.0.0.1', '::1'];

/** True when something answers on this stack. Loopback either connects or
 *  refuses instantly; a timeout is treated as occupied (conservative —
 *  refuse to start rather than risk the silent half-bound state). */
const occupied = (stack) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: stack });
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });

const taken = [];
for (const stack of stacks) {
  if (await occupied(stack)) taken.push(stack);
}

if (taken.length > 0) {
  console.error(`[start-guard] 端口 ${port} 已被占用（${taken.join(' / ')}），拒绝启动。`);
  console.error(
    '  多半是另一个 front-station 实例还在跑——astro dev 固定在 4399，不应占用 ' + port + '。',
  );
  console.error(`  先停掉占用进程再 npm start：netstat -ano | grep ${port}`);
  process.exit(1);
}

console.log(`[start-guard] 端口 ${port} 空闲，启动服务。`);
