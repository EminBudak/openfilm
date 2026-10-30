// @ts-check
/**
 * Wiro with the person's own key: pictures (cut out of their background for --transparent), video, music, sound effects,
 * voice-over (Eleven v4's timed word by word), transcription and subtitle translation, each made by a model from Wiro's
 * catalog (https://wiro.ai/models). REST API (https://wiro.ai/docs): a model runs as a
 * task, started with POST /v1/Run/<owner>/<model> and asked after with POST /v1/Task/Detail until it is done; what it
 * made is files on Wiro's CDN, downloaded here without the key. Wiro answers most failures with a 200 whose body says
 * `result: false`, so every answer is read.
 *
 * A key belongs to a Wiro project and goes in `x-api-key`. A project with signature-based authentication (Wiro's default)
 * also signs each request with its API secret: `x-nonce`, and `x-signature`, the HMAC-SHA256 of the secret and the nonce
 * keyed with the API key. Its key is pasted as `<api key>:<api secret>`, or set as WIRO_API_KEY with the secret in
 * WIRO_API_SECRET; a project with API key only takes the key alone. Pictures a model is given (first and last frames,
 * references) go in the same request, as multipart files.
 */
import { createHmac } from 'node:crypto';
import { basename } from 'node:path';
import { RATIO_SIZE, billedBy, clamp, download, extOf, landing, list, madePicture, mimeOf, modelOf, mp3Seconds, needed, noBalance, notes, number, round, serviceUrl, sleep, speechUpload, text, translatedLines, translationAsk, wavSeconds, wordsFromCharacters } from './common.mjs';

/** @typedef {import('./contract.mjs').Provider} Provider @typedef {import('./contract.mjs').RunContext} RunContext */
/**
 * What a task made, as Task/Detail lists it: a file, or (`contenttype: 'raw'`) a language model's answer in `content`.
 * @typedef {{ name?: string, contenttype?: string, size?: string, url?: string, content?: { raw?: unknown } }} Output
 */

const NAME = 'Wiro';
const BILLING_URL = 'https://wiro.ai/panel/billing';
/** the models it makes each kind of media with, the default first (each model's page is wiro.ai/models/<id>) */
const MODELS = {
  image: [
    { id: 'google/nano-banana-2', name: 'Nano Banana 2' },
    { id: 'google/nano-banana-pro', name: 'Nano Banana Pro' },
    { id: 'openai/gpt-image-2', name: 'GPT Image 2' },
    { id: 'black-forest-labs/flux-2-pro', name: 'FLUX.2 [pro]' },
  ],
  video: [
    { id: 'google/veo3-1-fast', name: 'Veo 3.1 Fast' },
    { id: 'google/veo3-1', name: 'Veo 3.1' },
    { id: 'klingai/kling-v3', name: 'Kling 3.0' },
    { id: 'bytedance/seedance-2-0', name: 'Seedance 2.0' },
  ],
  music: [
    { id: 'elevenlabs/text-to-music-v2', name: 'ElevenLabs Music v2' },
    { id: 'google/lyria-3-pro', name: 'Lyria 3 Pro' },
    { id: 'stabilityai/stable-audio-3-medium', name: 'Stable Audio 3 Medium' },
  ],
  sfx: [{ id: 'stabilityai/stable-audio-3-small-sfx', name: 'Stable Audio 3 Small SFX' }],
  tts: [
    { id: 'elevenlabs/eleven-v4', name: 'Eleven v4' },
    { id: 'elevenlabs/eleven-v4-turbo', name: 'Eleven v4 Turbo' },
    { id: 'google/gemini-3-1-tts', name: 'Gemini 3.1 Flash TTS' },
  ],
  asr: [{ id: 'nvidia/parakeet-tdt-0-6b-v3', name: 'Parakeet TDT 0.6B v3' }, { id: 'elevenlabs/speech-to-text', name: 'ElevenLabs Scribe' }],
  translate: [{ id: 'openai/gpt-6-luna', name: 'GPT-6 Luna' }, { id: 'openai/gpt-6-1-sol', name: 'GPT-6.1 Sol' }],
};
/** The model that cuts a picture out of its background, for --transparent: a PNG with an alpha channel. */
const CUTOUT = 'wiro/remove-background';

/**
 * Each picture model's input for a prompt, a ratio and the quality asked. `high`: a larger picture where the model has
 * sizes (`sizes`), else the one it makes.
 * @type {Record<string, { name: string, sizes: boolean, input: (prompt: string, ratio: string, high: boolean) => Record<string, unknown> }>}
 */
const IMAGE = {
  'google/nano-banana-2': { name: 'Nano Banana 2', sizes: true, input: (prompt, ratio, high) => ({ prompt, aspectRatio: ratio, resolution: high ? '2K' : '1K' }) },
  'google/nano-banana-pro': { name: 'Nano Banana Pro', sizes: true, input: (prompt, ratio, high) => ({ prompt, aspectRatio: ratio, resolution: high ? '2K' : '1K' }) },
  'openai/gpt-image-2': {
    name: 'GPT Image 2', sizes: true,
    input: (prompt, ratio, high) => ({ prompt, ratio, resolution: high ? '2k' : '1k', quality: high ? 'high' : 'low', samples: 1, outputFormat: 'png' }),
  },
  'black-forest-labs/flux-2-pro': { name: 'FLUX.2 [pro]', sizes: false, input: (prompt, ratio) => ({ prompt, ...RATIO_SIZE[ratio], outputFormat: 'png' }) },
};

