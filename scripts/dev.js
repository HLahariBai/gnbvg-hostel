/**
 * Unified Development Runner for GNBVG Hostel System
 * Starts both backend API server and frontend client concurrently.
 */

import { spawn } from 'child_process';

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[32m%s\x1b[0m', '   GNBVG HOSTEL MANAGEMENT SYSTEM - GPREC KURNOOL   ');
console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('Starting Backend API & Frontend Client concurrently...\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// 1. Start Server
const serverProc = spawn(npmCmd, ['run', 'dev', '--workspace=server'], {
  stdio: 'inherit',
  shell: true,
});

// 2. Start Client
const clientProc = spawn(npmCmd, ['run', 'dev', '--workspace=client'], {
  stdio: 'inherit',
  shell: true,
});

function handleExit(signal) {
  console.log(`\nStopping GNBVG servers (${signal})...`);
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

serverProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend server exited with code ${code}`);
  }
});

clientProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend client exited with code ${code}`);
  }
});
