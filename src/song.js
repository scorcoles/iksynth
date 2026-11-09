// =========================================================================================
// La canción en la URL: para compartirla con un enlace
// =========================================================================================
//
// Todo lo que hace falta para que suene igual en otro navegador: las secuencias, el
// tempo, el swing y el sonido de todas las pistas (las de synth, el acid y la caja). Se
// empaqueta en poco (números redondeados, la caja como cifras seguidas), se comprime y va
// en la dirección como «?song=…». Quien abre el enlace la recibe cargada.
//
// El código empieza por una letra: «z», comprimido (deflate); «j», sin comprimir (para
// navegadores sin CompressionStream).

const PARAM = 'song';

// Números con cuatro cifras significativas: de sobra para un deslizador.
const round = (params) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'number' ? Number(v.toPrecision(4)) : v]));

// Versión 2: varias pistas de synth. La 1 (una sola) se sigue leyendo.
const packSteps = (steps) => steps.map((notes) => notes.map((n) => [n.midi, n.len]));
const unpackSteps = (steps) => (Array.isArray(steps) ? steps.map((notes) => (Array.isArray(notes) ? notes.map(([midi, len]) => ({ midi, len })) : [])) : null);

function pack({ synths, acid, drums, seq }) {
  return {
    v: 2,
    synths: synths.map(round),
    acid: round(acid),
    drums: round(drums),
    seq: {
      bpm: seq.bpm,
      swing: Number(seq.swing.toFixed(3)),
      synths: seq.synths.map(packSteps),
      acid: seq.acid.map((a) => (a ? [a.midi, (a.accent ? 1 : 0) | (a.slide ? 2 : 0)] : 0)),
      drums: seq.drums.map((row) => row.join('')),
    },
  };
}

function unpack(p) {
  if ((p?.v !== 1 && p?.v !== 2) || !p.seq) return null;
  const s = p.seq;
  const v1 = p.v === 1;
  return {
    synths: v1 ? [p.synth] : Array.isArray(p.synths) ? p.synths : [],
    acid: p.acid,
    drums: p.drums,
    seq: {
      bpm: s.bpm,
      swing: s.swing,
      synths: (v1 ? [s.synth] : Array.isArray(s.synths) ? s.synths : []).map(unpackSteps),
      acid: Array.isArray(s.acid) ? s.acid.map((a) => (Array.isArray(a) ? { midi: a[0], accent: !!(a[1] & 1), slide: !!(a[1] & 2) } : null)) : null,
      drums: Array.isArray(s.drums) ? s.drums.map((row) => String(row).split('').map(Number)) : null,
    },
  };
}

// Bytes ↔ texto que cabe en una URL (base64 sin «+», «/» ni «=»).
const toBase64Url = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (text) => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// La canción → el código para la URL.
export async function encodeSong(song) {
  const bytes = new TextEncoder().encode(JSON.stringify(pack(song)));
  if (typeof CompressionStream === 'function') return `z${toBase64Url(await through(bytes, new CompressionStream('deflate-raw')))}`;
  return `j${toBase64Url(bytes)}`;
}

// La canción de la URL, si la hay (y se puede leer); si no, null.
export async function readSong() {
  const code = new URLSearchParams(location.search).get(PARAM);
  if (!code) return null;
  try {
    let bytes = fromBase64Url(code.slice(1));
    if (code[0] === 'z') bytes = await through(bytes, new DecompressionStream('deflate-raw'));
    else if (code[0] !== 'j') return null;
    return unpack(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

// Quita la canción de la dirección (ya está cargada; a partir de aquí, se guarda en el
// navegador y la dirección se queda limpia).
export function clearSongFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has(PARAM)) return;
  url.searchParams.delete(PARAM);
  history.replaceState(null, '', url);
}

// El enlace para compartir: esta misma página, con la canción y el modo.
export function songUrl(code) {
  const url = new URL(location.href);
  url.searchParams.set(PARAM, code);
  return url.toString();
}
