import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import wiro, { polling } from './wiro.mjs';

const KEY = 'wiro-test-key-0123456789';
const SECRET = 'wiro-test-secret-abcdef';
/** A fake Wiro API and CDN on 127.0.0.1: `reply` answers each request; `seen` keeps them. */
let server, base;
let reply = () => [404, {}];
const seen = [];

before(async () => {
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const call = { method: req.method, url: new URL(req.url, 'http://x'), headers: req.headers, body: Buffer.concat(chunks) };
    seen.push(call);
    const [status, body, type = 'application/json'] = await reply(call);
    res.writeHead(status, { 'content-type': type }).end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.OPENFILM_WIRO_URL = base;
  delete process.env.WIRO_API_SECRET;
  polling.ms = { text: 5, image: 5, audio: 5, video: 5 };
});
after(() => server.close());

const ctx = (files = {}, { key = `${KEY}:${SECRET}`, model, signal = new AbortController().signal } = {}) =>
  ({ key, model, root: '/project', signal, say: () => {}, read: async (p) => files[p] });
const json = (call) => JSON.parse(call.body.toString('utf8'));
const form = (call) => new Request('http://x', { method: 'POST', headers: { 'content-type': call.headers['content-type'] }, body: call.body }).formData();
const runs = () => seen.filter((c) => c.url.pathname.startsWith('/v1/Run/'));
const signed = (call) => call.headers['x-signature'] === createHmac('sha256', KEY).update(SECRET + call.headers['x-nonce']).digest('hex');

function png(w, h, alpha = false) {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  /* color type 6: RGB with alpha */
  if (alpha) b[25] = 6;
  return b;
}
/** `seconds` of constant-bitrate MP3 (MPEG-1 Layer III, 44.1 kHz) after an empty ID3v2 tag. */
function mp3(seconds, kbps) {
  const frame = Buffer.from([0xff, 0xfb, ({ 128: 9, 192: 11 })[kbps] << 4, 0x44]);
  return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]), frame, Buffer.alloc(Math.round((seconds * kbps * 1000) / 8) - frame.length, 0x55)]);
}
/** An MP3 as ffmpeg writes one: its first frame an Info header at 64 kbps, giving the count of the 128 kbps frames after it. */
function mp3Info(frames) {
  const first = Buffer.alloc(208);
  first.set([0xff, 0xfb, 0x50, 0x44]);
  first.write('Info', 36, 'latin1');
  first.writeUInt32BE(0x0f, 40);
  first.writeUInt32BE(frames, 44);
  return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]), first, Buffer.alloc(frames * 418, 0x55)]);
}
/** A clip `seconds` long as its movie header says (moov after the media, then mvhd, version 0, time scale 1000). */
function mp4(seconds) {
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0);
  mvhd.write('mvhd', 4, 'latin1');
  mvhd.writeUInt32BE(1000, 20);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 24);
  const moov = Buffer.concat([Buffer.alloc(4), Buffer.from('moov', 'latin1'), mvhd]);
  moov.writeUInt32BE(moov.length, 0);
  return Buffer.concat([Buffer.from([0, 0, 0, 16, ...Buffer.from('ftypisom'), 0, 0, 2, 0]), Buffer.from([0, 0, 0, 8, ...Buffer.from('mdat')]), moov]);
}
const FILES = {
  '/files/out.png': [png(1536, 864), 'image/png'], '/files/out.mp4': [Buffer.from('mp4'), 'video/mp4'], '/files/kling.mp4': [mp4(5.042), 'video/mp4'],
  '/files/out.mp3': [mp3(2, 192), 'audio/mpeg'], '/files/info.mp3': [mp3Info(383), 'audio/mpeg'],
};
/** What the task made, as Task/Detail lists it: each file with the size the CDN serves. */
const outputs = (...paths) => paths.map((p) => ({ name: p.split('/').pop(), contenttype: (FILES[p]?.[1]) ?? 'application/json', size: String(FILES[p]?.[0].length ?? 0), url: `${base}${p}` }));