/**
 * Each video model's lengths and shapes, and its fields: the length's and the shape's, where the first and last frames
 * and the reference pictures go (`refs`: how many it takes; `seconds`: the length it makes with them), the resolution
 * of a clip that long, and what else it is asked for. `fromPicture`: the shape that follows the first frame.
 * `lastSilent`: a clip ending on a last frame has no sound.
 * @type {Record<string, { name: string, seconds: number[], length: string, ratios: string[], ratio: string, fromPicture: string | null,
 *   adaptive: boolean, first: string, last: string, refs: { field: string, max: number, seconds?: number } | null,
 *   resolution: (seconds: number) => string, input: (resolution: string) => Record<string, string>, lastSilent?: boolean }>}
 */
const VIDEO = {
  'google/veo3-1-fast': {
    name: 'Veo 3.1 Fast', seconds: [4, 6, 8], length: 'durationSeconds', ratios: ['16:9', '9:16'], ratio: 'aspectRatio', fromPicture: 'match_input_image',
    adaptive: false, first: 'inputImage', last: 'inputImage2', refs: null, resolution: veoResolution, input: (resolution) => ({ resolution }),
  },
  'google/veo3-1': {
    name: 'Veo 3.1', seconds: [4, 6, 8], length: 'durationSeconds', ratios: ['16:9', '9:16'], ratio: 'aspectRatio', fromPicture: 'match_input_image',
    adaptive: false, first: 'inputImage', last: 'inputImage2', refs: { field: 'inputImage3', max: 3, seconds: 8 }, resolution: veoResolution, input: (resolution) => ({ resolution }),
  },
  /* Kling shapes only a clip made from the prompt; its pro mode is 1080p */
  'klingai/kling-v3': {
    name: 'Kling 3.0', seconds: [5, 10, 15], length: 'duration', ratios: ['16:9', '9:16', '1:1'], ratio: 'ratio', fromPicture: null,
    adaptive: false, first: 'inputImage', last: 'inputImage2', refs: null, resolution: () => '1080p', input: () => ({ mode: 'pro', sound: 'on' }), lastSilent: true,
  },
  'bytedance/seedance-2-0': {
    name: 'Seedance 2.0', seconds: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], length: 'duration', ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], ratio: 'ratio',
    fromPicture: 'adaptive', adaptive: true, first: 'inputImage', last: 'inputImageLast', refs: { field: 'inputImageReference', max: 9 },
    resolution: () => '1080p', input: (resolution) => ({ resolution, generateAudio: 'true' }),
  },
};
/** Veo makes 1080p clips 8 seconds long only (asked for a shorter one, it makes 8 s), so a shorter clip is 720p. */
function veoResolution(/** @type {number} */ seconds) { return seconds === 8 ? '1080p' : '720p'; }

/**
 * Each sound model's input for a prompt and a length, and the lengths it makes: `seconds`, a range in whole seconds, or
 * `lengths`, the ones it has (the nearest is asked for). `chooses`: it takes no length and makes the one it likes.
 * @type {Record<string, { name: string, seconds?: [number, number], lengths?: number[], chooses?: boolean, input: (prompt: string, sec: number | null) => Record<string, unknown> }>}
 */
const AUDIO = {
  'elevenlabs/text-to-music-v2': {
    name: 'ElevenLabs Music', lengths: [...Array.from({ length: 11 }, (_, i) => 10 + i * 5), ...Array.from({ length: 24 }, (_, i) => 70 + i * 10)],
    /* the prompt decides whether it is sung, as with ElevenLabs' own API */
    input: (prompt, sec) => ({ prompt, duration: String(sec), outputFormat: 'mp3_44100_128', instrumental: 'false' }),
  },
  'google/lyria-3-pro': { name: 'Lyria 3 Pro', chooses: true, input: (prompt) => ({ prompt }) },
  'stabilityai/stable-audio-3-medium': { name: 'Stable Audio 3 Medium', seconds: [1, 600], input: (prompt, sec) => ({ prompt, duration: sec, scale: 1 }) },
  'stabilityai/stable-audio-3-small-sfx': { name: 'Stable Audio 3 Small SFX', seconds: [1, 600], input: (prompt, sec) => ({ prompt, duration: sec, scale: 1 }) },
};
/** the length asked of a model that needs one when none is given */
const LENGTH = { music: 60, sfx: 5 };

