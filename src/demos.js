// =========================================================================================
// Las demos: canciones de ejemplo, de varios estilos
// =========================================================================================
//
// Se cargan con el botón «demo →» del secuenciador (una tras otra) o con la dirección:
// #demo1, #demo2… Cada una lleva solo lo que cambia respecto a lo de serie (los sonidos
// parten de DEFAULTS de cada pista).
//
// Cómo se escriben, para que se lean de un vistazo:
//   - synth: por pista, { paso: [[nota MIDI, largo en pasos], …] };
//   - acid: { paso: [nota MIDI, señales] }, con señales 1 = accent, 2 = slide, 3 = los dos;
//   - drums: una cadena de 16 cifras por instrumento (0 nada; 1, 2 y 3, la intensidad), en
//     el orden kick, snare, clap, hat, open, tom, cow.

const STEPS = 16;
const synthSteps = (map) => Array.from({ length: STEPS }, (_, s) => (map[s] || []).map(([midi, len]) => ({ midi, len })));
const acidSteps = (map) =>
  Array.from({ length: STEPS }, (_, s) => (map[s] ? { midi: map[s][0], accent: !!(map[s][1] & 1), slide: !!(map[s][1] & 2) } : null));
const drumRows = (rows) => rows.map((row) => row.split('').map(Number));

// Un acorde de notas que empiezan juntas y duran lo mismo.
const chord = (notes, len) => notes.map((n) => [n, len]);

