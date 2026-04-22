import { spawn } from 'child_process';

const server = spawn('node', ['server.mjs'], { stdio: 'inherit', shell: true });
const client = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  server.kill();
  client.kill();
  process.exit();
});

server.on('exit', (code) => {
  if (code !== 0) console.error(`Backend exited with code ${code}`);
});

client.on('exit', (code) => {
  if (code !== 0) console.error(`Frontend exited with code ${code}`);
});