/** Eleven v4's voices, Turbo's too, each with its gender: they speak every language the model does. */
const ELEVEN_VOICES = /** @type {[string, 'm' | 'f' | null, string | null][]} */ ([
  ['adam', 'm', null], ['alice', 'f', null], ['bella', 'f', null], ['bill', 'm', null], ['brian', 'm', null], ['callum', 'm', null], ['charlie', 'm', null],
  ['chris', 'm', null], ['daniel', 'm', null], ['eric', 'm', null], ['george', 'm', null], ['harry', 'm', null], ['jessica', 'f', null], ['laura', 'f', null],
  ['liam', 'm', null], ['lily', 'f', null], ['matilda', 'f', null], ['river', null, null], ['roger', 'm', null], ['sarah', 'f', null], ['will', 'm', null],
]);
/** Gemini's voices, each with its gender as Wiro lists it and how Google describes it: they speak every language. */
const GEMINI_VOICES = /** @type {[string, 'm' | 'f' | null, string | null][]} */ ([
  ['achernar', 'f', 'Soft'], ['achird', 'm', 'Friendly'], ['algenib', 'm', 'Gravelly'], ['algieba', 'm', 'Smooth'], ['alnilam', 'm', 'Firm'],
  ['aoede', 'f', 'Breezy'], ['autonoe', 'f', 'Bright'], ['callirrhoe', 'f', 'Easy-going'], ['charon', 'm', 'Informative'], ['despina', 'f', 'Smooth'],
  ['enceladus', 'm', 'Breathy'], ['erinome', 'f', 'Clear'], ['fenrir', 'm', 'Excitable'], ['gacrux', 'f', 'Mature'], ['iapetus', 'm', 'Clear'],
  ['kore', 'f', 'Firm'], ['laomedeia', 'f', 'Upbeat'], ['leda', 'f', 'Youthful'], ['orus', 'm', 'Firm'], ['pulcherrima', 'f', 'Forward'],
  ['puck', 'm', 'Upbeat'], ['rasalgethi', 'm', 'Informative'], ['sadachbia', 'm', 'Lively'], ['sadaltager', 'm', 'Knowledgeable'], ['schedar', 'm', 'Even'],
  ['sulafat', 'f', 'Warm'], ['umbriel', 'm', 'Easy-going'], ['vindemiatrix', 'f', 'Gentle'], ['zephyr', 'f', 'Bright'], ['zubenelgenubi', 'm', 'Casual'],
]);
/**
 * Each speech model's voices and input. `timed`: it writes the time of each word beside the audio.
 * @type {Record<string, { name: string, voices: [string, 'm' | 'f' | null, string | null][], timed: boolean, input: (said: string, voice: string) => Record<string, unknown> }>}
 */
const SPEECH = {
  'elevenlabs/eleven-v4': {
    name: 'Eleven v4', voices: ELEVEN_VOICES, timed: true,
    input: (said, voice) => ({ prompt: said, voice, outputFormat: 'mp3_44100_128', languageCode: 'auto', timestamps: 'true' }),
  },
  'elevenlabs/eleven-v4-turbo': {
    name: 'Eleven v4 Turbo', voices: ELEVEN_VOICES, timed: true,
    input: (said, voice) => ({ prompt: said, voice, outputFormat: 'mp3_44100_128', languageCode: 'auto', timestamps: 'true' }),
  },
  'google/gemini-3-1-tts': { name: 'Gemini 3.1 Flash TTS', voices: GEMINI_VOICES, timed: false, input: (said, voice) => ({ prompt: said, voice }) },
};

/**
 * Each transcription model's input for a recording: its field, and what else it is asked for. `timed`: it times each
 * word (Parakeet, 25 European languages); else it gives the text alone (Scribe, 99 languages), which Studio spreads over
 * the recording.
 * @type {Record<string, { name: string, field: string, input: Record<string, string>, timed: boolean }>}
 */
const HEARING = {
  'nvidia/parakeet-tdt-0-6b-v3': { name: 'Parakeet', field: 'inputAudio', input: { timestamps: 'true' }, timed: true },
  'elevenlabs/speech-to-text': { name: 'ElevenLabs Scribe', field: 'inputAudio', input: { inputAudioUrl: '' }, timed: false },
};

/** How long to wait between asking after a task (tests make it short). */
export const polling = { ms: { text: 1000, image: 2000, audio: 2000, video: 5000 } };

/** What a signature project without its secret is told. */
const SIGNED = `This ${NAME} project uses signature-based authentication, so it needs its API secret as well as its key: connect ${NAME} again in Studio `
  + '(the OpenFilm logo at the top left opens Settings → Providers) with both, or set WIRO_API_SECRET.';

/** @type {Provider} */
export default {
  id: 'wiro',
  name: NAME,
  env: 'WIRO_API_KEY',
  keysUrl: 'https://wiro.ai/panel/project',
  billingUrl: BILLING_URL,
  verbs: ['voice', 'tts', 'music', 'sfx', 'asr', 'image', 'video', 'translate'],
  models: MODELS,
  /* both transcription models take MP3 */
  speechFormat: 'mp3',
  checkKey(key) { credentials(key); },
  async run(verb, args, ctx) {
    if (verb === 'voice') return voices(args, ctx);
    if (verb === 'tts') return speech(args, ctx);
    if (verb === 'music' || verb === 'sfx') return sound(verb, args, ctx);
    if (verb === 'asr') return transcript(args, ctx);
    if (verb === 'image') return picture(args, ctx);
    if (verb === 'video') return video(args, ctx);
    if (verb === 'translate') return translation(args, ctx);
    throw new Error(`${NAME} does not do ${verb}.`);
  },
};

/**
 * The API key and, for a project that signs its requests, its API secret, from what the person gave: `<key>:<secret>`,
 * else the key, with WIRO_API_SECRET when it is set (a project with API key only does not look at a signature).
 * `checkKey` runs it when the key is pasted.
 * @param {string} raw
 */