/** One task: started at /v1/Run/<model>, done after `ready` status asks, its files on the CDN. */
function task(model, made, { ready = 2, extra = {} } = {}) {
  let asks = 0;
  return (call) => {
    if (call.url.pathname === `/v1/Run/${model}`) return [200, { result: true, errors: [], taskid: '101', socketaccesstoken: 'tok101' }];
    if (call.url.pathname === '/v1/Task/Detail') {
      asks += 1;
      return [200, { result: true, errors: [], tasklist: [asks < ready ? { id: '101', status: 'task_start', pexit: '' } : { id: '101', status: 'task_postprocess_end', pexit: '0', outputs: made }] }];
    }
    if (call.url.pathname in extra) return extra[call.url.pathname];
    if (FILES[call.url.pathname]) return [200, FILES[call.url.pathname][0], FILES[call.url.pathname][1]];
    return [404, {}];
  };
}

test('a picture: the run signed with the project\'s secret, asked after until done, its file fetched from the CDN without the key', async () => {
  seen.length = 0;
  reply = task('google/nano-banana-2', outputs('/files/out.png'));
  const result = await wiro.run('image', { out: 'hero', prompt: 'a brass key', ratio: '16:9', quality: 'high' }, ctx());
  const [run] = runs();
  assert.equal(run.headers['x-api-key'], KEY);
  assert.ok(signed(run), 'x-signature is the HMAC of the secret and the nonce, keyed with the key');
  assert.deepEqual(json(run), { prompt: 'a brass key', aspectRatio: '16:9', resolution: '2K' });
  const asked = seen.filter((c) => c.url.pathname === '/v1/Task/Detail');
  assert.equal(asked.length, 2);
  assert.deepEqual(json(asked[0]), { tasktoken: 'tok101' });
  assert.ok(asked.every(signed));
  const fetched = seen.find((c) => c.url.pathname === '/files/out.png');
  assert.equal(fetched.headers['x-api-key'], undefined);
  assert.equal(fetched.headers['x-signature'], undefined);
  assert.equal(result.files[0].path, 'assets/image/hero.png');
  assert.deepEqual([result.index[0].w, result.index[0].h], [1536, 864]);
  assert.equal(result.receipt.notes, undefined);
});

test('a transparent picture: made, then cut out of its background by a second task, as a PNG with an alpha channel', async () => {
  seen.length = 0;
  const cutout = png(1536, 864, true);
  const make = task('google/nano-banana-2', [{ contenttype: 'image/jpeg', size: '33', url: `${base}/files/made.jpg` }],
    { extra: { '/files/made.jpg': [200, png(1536, 864), 'image/jpeg'] } });
  const cut = task('wiro/remove-background', [{ contenttype: 'image/png', size: String(cutout.length), url: `${base}/files/cut.png` }],
    { extra: { '/files/cut.png': [200, cutout, 'image/png'] } });
  reply = (call) => (call.url.pathname === '/v1/Run/wiro/remove-background' || seen.some((c) => c.url.pathname === '/v1/Run/wiro/remove-background') ? cut : make)(call);
  const result = await wiro.run('image', { out: 'logo', prompt: 'a round logo', ratio: '1:1', transparent: true }, ctx());
  const [, second] = runs();
  assert.equal(second.url.pathname, '/v1/Run/wiro/remove-background');
  assert.ok(signed(second));
  const sent = await form(second);
  assert.deepEqual([sent.get('inputImage').name, sent.get('inputImage').type], ['picture.jpg', 'image/jpeg']);
  assert.equal(result.files[0].path, 'assets/image/logo.png');
  assert.equal(result.receipt.images[0].alpha, true);
  assert.equal(result.receipt.notes, undefined);
});