export const DEMOS = [
  {
    // Re menor, lento y oscuro: bombo pesado, caja gorda con fantasmas, un bajo redondo y
    // un colchón de dos acordes (Dm9, Gm9) con mucha reverb.
    name: 'trip-hop',
    synths: [
      { wave: 'sawtooth', unison: 4, spread: 22, attack: 0.7, decay: 1.5, sustain: 0.8, release: 2.5, cutoff: 750, resonance: 1, envAmount: 1, envDecay: 1.5, lfoTarget: 'filter', lfoRate: 0.12, lfoDepth: 0.35, chorus: 0.45, delay: 0.2, delayTime: 0.51, feedback: 0.35, reverb: 0.55, size: 6, volume: -15 },
    ],
    acid: { wave: 'square', cutoff: 170, resonance: 4, envAmount: 1.6, envDecay: 0.55, accent: 0.35, drive: 0.12, delay: 0.18, delayTime: 0.51, feedback: 0.3, volume: -8 },
    drums: { kickLevel: -2, kickTune: -2, kickDecay: 1.5, snareLevel: -4, snareTune: -3, snareDecay: 1.4, clapLevel: -10, hatLevel: -15, hatDecay: 0.9, openLevel: -16, openDecay: 0.8 },
    seq: {
      bpm: 88,
      swing: 0.35,
      synths: [synthSteps({ 0: chord([53, 57, 60, 64], 8), 8: chord([58, 62, 65, 69], 8) })],
      acid: acidSteps({ 0: [38, 1], 3: [38, 0], 6: [41, 2], 7: [43, 0], 10: [38, 1], 12: [36, 0], 14: [33, 0] }),
      drums: drumRows([
        '3000000200300000',
        '0000300001003001',
        '0000000000001000',
        '2121212121212101',
        '0000000000000020',
        '0000000000000000',
        '0000000000000000',
      ]),
    },
  },
  {
    // La menor a 124: bombo a negras, clap en el 2 y el 4, open hats a contratiempo y una
    // línea ácida que chirría (mucha resonancia, accents y slides), con un acorde corto.
    name: 'acid house',
    synths: [
      { wave: 'sawtooth', unison: 3, spread: 14, attack: 0.002, decay: 0.25, sustain: 0, release: 0.3, cutoff: 1200, resonance: 3, envAmount: 2.5, envDecay: 0.2, lfoDepth: 0, chorus: 0.15, delay: 0.25, delayTime: 0.363, feedback: 0.4, reverb: 0.3, size: 2.5, volume: -15 },
    ],
    acid: { wave: 'sawtooth', cutoff: 250, resonance: 18, envAmount: 3.8, envDecay: 0.25, accent: 0.8, drive: 0.35, delay: 0.15, delayTime: 0.363, feedback: 0.35, volume: -8 },
    drums: { kickLevel: -2, kickDecay: 1.1, clapLevel: -5, hatLevel: -13, openLevel: -11, openDecay: 0.6 },
    seq: {
      bpm: 124,
      swing: 0.1,
      synths: [synthSteps({ 6: chord([57, 60, 64], 1), 14: chord([57, 60, 64], 1) })],
      acid: acidSteps({ 0: [33, 1], 1: [33, 0], 2: [45, 2], 3: [43, 0], 4: [33, 0], 6: [36, 1], 7: [33, 2], 8: [40, 0], 10: [33, 1], 11: [31, 0], 12: [45, 2], 13: [48, 0], 14: [33, 0], 15: [38, 1] }),
      drums: drumRows([
        '3000300030003000',
        '0000000000000000',
        '0000200000002000',
        '1000100010001000',
        '0020002000200020',
        '0000000000000000',
        '0000000000000000',
      ]),
    },
  },
  {
    // Mi menor a 130, oscuro y en bucle: bombo largo, hats en semicorcheas con el
    // contratiempo marcado, un bajo que rueda a contratiempo y un acorde de dub que se
    // repite en el delay.
    name: 'techno',
    synths: [
      { wave: 'sawtooth', unison: 2, spread: 8, attack: 0.003, decay: 0.3, sustain: 0, release: 0.4, cutoff: 900, resonance: 2, envAmount: 2, envDecay: 0.25, lfoDepth: 0, chorus: 0.2, delay: 0.45, delayTime: 0.346, feedback: 0.6, reverb: 0.5, size: 5, volume: -16 },
    ],
    acid: { wave: 'square', cutoff: 180, resonance: 8, envAmount: 2, envDecay: 0.15, accent: 0.5, drive: 0.2, delay: 0, volume: -9 },
    drums: { kickLevel: -1, kickTune: -1, kickDecay: 1.6, clapLevel: -7, snareLevel: -12, hatLevel: -12, hatDecay: 0.8, cowLevel: -20, cowTune: -12, cowDecay: 0.5 },
    seq: {
      bpm: 130,
      swing: 0,
      synths: [synthSteps({ 4: chord([52, 55, 59, 62], 1) })],
      acid: acidSteps({ 2: [40, 1], 3: [40, 0], 6: [40, 0], 7: [40, 0], 10: [40, 1], 11: [40, 0], 14: [40, 2], 15: [43, 0] }),
      drums: drumRows([
        '3000300030003000',
        '0000000000000000',
        '0000200000002000',
        '1131113111311131',
        '0000000000000000',
        '0000000000000000',
        '0001000000100000',
      ]),
    },
  },
  {
    // La menor a 100, de los ochenta: dos pistas de synth (un colchón ancho, La menor y Fa,
    // y un arpegio en semicorcheas con delay), un bajo en corcheas que salta de octava y
    // una caja grande.
    name: 'synthwave',
    synths: [
      { wave: 'sawtooth', unison: 5, spread: 30, attack: 0.3, decay: 1, sustain: 0.8, release: 1.2, cutoff: 1800, resonance: 1, envAmount: 0.8, envDecay: 1, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 0.2, chorus: 0.6, delay: 0.1, reverb: 0.5, size: 5, volume: -17 },
      { wave: 'square', unison: 2, spread: 10, attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.2, cutoff: 2500, resonance: 2, envAmount: 1.5, envDecay: 0.2, lfoDepth: 0, chorus: 0.1, delay: 0.3, delayTime: 0.45, feedback: 0.35, reverb: 0.3, size: 3, volume: -19 },
    ],
    acid: { wave: 'sawtooth', cutoff: 600, resonance: 3, envAmount: 1.5, envDecay: 0.2, accent: 0.3, drive: 0, delay: 0, volume: -10 },
    drums: { kickLevel: -2, snareLevel: -3, snareDecay: 2.2, clapLevel: -8, hatLevel: -14, tomLevel: -8, tomTune: -3 },
    seq: {
      bpm: 100,
      swing: 0,
      synths: [
        synthSteps({ 0: chord([57, 60, 64], 8), 8: chord([53, 57, 60], 8) }),
        synthSteps(Object.fromEntries([69, 72, 76, 81, 76, 72, 69, 72, 65, 69, 72, 77, 72, 69, 65, 69].map((n, s) => [s, [[n, 1]]]))),
      ],
      acid: acidSteps({ 0: [33, 0], 2: [45, 0], 4: [33, 0], 6: [45, 0], 8: [29, 0], 10: [41, 0], 12: [29, 0], 14: [41, 1] }),
      drums: drumRows([
        '3000000030000000',
        '0000300000003000',
        '0000200000002000',
        '2020202020202020',
        '0000000000000000',
        '0000000000000232',
        '0000000000000000',
      ]),
    },
  },
  {
    // Fa mayor a 80, con mucho swing: un piano eléctrico (triangular, con trémolo) que va
    // de Fmaj7 a Em7, un bajo blando y una caja floja, como de cinta.
    name: 'lo-fi',
    synths: [
      { wave: 'triangle', unison: 2, spread: 6, attack: 0.005, decay: 1.2, sustain: 0.3, release: 1, cutoff: 1800, resonance: 1, envAmount: 0.8, envDecay: 0.6, lfoTarget: 'amp', lfoRate: 4, lfoDepth: 0.15, chorus: 0.3, delay: 0.1, reverb: 0.35, size: 3, volume: -13 },
    ],
    acid: { wave: 'square', cutoff: 140, resonance: 1.5, envAmount: 0.8, envDecay: 0.6, accent: 0.2, drive: 0.05, delay: 0, volume: -9 },
    drums: { kickLevel: -3, kickTune: -1, snareLevel: -6, snareTune: -2, snareDecay: 1.2, hatLevel: -16, hatDecay: 1.3 },
    seq: {
      bpm: 80,
      swing: 0.55,
      synths: [synthSteps({ 0: chord([53, 57, 60, 64], 6), 8: chord([52, 55, 59, 62], 6) })],
      acid: acidSteps({ 0: [41, 1], 6: [36, 0], 8: [40, 1], 14: [35, 0] }),
      drums: drumRows([
        '3000000002100000',
        '0000300000003000',
        '0000000000000000',
        '2120212021202120',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
      ]),
    },
  },
];

// Para «new»: todo vacío, con los sonidos de serie y una sola pista de synth.
export const EMPTY = {
  name: null,
  synths: [{}],
  acid: {},
  drums: {},
  seq: {
    bpm: 120,
    swing: 0,
    synths: [synthSteps({})],
    acid: acidSteps({}),
    drums: drumRows(Array(7).fill('0'.repeat(STEPS))),
  },
};