function credentials(raw) {
  const at = raw.indexOf(':');
  if (at < 0) return { key: raw, secret: text(process.env.WIRO_API_SECRET) };
  const key = raw.slice(0, at).trim(), secret = raw.slice(at + 1).trim();
  if (!key || !secret) throw new Error(`A ${NAME} key is the project's API key, or <api key>:<api secret> for a project with signature-based authentication.`);
  return { key, secret };
}

/**
 * One request to Wiro's API, signed when the project signs its requests. The answer's body when Wiro said yes;
 * otherwise a sentence saying why, with the key and secret blanked out wherever Wiro echoed them.
 * @param {string} path @param {Record<string, unknown> | FormData} payload @param {RunContext} ctx
 * @returns {Promise<any>}
 */
async function api(path, payload, ctx) {
  const { key, secret } = credentials(ctx.key);
  const nonce = String(Date.now());
  const auth = { 'x-api-key': key, ...(secret ? { 'x-nonce': nonce, 'x-signature': createHmac('sha256', key).update(secret + nonce).digest('hex') } : {}) };
  const form = payload instanceof FormData;
  let res;
  try {
    res = await fetch(`${serviceUrl('WIRO', 'https://api.wiro.ai')}/v1${path}`, {
      method: 'POST', headers: form ? auth : { ...auth, 'content-type': 'application/json' }, body: form ? payload : JSON.stringify(payload), signal: ctx.signal,
    });
  } catch (e) {
    if (ctx.signal.aborted) throw e;
    throw new Error(`${NAME} could not be reached (${/** @type {Error} */ (e).message}).`);
  }
  const raw = await res.text();
  /** @type {any} */
  let body = null;
  try { body = JSON.parse(raw); } catch { /* not JSON: said as it came */ }
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const hide = (/** @type {string} */ s) => [key, secret].filter(Boolean).reduce((out, part) => out.split(part).join('•••'), s);
  const reason = hide(errors.map((/** @type {any} */ e) => text(e?.message)).filter(Boolean).join(' ') || raw.trim()).slice(0, 500);
  if (res.status === 401 || res.status === 403) {
    if (!secret && /signature/i.test(reason)) throw new Error(SIGNED);
    throw new Error(`${NAME} did not accept your key (${res.status}${reason ? `: ${reason}` : ''}). Check it in Studio: Settings (the OpenFilm logo at the top left) → Providers.`);
  }
  if (!res.ok) throw new Error(`${NAME} answered ${res.status}${reason ? `: ${reason}` : ''}`);
  if (body?.result === true) return body;
  /* its codes: 97 no balance left, 96 as many tasks running as the balance allows (the message names the amount) */
  const code = Number(errors[0]?.code);
  if (code === 97) throw noBalance(NAME);
  if (code === 96) throw new Error(`${NAME} is running as many tasks at once as the account's balance allows: wait for one to finish, or add funds at ${BILLING_URL}.`);
  throw new Error(`${NAME} could not do it: ${reason || 'it gave no reason'}`);
}

/**
 * One model run as a Wiro task: started, asked after every `every` ms until it is done, and what it made listed. A
 * cancelled run asks Wiro to stop the task too (cancelled while it waits, killed while it runs). A status that could not
 * be read is asked again, twice: the task goes on meanwhile.
 * @param {string} model @param {Record<string, unknown> | FormData} input @param {RunContext} ctx @param {number} every
 * @returns {Promise<Output[]>}
 */
async function task(model, input, ctx, every) {
  const started = await api(`/Run/${model}`, input, ctx);
  const token = text(started.socketaccesstoken);
  if (!token) throw new Error(`${NAME} did not start the task.`);
  const stop = () => {
    /* the run's own signal is spent: these get a few seconds of their own */
    const quiet = { ...ctx, signal: AbortSignal.timeout(10_000) };
    api('/Task/Cancel', { taskid: text(started.taskid) }, quiet).catch(() => {});
    api('/Task/Kill', { socketaccesstoken: token }, quiet).catch(() => {});
  };
  ctx.signal.addEventListener('abort', stop, { once: true });
  try {
    for (let misses = 0; ;) {
      await sleep(every, ctx.signal);
      /** @type {any} */
      let detail;
      try { detail = (await api('/Task/Detail', { tasktoken: token }, ctx)).tasklist?.[0]; misses = 0; }
      catch (e) { if (ctx.signal.aborted || ++misses > 2) throw e; continue; }
      if (detail?.status === 'task_cancel') throw new Error(`${NAME} cancelled the task${failure(detail)}`);
      if (detail?.status !== 'task_postprocess_end') continue;
      if (text(detail.pexit) !== '0') throw new Error(`${NAME} could not make it${failure(detail)}`);
      return Array.isArray(detail.outputs) ? detail.outputs : [];
    }
  } finally {
    ctx.signal.removeEventListener('abort', stop);
  }
}

/**
 * What a task that did not finish said about it, as the end of a sentence: the last of its error output, else the last
 * line of its output past its progress lines (where a partner model's refusal is said), short.
 */
function failure(/** @type {any} */ detail) {
  const lines = (/** @type {unknown} */ out) => text(out).split('\n').map((l) => l.trim()).filter(Boolean);
  const said = lines(detail?.debugerror).slice(-2).join(' ')
    || lines(detail?.debugoutput).filter((l) => !/^(status: \w+|Request (started|ended)\.)$/i.test(l)).slice(-1).join(' ');
  return said ? `: ${said.length > 300 ? `…${said.slice(-300)}` : said}` : '.';
}

