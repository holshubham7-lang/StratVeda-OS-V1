const { spawn } = require('node:child_process');

const nodeOptions = [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' ');
const cliPath = require.resolve('@nestjs/cli/bin/nest.js');
const child = spawn(process.execPath, [cliPath, 'start', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error('Could not start the Nest API:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