test('the model the person chose, with its own fields: GPT Image 2\'s quality and size, FLUX.2 [pro]\'s pixels and its one quality', async () => {
  seen.length = 0;
  reply = task('openai/gpt-image-2', outputs('/files/out.png'));
  await wiro.run('image', { out: 'x', prompt: 'y', ratio: '2:3' }, ctx({}, { model: 'openai/gpt-image-2' }));
  assert.deepEqual(json(runs()[0]), { prompt: 'y', ratio: '2:3', resolution: '1k', quality: 'low', samples: 1, outputFormat: 'png' });
  seen.length = 0;
  reply = task('black-forest-labs/flux-2-pro', outputs('/files/out.png'));
  const flux = await wiro.run('image', { out: 'x', prompt: 'y', ratio: '1:1', quality: 'high' }, ctx({}, { model: 'black-forest-labs/flux-2-pro' }));
  assert.deepEqual(json(runs()[0]), { prompt: 'y', width: 1024, height: 1024, outputFormat: 'png' });
  assert.deepEqual(flux.receipt.notes, ['--quality high: FLUX.2 [pro] has one quality']);
});

test('a project with API key only: the key alone, unsigned; one with signature-based authentication is told to add its secret', async () => {
  seen.length = 0;
  reply = task('google/nano-banana-2', outputs('/files/out.png'));
  await wiro.run('image', { out: 'x', prompt: 'y' }, ctx({}, { key: KEY }));
  assert.equal(runs()[0].headers['x-api-key'], KEY);
  assert.equal(runs()[0].headers['x-signature'], undefined);
  assert.equal(runs()[0].headers['x-nonce'], undefined);

  reply = () => [401, { result: false, errors: [{ code: 0, message: 'Project requires signature authentication. x-signature and x-nonce headers are required.' }] }];
  await assert.rejects(wiro.run('image', { out: 'x', prompt: 'y' }, ctx({}, { key: KEY })), /signature-based authentication, so it needs its API secret as well as its key/);
  /* with a secret that is not the project's: refused, and neither half shown */
  reply = () => [401, { result: false, errors: [{ code: 0, message: `Project authorization is not valid. (${KEY})` }] }];
  await assert.rejects(wiro.run('image', { out: 'x', prompt: 'y' }, ctx()), (e) => {
    assert.match(e.message, /^Wiro did not accept your key \(401: Project authorization is not valid\. \(•••\)\)/);
    assert.ok(!e.message.includes(KEY) && !e.message.includes(SECRET));
    return true;
  });
});

test('a key is the project\'s key alone, or key:secret; half of a pair is refused where it is pasted', () => {
  wiro.checkKey(KEY);
  wiro.checkKey(`${KEY}:${SECRET}`);
  assert.throws(() => wiro.checkKey(`${KEY}:`), /<api key>:<api secret>/);
  assert.throws(() => wiro.checkKey(`:${SECRET}`), /<api key>:<api secret>/);
});

test('a video from a first and last frame: the pictures as files in the same request, a length Veo makes, the first frame\'s shape', async () => {
  seen.length = 0;
  reply = task('google/veo3-1-fast', outputs('/files/out.mp4'));
  const files = { 'assets/image/a.png': new Uint8Array(png(16, 9)), 'assets/image/b.png': new Uint8Array(png(16, 9)) };
  const result = await wiro.run('video', { out: 'shot', prompt: 'morph', duration: 5, 'first-frame': 'assets/image/a.png', 'last-frame': 'assets/image/b.png' }, ctx(files));
  const [run] = runs();
  assert.ok(signed(run));
  assert.match(run.headers['content-type'], /^multipart\/form-data/);
  const sent = await form(run);
  assert.deepEqual(['prompt', 'durationSeconds', 'aspectRatio', 'resolution'].map((k) => sent.get(k)), ['morph', '6', 'match_input_image', '720p']);
  assert.equal(sent.get('inputImage').name, 'a.png');
  assert.equal(sent.get('inputImage').type, 'image/png');
  assert.equal(sent.get('inputImage2').name, 'b.png');
  assert.equal(result.files[0].path, 'assets/video/shot.mp4');
  assert.deepEqual([result.index[0].dur, result.index[0].hasAudio], [6, true]);
  assert.deepEqual(result.receipt.notes, ['Veo 3.1 Fast makes 4, 6 or 8 second clips: 6 s']);
  assert.equal(result.receipt.resolution, '720p');
  /* Veo makes 1080p at 8 s only: an 8 s clip is asked for at 1080p */
  seen.length = 0;
  const long = await wiro.run('video', { out: 'shot', prompt: 'y', duration: 8, 'aspect-ratio': '9:16' }, ctx());
  assert.deepEqual(json(runs()[0]), { prompt: 'y', durationSeconds: '8', aspectRatio: '9:16', resolution: '1080p' });
  assert.equal(long.receipt.resolution, '1080p');
});