/** The first file a task made of a kind (`image/`, `video/`, `audio/`), or a sentence saying it made none. */
function made(/** @type {Output[]} */ outputs, /** @type {string} */ kind, /** @type {string} */ what) {
  const file = outputs.find((o) => text(o?.contenttype).startsWith(kind) && text(o?.url));
  if (!file) throw new Error(`${NAME} answered without ${what}.`);
  return /** @type {Output & { url: string }} */ (file);
}

/**
 * A file from Wiro's CDN (public addresses: no key goes there), fetched again, twice, when it fails or comes shorter
 * than the size Wiro listed.
 * @param {Output & { url: string }} file @param {RunContext} ctx
 */
async function fetched(file, ctx) {
  const size = Number(file.size);
  let last = null;
  for (let tries = 0; tries < 3; tries += 1) {
    try {
      const got = await download(NAME, file.url, ctx);
      if (!(size > 0) || got.bytes.length === size) return got;
      last = new Error(`${NAME}'s file came incomplete (${got.bytes.length} of ${size} bytes).`);
    } catch (e) {
      if (ctx.signal.aborted) throw e;
      last = e;
    }
  }
  throw last;
}

/** The value in `values` nearest `asked`, the larger one on a tie. */
const nearest = (/** @type {number[]} */ values, /** @type {number} */ asked) =>
  values.reduce((best, v) => (Math.abs(v - asked) <= Math.abs(best - asked) ? v : best));

/** Lengths as a sentence says them: "4, 6 or 8", "4 to 15" for a run of whole seconds, else "set lengths from 10 to 300". */
function lengthsSaid(/** @type {number[]} */ values) {
  if (values.length <= 3) return values.length > 1 ? `${values.slice(0, -1).join(', ')} or ${values.at(-1)}` : String(values[0]);
  return values.every((v, i) => !i || v === values[i - 1] + 1) ? `${values[0]} to ${values.at(-1)}` : `set lengths from ${values[0]} to ${values.at(-1)}`;
}

/** How long a sound plays: a WAV's from its header, an MP3's from its frames (mp3Length); null when it is neither. */
function soundSeconds(/** @type {Uint8Array} */ bytes, /** @type {string} */ path) {
  return wavSeconds(bytes) ?? (path.endsWith('.mp3') ? mp3Length(bytes) : null);
}

/**
 * How long an MP3 plays (MPEG 1, 2 or 2.5 Layer III), from its first frame after any ID3v2 tag: the frame count its
 * Xing or Info header gives (an encoder writes that frame at a bitrate of its own), else its size at the first frame's
 * bitrate (constant bitrate). null when it is not one.
 * @param {Uint8Array} b
 */
function mp3Length(b) {
  let at = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b.length > 10 ? 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f)) : 0;
  /* frame sync, then Layer III */
  while (at + 4 <= b.length && !(b[at] === 0xff && (b[at + 1] & 0xe6) === 0xe2)) at += 1;
  if (at + 4 > b.length) return null;
  /* 3: MPEG 1, 2: MPEG 2, 0: MPEG 2.5 */
  const version = (b[at + 1] >> 3) & 3;
  const mpeg1 = version === 3;
  const rate = [[11025, 12000, 8000], null, [22050, 24000, 16000], [44100, 48000, 32000]][version]?.[(b[at + 2] >> 2) & 3];
  const kbps = (mpeg1 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[b[at + 2] >> 4];
  if (!rate || !kbps) return null;
  const tag = at + 4 + (mpeg1 ? ((b[at + 3] >> 6) === 3 ? 17 : 32) : ((b[at + 3] >> 6) === 3 ? 9 : 17));
  const name = String.fromCharCode(...b.subarray(tag, tag + 4));
  if ((name === 'Xing' || name === 'Info') && (b[tag + 7] & 1)) {
    const frames = ((b[tag + 8] << 24) | (b[tag + 9] << 16) | (b[tag + 10] << 8) | b[tag + 11]) >>> 0;
    return round((frames * (mpeg1 ? 1152 : 576)) / rate);
  }
  return mp3Seconds(b.subarray(at), kbps);
}

/**
 * How long an MP4 plays, from its movie header (moov, then mvhd: its duration in its own time scale); null when it has
 * none.
 * @param {Uint8Array} b
 */
function mp4Seconds(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  /** The first box of `type` between `from` and `to`: where its contents start and end. */
  const box = (/** @type {number} */ from, /** @type {number} */ to, /** @type {string} */ type) => {
    for (let at = from; at + 8 <= to;) {
      let size = view.getUint32(at), head = 8;
      if (size === 1 && at + 16 <= to) { size = Number(view.getBigUint64(at + 8)); head = 16; } else if (size === 0) size = to - at;
      if (size < head) return null;
      if (String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]) === type) return { at: at + head, end: Math.min(at + size, to) };
      at += size;
    }
    return null;
  };
  const moov = box(0, b.length, 'moov');
  const mvhd = moov && box(moov.at, moov.end, 'mvhd');
  if (!mvhd || mvhd.at + 32 > mvhd.end) return null;
  /* version 1 has 64-bit times */
  const v1 = b[mvhd.at] === 1;
  const scale = view.getUint32(mvhd.at + (v1 ? 20 : 12));
  const length = v1 ? Number(view.getBigUint64(mvhd.at + 24)) : view.getUint32(mvhd.at + 16);
  return scale ? round(length / scale) : null;
}

