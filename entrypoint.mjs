// PID-1 signal supervisor. As PID 1 the kernel ignores signals with a
// default disposition, so a bare `node dist/server/entry.mjs` never sees
// SIGTERM: `docker stop` waits out its whole grace period and SIGKILLs the
// server mid-request. A Node PID 1 with registered handlers works normally,
// so this wrapper forwards stop signals to the server child and exits with
// it — a deploy stops in about a second, and the wrapper stays the only
// parent (nothing is left to reap).
import { spawn } from 'node:child_process';

const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
  stdio: 'inherit',
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.kill(signal));
}

server.on('exit', (code, signal) => {
  process.exit(signal ? 143 : (code ?? 0));
});

server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