test('Kling 3.0: the length it makes, read from the clip; no reference pictures; no sound when it ends on a last frame; the shape asked only from a prompt', async () => {
  seen.length = 0;
  reply = task('klingai/kling-v3', outputs('/files/kling.mp4'));
  const files = { 'assets/image/a.png': new Uint8Array(png(9, 16)), 'assets/image/b.png': new Uint8Array(png(9, 16)) };
  const ended = await wiro.run('video', { out: 'shot', prompt: 'walk', duration: 7, 'aspect-ratio': '9:16', 'first-frame': 'assets/image/a.png', 'last-frame': 'assets/image/b.png' },
    ctx(files, { model: 'klingai/kling-v3' }));
  const sent = await form(runs()[0]);
  assert.deepEqual(['duration', 'mode', 'sound'].map((k) => sent.get(k)), ['5', 'pro', 'off']);
  assert.deepEqual([ended.index[0].dur, ended.receipt.dur, ended.index[0].from.sec, ended.index[0].hasAudio], [5.042, 5.042, 5, false]);
  assert.deepEqual(ended.receipt.notes, ['Kling 3.0 makes 5, 10 or 15 second clips: 5 s', 'Kling 3.0 makes a clip from a first frame in the picture\'s shape: --aspect-ratio does not apply']);

  seen.length = 0;
  const prompted = await wiro.run('video', { out: 'shot', prompt: 'walk', duration: 10, 'aspect-ratio': '4:3', 'input-reference': ['assets/image/a.png'] }, ctx(files, { model: 'klingai/kling-v3' }));
  assert.deepEqual(json(runs()[0]), { prompt: 'walk', duration: '10', ratio: '1:1', mode: 'pro', sound: 'on' });
  assert.equal(prompted.index[0].hasAudio, true);
  assert.deepEqual(prompted.receipt.notes, ['Kling 3.0 takes no reference pictures: they were left out', 'Kling 3.0 makes 16:9, 9:16, 1:1 clips: 1:1']);
});

test('Seedance 2.0: up to 9 reference pictures, each a file under its field; the nearest shape and length it makes', async () => {
  seen.length = 0;
  reply = task('bytedance/seedance-2-0', outputs('/files/out.mp4'));
  const refs = Array.from({ length: 10 }, (_, i) => `assets/image/r${i}.png`);
  const files = Object.fromEntries(refs.map((r) => [r, new Uint8Array(png(16, 9))]));
  const result = await wiro.run('video', { out: 'shot', prompt: 'a [Image 1] on a shelf', duration: 20, 'aspect-ratio': '2:3', 'input-reference': refs },
    ctx(files, { model: 'bytedance/seedance-2-0' }));
  const sent = await form(runs()[0]);
  assert.deepEqual(sent.getAll('inputImageReference').map((f) => f.name), refs.slice(0, 9).map((r) => r.split('/').pop()));
  assert.deepEqual(['duration', 'ratio', 'resolution', 'generateAudio'].map((k) => sent.get(k)), ['15', '9:16', '1080p', 'true']);
  assert.deepEqual(result.index[0].from.refs, refs.slice(0, 9));
  assert.deepEqual(result.receipt.notes, ['Seedance 2.0 takes 9 reference pictures: the rest were left out', 'Seedance 2.0 makes 4 to 15 second clips: 15 s', 'Seedance 2.0 makes 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 clips: 9:16']);
  /* adaptive, asked for: the model chooses */
  seen.length = 0;
  await wiro.run('video', { out: 'shot', prompt: 'y', duration: 4, 'aspect-ratio': 'adaptive' }, ctx({}, { model: 'bytedance/seedance-2-0' }));
  assert.equal(json(runs()[0]).ratio, 'adaptive');
});