/**
 * The project's pictures in the same request as the rest of the input: a multipart form, each picture a file under the
 * model's field for it.
 * @param {Record<string, unknown>} input @param {[string, string][]} pictures field, project path @param {RunContext} ctx
 */
async function withPictures(input, pictures, ctx) {
  const form = new FormData();
  for (const [name, value] of Object.entries(input)) form.set(name, String(value));
  for (const [field, path] of pictures) form.append(field, new Blob([new Uint8Array(await ctx.read(path))], { type: mimeOf(path) }), basename(path));
  return form;
}

/**
 * One picture from a prompt, in the shape asked and, where the model has sizes, larger for `--quality high`. With
 * `--transparent`, the picture is then cut out of its background (CUTOUT), a second task.
 * @param {Record<string, unknown>} args @param {RunContext} ctx
 */
async function picture(args, ctx) {
  const prompt = needed(args, 'prompt');
  const ratio = text(args.ratio) || '3:2';
  if (!RATIO_SIZE[ratio]) throw new Error(`--ratio is one of ${Object.keys(RATIO_SIZE).join(', ')}.`);
  landing('image', args.out, 'png');
  const model = modelOf(MODELS, 'image', ctx);
  const spec = IMAGE[model];
  const high = text(args.quality) === 'high';
  const said = high && !spec.sizes ? [`--quality high: ${spec.name} has one quality`] : [];
  const file = made(await task(model, spec.input(prompt, ratio, high), ctx, polling.ms.image), 'image/', 'a picture');
  let { bytes, type } = await fetched(file, ctx);
  let mime = file.contenttype ?? type;
  if (args.transparent) {
    const form = new FormData();
    form.append('inputImage', new Blob([new Uint8Array(bytes)], { type: mime ?? 'image/png' }), `picture.${extOf(mime, 'png')}`);
    const cut = made(await task(CUTOUT, form, ctx, polling.ms.image), 'image/', 'the picture cut out');
    ({ bytes, type } = await fetched(cut, ctx));
    mime = cut.contenttype ?? type;
  }
  const path = landing('image', args.out, extOf(mime, 'png'));
  return { ...madePicture({ path, bytes, prompt, provider: 'wiro', model, notes: said }), cost: billedBy(NAME) };
}

/**
 * A clip with sound, of the lengths and shapes the chosen model makes: from the prompt, from a first (and last) frame,
 * or, for the models that take them, from reference pictures.
 * @param {Record<string, unknown>} args @param {RunContext} ctx
 */
async function video(args, ctx) {
  const prompt = needed(args, 'prompt');
  const path = landing('video', args.out, 'mp4');
  const model = modelOf(MODELS, 'video', ctx);
  const spec = VIDEO[model];
  const said = [];
  const first = text(args['first-frame']);
  const last = text(args['last-frame']);
  let refs = list(args['input-reference']);
  if (refs.length && !spec.refs) { said.push(`${spec.name} takes no reference pictures: they were left out`); refs = []; }
  if (spec.refs && refs.length > spec.refs.max) { said.push(`${spec.name} takes ${spec.refs.max} reference pictures: the rest were left out`); refs = refs.slice(0, spec.refs.max); }

  /* the nearest length it makes, the longer one on a tie (with reference pictures, Veo makes 8 s) */
  const asked = number(args.duration) ?? 5;
  const fixed = refs.length ? spec.refs?.seconds : undefined;
  const seconds = fixed ?? nearest(spec.seconds, asked);
  if (seconds !== asked) said.push(fixed ? `${spec.name} makes ${fixed} second clips from reference pictures` : `${spec.name} makes ${lengthsSaid(spec.seconds)} second clips: ${seconds} s`);

  /* a shape it makes, else the nearest it has; none asked, the first frame's own where it can follow it, else 16:9 */
  const ratio = text(args['aspect-ratio']);
  const tall = ['9:21', '2:3', '3:4', '9:16'].includes(ratio);
  const shape = !ratio || ratio === 'adaptive' ? null : spec.ratios.includes(ratio) ? ratio : tall ? '9:16' : ['4:3', '1:1'].includes(ratio) && spec.ratios.includes('1:1') ? '1:1' : '16:9';
  if (shape && shape !== ratio) said.push(`${spec.name} makes ${spec.ratios.join(', ')} clips: ${shape}`);
  if (first && ratio && !spec.fromPicture) said.push(`${spec.name} makes a clip from a first frame in the picture's shape: --aspect-ratio does not apply`);
  const aspect = shape ?? (first && spec.fromPicture ? spec.fromPicture : ratio === 'adaptive' && spec.adaptive ? 'adaptive' : '16:9');

  const silent = Boolean(last && spec.lastSilent);
  const resolution = spec.resolution(seconds);
  const input = { prompt, [spec.length]: String(seconds), [spec.ratio]: aspect, ...spec.input(resolution), ...(silent ? { sound: 'off' } : {}) };
  const pictures = /** @type {[string, string][]} */ ([...(first ? [[spec.first, first]] : []), ...(last ? [[spec.last, last]] : []), ...refs.map((r) => [spec.refs?.field ?? '', r])]);
  const outputs = await task(model, pictures.length ? await withPictures(input, pictures, ctx) : input, ctx, polling.ms.video);
  const { bytes } = await fetched(made(outputs, 'video/', 'a clip'), ctx);
  /* the length the clip has, which a model may make other than asked; else the one asked */
  const dur = mp4Seconds(bytes) ?? seconds;
  return {
    files: [{ path, bytes }],
    index: [{ src: path, kind: 'video', dur, hasAudio: !silent, from: {
      mode: 'generate', prompt, provider: 'wiro', model, resolution, sec: seconds,
      ...(first ? { firstFrame: first } : {}), ...(last ? { lastFrame: last } : {}), ...(refs.length ? { refs } : {}),
    } }],
    receipt: { provider: 'wiro', model, src: path, dur, hasAudio: !silent, resolution, ...notes(said) },
    cost: billedBy(NAME),
  };
}

