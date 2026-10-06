// Levanta backend (API hexagonal :4000) y frontend (Vite :5173) en paralelo,
// sin dependencias externas. Ctrl+C detiene ambos.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const procs = [
  { name: 'api', color: '\x1b[32m', args: ['run', 'dev', '-w', 'backend'] },
  { name: 'web', color: '\x1b[36m', args: ['run', 'dev', '-w', 'frontend'] },
].map(({ name, color, args }) => {
  const child = spawn(npm, args, { shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) out.write(tag + line + '\n');
      }
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`${tag}terminó con código ${code}\n`);
      shutdown(code ?? 1);
    }
  });
  return child;
});

function shutdown(code = 0) {
  for (const p of procs) if (!p.killed) p.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