test('music: ElevenLabs Music v2 at the nearest length it has; Lyria chooses its length; Stable Audio in whole seconds; each measured from its MP3\'s frames', async () => {
  seen.length = 0;
  reply = task('elevenlabs/text-to-music-v2', outputs('/files/out.mp3'));
  const result = await wiro.run('music', { out: 'theme', prompt: 'warm synth pad', sec: 47 }, ctx());
  assert.deepEqual(json(runs()[0]), { prompt: 'warm synth pad', duration: '45', outputFormat: 'mp3_44100_128', instrumental: 'false' });
  assert.equal(result.files[0].path, 'assets/audio/music/theme.mp3');
  /* 2 s of 192 kbps: its size alone at 128 kbps would say 3 s */
  assert.deepEqual(result.index[0], { src: 'assets/audio/music/theme.mp3', kind: 'audio', dur: 2, from: { mode: 'generate', prompt: 'warm synth pad', sec: 47, provider: 'wiro', model: 'elevenlabs/text-to-music-v2' } });
  assert.deepEqual(result.receipt.notes, ['ElevenLabs Music makes set lengths from 10 to 300 s: 45 s']);
  /* no length asked: one a film can use */
  seen.length = 0;
  await wiro.run('music', { out: 'theme', prompt: 'x' }, ctx());
  assert.equal(json(runs()[0]).duration, '60');

  seen.length = 0;
  reply = task('google/lyria-3-pro', outputs('/files/out.mp3'));
  const lyria = await wiro.run('music', { out: 'bed', prompt: 'lofi', sec: 12 }, ctx({}, { model: 'google/lyria-3-pro' }));
  assert.deepEqual(json(runs()[0]), { prompt: 'lofi' });
  assert.deepEqual(lyria.receipt.notes, ['Lyria 3 Pro chooses the length of what it makes']);

  seen.length = 0;
  reply = task('stabilityai/stable-audio-3-medium', outputs('/files/info.mp3'));
  const stable = await wiro.run('music', { out: 'bed', prompt: 'pad', sec: 10.4 }, ctx({}, { model: 'stabilityai/stable-audio-3-medium' }));
  assert.deepEqual(json(runs()[0]), { prompt: 'pad', duration: 10, scale: 1 });
  /* 383 frames of 1152 samples at 44.1 kHz, as its Info header says: by its size at the first frame's 64 kbps, 20 s */
  assert.equal(stable.index[0].dur, 10.005);
});

test('a sound effect: Stable Audio 3 Small SFX, 5 s when no length is asked, never under 1 s', async () => {
  seen.length = 0;
  reply = task('stabilityai/stable-audio-3-small-sfx', outputs('/files/out.mp3'));
  const result = await wiro.run('sfx', { out: 'whoosh', prompt: 'a fast whoosh' }, ctx());
  assert.deepEqual(json(runs()[0]), { prompt: 'a fast whoosh', duration: 5, scale: 1 });
  assert.equal(result.files[0].path, 'assets/audio/sfx/whoosh.mp3');
  assert.equal(result.receipt.notes, undefined);
  seen.length = 0;
  const short = await wiro.run('sfx', { out: 'tick', prompt: 'a tick', sec: 0.5 }, ctx());
  assert.equal(json(runs()[0]).duration, 1);
  assert.deepEqual(short.receipt.notes, ['Stable Audio 3 Small SFX makes 1 to 600 s: 1 s']);
});

