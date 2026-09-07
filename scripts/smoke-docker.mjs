import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const image = process.argv[2] || 'luminate-smoke';
const name = `luminate-smoke-${process.pid}`;
const volume = `${name}-data`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const base = 'http://127.0.0.1:3100';
async function json(url, options) {
  const response = await fetch(base + url, options);
  assert.ok(response.ok, `${url}: HTTP ${response.status} ${await response.clone().text()}`);
  return response.json();
}
async function start() {
  docker('run', '-d', '--name', name, '-p', '127.0.0.1:3100:3000', '-v', `${volume}:/data`, image);
  for (let i = 0; i < 60; i++) {
    try { await json('/api/health'); return; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error('Container failed to become healthy');
}
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
try {
  assert.match(docker('run', '--rm', image, 'node', 'scripts/migrate-db.mjs'), /Database migrations applied/);
  docker('volume', 'create', volume);
  await start();
  assert.match(docker('exec', name, 'ffmpeg', '-version'), /ffmpeg version/);
  assert.equal(docker('exec', name, 'id', '-u'), '1000');
  await json('/api/init');
  await json('/api/ready');
  const project = await json('/api/projects', post({ name: 'Persistence smoke test' }));
  assert.ok(project.id);
  const audio = Buffer.from('persistent-audio-test-bytes');
  const recording = await json(`/api/projects/${project.id}/recordings`, post({ duration: 1, slideIndex: 0, audioData: audio.toString('base64') }));
  assert.ok(recording.audioPath);
  docker('exec', name, 'node', '-e', "require('fs').mkdirSync('/data/media/exports/smoke',{recursive:true})");
  docker('exec', name, 'ffmpeg', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '/data/media/exports/smoke/final.mp4');
  docker('rm', '-f', name);
  await start();
  await json('/api/ready');
  assert.equal((await json(`/api/projects/${project.id}`)).name, 'Persistence smoke test');
  const saved = await fetch(base + recording.audioPath);
  assert.ok(saved.ok);
  assert.deepEqual(Buffer.from(await saved.arrayBuffer()), audio);
  const range = await fetch(base + recording.audioPath, { headers: { Range: 'bytes=0-3' } });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), 'pers');
  const video = await fetch(base + '/exports/smoke/final.mp4');
  assert.equal(video.headers.get('content-type'), 'video/mp4');
  assert.ok((await video.arrayBuffer()).byteLength > 0);
  console.log('Docker smoke passed: non-root, native SQLite, FFmpeg, persistence and media ranges.');
} catch (error) {
  try { console.error(docker('logs', name)); } catch {}
  throw error;
} finally {
  try { docker('rm', '-f', name); } catch {}
  try { docker('volume', 'rm', volume); } catch {}
}