/**
 * Music or a sound effect from a prompt, as long as asked within what the chosen model makes. Its length is measured
 * from the file; else it is the length the model was asked for.
 * @param {'music' | 'sfx'} verb @param {Record<string, unknown>} args @param {RunContext} ctx
 */
async function sound(verb, args, ctx) {
  const prompt = needed(args, 'prompt');
  const dir = verb === 'sfx' ? 'audio/sfx' : 'audio/music';
  landing(dir, args.out, 'mp3');
  const model = modelOf(MODELS, verb, ctx);
  const spec = AUDIO[model];
  const said = [];
  const asked = number(args.sec);
  const want = asked ?? LENGTH[verb];
  const sec = spec.chooses ? null : spec.lengths ? nearest(spec.lengths, want) : clamp(Math.round(want), ...(spec.seconds ?? [want, want]));
  if (asked !== null && sec !== asked) {
    said.push(spec.chooses ? `${spec.name} chooses the length of what it makes` : `${spec.name} makes ${spec.lengths ? lengthsSaid(spec.lengths) : `${spec.seconds?.[0]} to ${spec.seconds?.[1]}`} s: ${sec} s`);
  }
  const file = made(await task(model, spec.input(prompt, sec), ctx, polling.ms.audio), 'audio/', 'audio');
  const { bytes, type } = await fetched(file, ctx);
  const path = landing(dir, args.out, extOf(file.contenttype ?? type, 'mp3'));
  const dur = soundSeconds(bytes, path) ?? sec;
  return {
    files: [{ path, bytes }],
    index: [{ src: path, kind: 'audio', ...(dur !== null ? { dur } : {}), from: { mode: 'generate', prompt, ...(asked !== null ? { sec: asked } : {}), provider: 'wiro', model } }],
    receipt: { provider: 'wiro', model, src: path, dur, ...notes(said) },
    cost: billedBy(NAME),
  };
}

/**
 * A line spoken in one of the chosen model's voices. Eleven v4 writes each word's time beside the audio, which becomes
 * the voice-over's transcript; Gemini's speech has none, so Studio spreads the text over the line.
 * @param {Record<string, unknown>} args @param {RunContext} ctx
 */
async function speech(args, ctx) {
  const said = needed(args, 'text');
  const model = modelOf(MODELS, 'tts', ctx);
  const spec = SPEECH[model];
  const voice = needed(args, 'voice').toLowerCase();
  if (!spec.voices.some(([id]) => id === voice)) throw new Error(`${spec.name} on ${NAME} has no voice "${args.voice}": \`openfilm get voice\` lists its voices.`);
  landing('audio/vo', args.out, 'mp3');
  const outputs = await task(model, spec.input(said, voice), ctx, polling.ms.audio);
  const file = made(outputs, 'audio/', 'audio');
  const { bytes, type } = await fetched(file, ctx);
  const path = landing('audio/vo', args.out, extOf(file.contenttype ?? type, 'mp3'));
  const dur = soundSeconds(bytes, path);
  /* the word times are a file of their own: a voice-over without them still lands */
  const times = spec.timed ? outputs.find((o) => text(o?.contenttype).includes('json') && text(o?.url)) : undefined;
  const timing = times ? await fetched(/** @type {Output & { url: string }} */ (times), ctx).catch((e) => { if (ctx.signal.aborted) throw e; return null; }) : null;
  const words = timedWords(timing, dur);
  return {
    files: [{ path, bytes }],
    index: [{ src: path, kind: 'audio', ...(dur !== null ? { dur } : {}), text: said, voice, ...(words.length ? { words } : {}), from: { mode: 'synth', text: said, voice, provider: 'wiro', model } }],
    receipt: {
      provider: 'wiro', model, src: path, dur, voice,
      ...(words.length ? { words: words.length } : { notes: [`${spec.name} gives no word timings here: subtitles spread the text over the line`] }),
    },
    cost: billedBy(NAME),
  };
}

/**
 * The words of a timestamps file a speech model wrote beside its audio, with their times: its `words`, else its
 * characters' times made into words. Times past the end of the audio are held at its end.
 * @param {{ bytes: Uint8Array } | null} got @param {number | null} dur
 */