test('voice-over: Eleven v4 with the time of each word from the file beside the audio; Gemini\'s without; a voice the model lacks is refused before anything is sent', async () => {
  seen.length = 0;
  const audio = mp3(1, 128);
  const times = Buffer.from(JSON.stringify({ words: [{ text: 'Hello', start: 0, end: 0.4 }, { text: 'there.', start: 0.45, end: 1.2 }], alignment: { characters: [] } }));
  reply = task('elevenlabs/eleven-v4', [
    { name: '101_timestamps.json', contenttype: 'application/json', size: String(times.length), url: `${base}/files/times.json` },
    { name: '101_output.mp3', contenttype: 'audio/mpeg', size: String(audio.length), url: `${base}/files/line.mp3` },
  ], { extra: { '/files/times.json': [200, times], '/files/line.mp3': [200, audio, 'audio/mpeg'] } });
  const result = await wiro.run('tts', { out: 'line', text: 'Hello there.', voice: 'Alice' }, ctx());
  assert.deepEqual(json(runs()[0]), { prompt: 'Hello there.', voice: 'alice', outputFormat: 'mp3_44100_128', languageCode: 'auto', timestamps: 'true' });
  assert.equal(result.files[0].path, 'assets/audio/vo/line.mp3');
  assert.deepEqual(result.index[0].words, [{ token: 'Hello', start: 0, end: 0.4 }, { token: 'there.', start: 0.45, end: 1 }]);
  assert.deepEqual([result.index[0].dur, result.receipt.words], [1, 2]);

  seen.length = 0;
  await assert.rejects(wiro.run('tts', { out: 'line', text: 'Hi.', voice: 'kore' }, ctx()), /Eleven v4 on Wiro has no voice "kore"/);
  assert.equal(seen.length, 0);

  reply = task('google/gemini-3-1-tts', [{ name: '102_output.mp3', contenttype: 'audio/mpeg', size: String(audio.length), url: `${base}/files/line.mp3` }],
    { extra: { '/files/line.mp3': [200, audio, 'audio/mpeg'] } });
  const gemini = await wiro.run('tts', { out: 'line', text: 'Hi.', voice: 'kore' }, ctx({}, { model: 'google/gemini-3-1-tts' }));
  assert.deepEqual(json(runs()[0]), { prompt: 'Hi.', voice: 'kore' });
  assert.equal(gemini.index[0].words, undefined);
  assert.match(gemini.receipt.notes[0], /no word timings/);
});

test('voices: the chosen model\'s, by gender; Gemini\'s that the prompt describes come first; what does not narrow them is said', async () => {
  const eleven = await wiro.run('voice', { gender: 'f', limit: 3, language: 'es' }, ctx());
  assert.deepEqual(eleven.receipt.voices.map((v) => v.voiceId), ['alice', 'bella', 'jessica']);
  assert.deepEqual(eleven.receipt.voices[0], { voiceId: 'alice', name: 'Alice', language: null, gender: 'f', description: null });
  assert.equal(eleven.receipt.notes.length, 1);
  const gemini = await wiro.run('voice', { prompt: 'a warm narrator', limit: 2 }, ctx({}, { model: 'google/gemini-3-1-tts' }));
  assert.deepEqual(gemini.receipt.voices.map((v) => [v.voiceId, v.description]), [['sulafat', 'Warm'], ['achernar', 'Soft']]);
  assert.equal(gemini.receipt.notes, undefined);
});

test('no balance left is said like every provider\'s; too many tasks at once is said without the amount; a failed task says why', async () => {
  reply = () => [200, { result: false, errors: [{ code: 97, message: 'Insufficient balance' }] }];
  await assert.rejects(wiro.run('image', { out: 'x', prompt: 'y' }, ctx()), (e) => e.code === 'balance');
  reply = () => [200, { result: false, errors: [{ code: 96, message: 'You have reached your concurrent task limit. With your current balance of $1.23, you can run up to 2 tasks at the same time. Add funds to increase your limit.' }] }];
  await assert.rejects(wiro.run('image', { out: 'x', prompt: 'y' }, ctx()), (e) => /as many tasks at once as the account's balance allows/.test(e.message) && !e.message.includes('1.23'));
  reply = () => [200, { result: false, errors: [{ code: 0, message: 'Request parameter [prompt] required' }] }];
  await assert.rejects(wiro.run('image', { out: 'x', prompt: 'y' }, ctx()), /^Error: Wiro could not do it: Request parameter \[prompt\] required$/);
  reply = (call) => call.url.pathname === '/v1/Task/Detail'
    ? [200, { result: true, tasklist: [{ id: '101', status: 'task_postprocess_end', pexit: '1', debugerror: 'Request started.\nThe prompt was blocked by the provider\'s safety filter.\n', outputs: [] }] }]
    : [200, { result: true, taskid: '101', socketaccesstoken: 'tok101' }];
  await assert.rejects(wiro.run('image', { out: 'x', prompt: 'y' }, ctx()), /Wiro could not make it: Request started\. The prompt was blocked by the provider's safety filter\./);
  /* a partner model says why on its output, after its progress */
  reply = (call) => call.url.pathname === '/v1/Task/Detail'
    ? [200, { result: true, tasklist: [{ status: 'task_postprocess_end', pexit: '1', debugerror: '', outputs: [],
      debugoutput: 'Request started.\nstatus: running\nstatus: failed\nThe generated content was blocked by the content safety system. Please try a different prompt or image.\n' }] }]
    : [200, { result: true, taskid: '101', socketaccesstoken: 'tok101' }];
  await assert.rejects(wiro.run('video', { out: 'x', prompt: 'y' }, ctx({}, { model: 'bytedance/seedance-2-0' })),
    /^Error: Wiro could not make it: The generated content was blocked by the content safety system\. Please try a different prompt or image\.$/);
});

test('a cancelled run stops its task on Wiro: cancelled if it waits, killed if it runs', async () => {
  seen.length = 0;
  reply = task('google/veo3-1-fast', [], { ready: Infinity, extra: { '/v1/Task/Cancel': [200, { result: true }], '/v1/Task/Kill': [200, { result: true }] } });
  const stop = new AbortController();
  const run = wiro.run('video', { out: 'x', prompt: 'y' }, ctx({}, { signal: stop.signal }));
  await new Promise((done) => setTimeout(done, 30));
  stop.abort();
  await assert.rejects(run);
  await new Promise((done) => setTimeout(done, 50));
  const cancel = seen.find((c) => c.url.pathname === '/v1/Task/Cancel');
  const kill = seen.find((c) => c.url.pathname === '/v1/Task/Kill');
  assert.deepEqual(json(cancel), { taskid: '101' });
  assert.deepEqual(json(kill), { socketaccesstoken: 'tok101' });
  assert.ok(signed(cancel) && signed(kill));
});

test('a status that could not be read is asked again, and a file that comes short of its listed size is fetched again', async () => {
  seen.length = 0;
  const full = png(1536, 864);
  let asks = 0, downloads = 0;
  reply = (call) => {
    if (call.url.pathname === '/v1/Run/google/nano-banana-2') return [200, { result: true, taskid: '101', socketaccesstoken: 'tok101' }];
    if (call.url.pathname === '/v1/Task/Detail') {
      asks += 1;
      return asks === 1 ? [502, 'Bad Gateway', 'text/plain'] : [200, { result: true, tasklist: [{ status: 'task_postprocess_end', pexit: '0', outputs: [{ contenttype: 'image/png', size: String(full.length), url: `${base}/files/cut.png` }] }] }];
    }
    if (call.url.pathname === '/files/cut.png') { downloads += 1; return [200, downloads === 1 ? full.subarray(0, 20) : full, 'image/png']; }
    return [404, {}];
  };
  const result = await wiro.run('image', { out: 'x', prompt: 'y' }, ctx());
  assert.deepEqual([asks, downloads], [2, 2]);
  assert.equal(result.files[0].bytes.length, full.length);
});

test('a transcript from Parakeet: the recording sent as MP3, each word with its time from its JSON, the length read from the MP3', async () => {
  seen.length = 0;
  const times = Buffer.from(JSON.stringify({ text: 'Open Film cuts.', timestamp: { word: [{ word: 'Open', start: 0, end: 0.4 }, { word: 'Film', start: 0.4, end: 0.72 }, { word: 'cuts.', start: 0.88, end: 1.2 }] } }));
  reply = task('nvidia/parakeet-tdt-0-6b-v3', [
    { name: '0.txt', contenttype: 'text/plain', size: '15', url: `${base}/files/0.txt` },
    { name: '0.json', contenttype: 'application/json', size: String(times.length), url: `${base}/files/0.json` },
  ], { extra: { '/files/0.txt': [200, Buffer.from('Open Film cuts.'), 'text/plain'], '/files/0.json': [200, times] } });
  const speech = new Uint8Array(mp3(2, 128));
  const result = await wiro.run('asr', { src: 'assets/talk.mp4' }, ctx({ 'assets/talk.mp4': speech }));
  const sent = await form(runs()[0]);
  assert.equal(sent.get('timestamps'), 'true');
  assert.deepEqual([sent.get('inputAudio').name, sent.get('inputAudio').type], ['talk.mp3', 'audio/mpeg']);
  assert.deepEqual(result.index, [{ src: 'assets/talk.mp4', text: 'Open Film cuts.', dur: 2, transcribed: true,
    words: [{ token: 'Open', start: 0, end: 0.4 }, { token: 'Film', start: 0.4, end: 0.72 }, { token: 'cuts.', start: 0.88, end: 1.2 }] }]);
  assert.deepEqual([result.receipt.words, result.receipt.notes], [3, undefined]);
  assert.equal(wiro.speechFormat, 'mp3');
});

test('a transcript from ElevenLabs Scribe: its text alone, for Studio to spread over the recording', async () => {
  seen.length = 0;
  reply = task('elevenlabs/speech-to-text', [{ name: '1_output.txt', contenttype: 'text/plain', size: '9', url: `${base}/files/1.txt` }],
    { extra: { '/files/1.txt': [200, Buffer.from('Merhaba.\n'), 'text/plain'] } });
  const result = await wiro.run('asr', { src: 'assets/talk.mp3' }, ctx({ 'assets/talk.mp3': new Uint8Array(mp3(1, 128)) }, { model: 'elevenlabs/speech-to-text' }));
  const sent = await form(runs()[0]);
  assert.equal(sent.get('inputAudioUrl'), '');
  assert.deepEqual(result.index, [{ src: 'assets/talk.mp3', text: 'Merhaba.', dur: 1, transcribed: true }]);
  assert.match(result.receipt.notes[0], /no word timings/);
  /* nothing heard is said, not landed empty */
  reply = task('elevenlabs/speech-to-text', []);
  await assert.rejects(wiro.run('asr', { src: 'assets/talk.mp3' }, ctx({ 'assets/talk.mp3': new Uint8Array(mp3(1, 128)) }, { model: 'elevenlabs/speech-to-text' })), /without a transcript/);
});

test('subtitle translation: every line in one request, the answer held to the lines\' JSON shape, one line back for each', async () => {
  seen.length = 0;
  const answer = (lines) => [{ contenttype: 'raw', content: { raw: JSON.stringify({ lines }) } }];
  reply = task('openai/gpt-6-luna', answer(['Merhaba.', 'Nasılsın?']));
  const result = await wiro.run('translate', { lines: ['Hello.', { text: 'How are you?' }], language: 'tr' }, ctx());
  const sent = json(runs()[0]);
  assert.deepEqual(JSON.parse(sent.prompt), { language: 'tr', lines: ['Hello.', 'How are you?'] });
  assert.match(sent.systemInstructions, /exactly 2 strings/);
  assert.equal(sent.response_format.type, 'json_schema');
  assert.deepEqual(result.receipt.lines, ['Merhaba.', 'Nasılsın?']);
  reply = task('openai/gpt-6-luna', answer(['Merhaba.']));
  await assert.rejects(wiro.run('translate', { lines: ['Hello.', 'Bye.'], language: 'tr' }, ctx()), /came back with 1 lines for 2/);
});