function timedWords(got, dur) {
  /** @type {any} */
  let body = null;
  try { body = got ? JSON.parse(Buffer.from(got.bytes).toString('utf8')) : null; } catch { return []; }
  const cut = (/** @type {number} */ t) => round(dur === null ? t : Math.min(t, dur));
  const words = (Array.isArray(body?.words) ? body.words : [])
    .filter((/** @type {any} */ w) => Number.isFinite(w?.start) && text(w.text))
    .map((/** @type {any} */ w) => ({ token: text(w.text), start: cut(w.start), end: cut(Number.isFinite(w.end) ? Math.max(w.end, w.start) : w.start) }));
  if (words.length) return words;
  const a = body?.alignment ?? body?.normalized_alignment;
  return Array.isArray(a?.characters) ? wordsFromCharacters(a.characters, a.character_start_times_seconds ?? [], a.character_end_times_seconds ?? [], dur) : [];
}

/**
 * The chosen speech model's voices, by gender; Gemini's whose description the prompt names come first. Each as
 * `openfilm get voice` gives it: { voiceId, name, language, gender, description }.
 * @param {Record<string, unknown>} args @param {RunContext} ctx
 */
function voices(args, ctx) {
  const spec = SPEECH[modelOf(MODELS, 'tts', ctx)];
  const gender = text(args.gender).toLowerCase().slice(0, 1);
  const prompt = text(args.prompt).toLowerCase();
  const described = spec.voices.some(([, , d]) => d);
  const said = [
    ...(text(args.language) ? [`--language does not narrow ${spec.name}'s voices: they speak every language it does`] : []),
    ...(prompt && !described ? [`--prompt does not narrow ${spec.name}'s voices`] : []),
  ];
  const named = (/** @type {string | null} */ d) => Number(Boolean(d && prompt.includes(d.toLowerCase())));
  const ranked = prompt && described ? [...spec.voices].sort((a, b) => named(b[2]) - named(a[2])) : spec.voices;
  const limit = clamp(Math.round(number(args.limit) ?? 5), 1, 100);
  const found = ranked.filter(([, g]) => !gender || g === gender).slice(0, limit)
    .map(([id, g, description]) => ({ voiceId: id, name: id[0].toUpperCase() + id.slice(1), language: null, gender: g, description }));
  return { files: [], index: [], receipt: { provider: 'wiro', voices: found, ...notes(said) } };
}

/**
 * What is said in a recording of the project: its text and, from Parakeet, each word's time. The recording goes as
 * MP3 (`speechFormat`), whose length is read from it for Studio to spread a text without word times over.
 * @param {Record<string, unknown>} args @param {RunContext} ctx
 */
async function transcript(args, ctx) {
  const src = needed(args, 'src');
  const model = modelOf(MODELS, 'asr', ctx);
  const spec = HEARING[model];
  const upload = await speechUpload(src, ctx);
  const form = new FormData();
  for (const [name, value] of Object.entries(spec.input)) form.set(name, value);
  form.append(spec.field, upload.blob, upload.name);
  const outputs = await task(model, form, ctx, polling.ms.audio);
  /* Parakeet writes its words and their times as JSON; both write the text alone too */
  const json = spec.timed ? outputs.find((o) => text(o?.contenttype).includes('json') && text(o?.url)) : undefined;
  const plain = outputs.find((o) => text(o?.contenttype).startsWith('text/') && text(o?.url));
  const read = async (/** @type {Output | undefined} */ o) => (o ? Buffer.from((await fetched(/** @type {Output & { url: string }} */ (o), ctx)).bytes).toString('utf8') : '');
  /** @type {any} */
  let body = null;
  try { body = json ? JSON.parse(await read(json)) : null; } catch { /* the text alone, then */ }
  const words = (Array.isArray(body?.timestamp?.word) ? body.timestamp.word : [])
    .filter((/** @type {any} */ w) => Number.isFinite(w?.start) && text(w.word))
    .map((/** @type {any} */ w) => ({ token: text(w.word), start: round(w.start), end: round(Number.isFinite(w.end) ? Math.max(w.end, w.start) : w.start) }));
  const said = text(body?.text) || text(await read(plain));
  if (!said && !words.length) throw new Error(`${NAME} answered without a transcript.`);
  const dur = mp3Length(new Uint8Array(await upload.blob.arrayBuffer()));
  return {
    files: [],
    index: [{ src, text: said, ...(dur !== null ? { dur } : {}), ...(words.length ? { words } : {}), transcribed: true }],
    receipt: { provider: 'wiro', model, src, text: said, words: words.length, ...(spec.timed ? {} : { notes: [`${spec.name} gives no word timings here: subtitles spread the text over the recording`] }) },
    cost: billedBy(NAME),
  };
}

/**
 * Subtitle lines in another language, from a language model in one request, its answer held to the lines' JSON shape.
 * @param {Record<string, unknown>} args @param {RunContext} ctx
 */
async function translation(args, ctx) {
  const ask = translationAsk(args.lines, args.language);
  const model = modelOf(MODELS, 'translate', ctx);
  const outputs = await task(model, {
    prompt: ask.user, systemInstructions: ask.system, reasoning: 'low',
    response_format: { type: 'json_schema', name: 'subtitles', schema: { type: 'object', properties: { lines: { type: 'array', items: { type: 'string' } } }, required: ['lines'], additionalProperties: false } },
  }, ctx, polling.ms.text);
  const answer = text(outputs.find((o) => o?.contenttype === 'raw')?.content?.raw);
  return { files: [], index: [], receipt: { provider: 'wiro', model, language: text(args.language), lines: translatedLines(answer, ask.count) }, cost: billedBy(NAME) };
}
