// =========================================================================================
// El sinte: Tone.js, voces con su filtro, un LFO, efectos y lo que se dibuja
// =========================================================================================
//
// El camino del sonido, de las teclas a los altavoces:
//
//   voces (hasta 12 a la vez; cada una, un oscilador, «unison» si se le dan varias voces,
//   con su envolvente de volumen y su filtro de paso bajo con su propia envolvente)
//     → LFO (uno de tres efectos, según a qué se aplique: el filtro, el tono o el volumen)
//     → drive (distorsión) → chorus → delay → reverb → volumen de la pista
//     → el bus de salida (audio.js), con las otras pistas

import * as Tone from 'tone';

// Los valores del preset «init», del que parten todos los demás.
export const DEFAULTS = {
  wave: 'sawtooth',
  unison: 3,
  spread: 18,
  attack: 0.01,
  decay: 0.3,
  sustain: 0.6,
  release: 0.8,
  cutoff: 1400,
  resonance: 2,
  envAmount: 2.5,
  envDecay: 0.4,
  lfoTarget: 'filter',
  lfoRate: 0.4,
  lfoDepth: 0.2,
  drive: 0,
  chorus: 0.2,
  delay: 0.18,
  delayTime: 0.3,
  feedback: 0.35,
  reverb: 0.25,
  size: 3,
  volume: -10,
};

// Los presets: solo lo que cambia respecto a «init».
export const PRESETS = {
  init: {},
  pad: {
    wave: 'sawtooth', unison: 5, spread: 30,
    attack: 1.2, decay: 1.5, sustain: 0.8, release: 3,
    cutoff: 900, resonance: 1, envAmount: 1.5, envDecay: 2,
    lfoTarget: 'filter', lfoRate: 0.15, lfoDepth: 0.5,
    chorus: 0.5, delay: 0.25, delayTime: 0.45, feedback: 0.4, reverb: 0.6, size: 7,
  },
  bass: {
    wave: 'square', unison: 2, spread: 8,
    attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.2,
    cutoff: 220, resonance: 6, envAmount: 3.5, envDecay: 0.18,
    lfoTarget: 'filter', lfoDepth: 0,
    drive: 0.2,
    chorus: 0, delay: 0, reverb: 0.08, size: 1.5, volume: -8,
  },
  pluck: {
    wave: 'triangle', unison: 2, spread: 10,
    attack: 0.002, decay: 0.5, sustain: 0, release: 0.6,
    cutoff: 600, resonance: 3, envAmount: 4, envDecay: 0.25,
    lfoDepth: 0,
    chorus: 0.15, delay: 0.35, delayTime: 0.375, feedback: 0.45, reverb: 0.35, size: 4,
  },
  lead: {
    wave: 'square', unison: 3, spread: 12,
    attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.3,
    cutoff: 2200, resonance: 4, envAmount: 1.5, envDecay: 0.3,
    lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.25,
    drive: 0.3,
    chorus: 0.1, delay: 0.3, delayTime: 0.25, feedback: 0.3, reverb: 0.25, size: 2.5,
  },
  drone: {
    wave: 'sine', unison: 7, spread: 45,
    attack: 3, decay: 2, sustain: 1, release: 6,
    cutoff: 3000, resonance: 1, envAmount: 0, envDecay: 1,
    lfoTarget: 'amp', lfoRate: 0.25, lfoDepth: 0.4,
    chorus: 0.4, delay: 0.3, delayTime: 0.8, feedback: 0.55, reverb: 0.7, size: 9,
  },
};

// El botón «random»: una variación del preset elegido, siempre desde sus valores (no desde
// la variación anterior, para que no se vaya alejando). «mul»: cuántas octavas arriba o
// abajo, como mucho, para tiempos y frecuencias (1 = de la mitad al doble); «add»: cuánto
// se suma o se resta, como mucho. Lo que el preset tiene a cero se queda a cero (un pluck
// sigue sin sustain y un bass sin LFO ni delay). La onda, el destino del LFO y el volumen
// no se tocan.
export const JITTER = {
  unison: { add: 2, step: 1 },
  spread: { mul: 0.8 },
  attack: { mul: 1 },
  decay: { mul: 0.8 },
  sustain: { add: 0.2 },
  release: { mul: 0.8 },
  cutoff: { mul: 1.2 },
  resonance: { mul: 0.9 },
  envAmount: { add: 1.2 },
  envDecay: { mul: 0.9 },
  lfoRate: { mul: 1 },
  lfoDepth: { add: 0.2 },
  drive: { add: 0.15 },
  chorus: { add: 0.2 },
  delay: { add: 0.15 },
  delayTime: { mul: 0.7 },
  feedback: { add: 0.15 },
  reverb: { add: 0.15 },
  size: { mul: 0.8 },
};

// Qué parámetros toca cada grupo: al cambiar uno, solo se reaplica su grupo (cambiar el
// oscilador de las voces mientras suenan, por ejemplo, solo cuando cambia el oscilador).
const GROUPS = {
  osc: ['wave', 'unison', 'spread'],
  amp: ['attack', 'decay', 'sustain', 'release'],
  filter: ['cutoff', 'resonance', 'envAmount', 'envDecay'],
  lfo: ['lfoTarget', 'lfoRate', 'lfoDepth'],
  fx: ['drive', 'chorus', 'delay', 'delayTime', 'feedback'],
  reverb: ['reverb', 'size'],
  out: ['volume'],
};
const groupOf = (key) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(key));

// output: adónde sale (la entrada del bus).
export function createSynth(output) {
  const params = { ...DEFAULTS };

  const voices = new Tone.PolySynth(Tone.MonoSynth);
  voices.maxPolyphony = 12;

  // El LFO: tres efectos, de los que suena uno (los otros dos, sin mezcla).
  const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0, wet: 0 });
  const autoFilter = new Tone.AutoFilter({ frequency: 1, depth: 0, octaves: 3, wet: 0 }).start();
  const tremolo = new Tone.Tremolo({ frequency: 1, depth: 0, wet: 0 }).start();

  // La distorsión: una curva que satura la onda (con sobremuestreo, para que los agudos
  // no suenen a cristales rotos) y, detrás, un poco menos de volumen cuanto más satura, para
  // que subirla no sea solo subir el volumen.
  const drive = new Tone.Distortion({ distortion: 0, oversample: '4x', wet: 0 });
  const driveTrim = new Tone.Gain(1);
  const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, spread: 180, wet: 0 }).start();
  const delay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.35, wet: 0 });
  const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.02, wet: 0 });
  const volume = new Tone.Volume(params.volume);

  voices.chain(vibrato, autoFilter, tremolo, drive, driveTrim, chorus, delay, reverb, volume, output);

  // Cada grupo, de los parámetros a Tone.
  const apply = {
    osc() {
      const fat = params.unison > 1;
      voices.set({
        oscillator: fat ? { type: `fat${params.wave}`, count: params.unison, spread: params.spread } : { type: params.wave },
      });
    },
    amp() {
      const { attack, decay, sustain, release } = params;
      voices.set({ envelope: { attack, decay, sustain, release } });
      // El filtro se cierra al soltar al mismo paso que el volumen.
      voices.set({ filterEnvelope: { release } });
    },
    filter() {
      voices.set({
        filter: { type: 'lowpass', rolloff: -24, Q: params.resonance },
        filterEnvelope: {
          baseFrequency: params.cutoff,
          octaves: params.envAmount,
          attack: 0.004,
          decay: params.envDecay,
          sustain: 0.15,
        },
      });
      // El filtro del LFO barre desde un poco por debajo del corte.
      autoFilter.baseFrequency = Math.max(30, params.cutoff * 0.4);
    },
    lfo() {
      const { lfoTarget: target, lfoRate: rate, lfoDepth: depth } = params;
      const set = (effect, on, d) => {
        effect.frequency.value = rate;
        effect.depth.value = on ? d : 0;
        effect.wet.value = on && depth > 0 ? 1 : 0;
      };
      // El vibrato, con toda la profundidad, desafina demasiado: hasta un tercio.
      set(vibrato, target === 'pitch', depth * 0.3);
      set(autoFilter, target === 'filter', depth);
      set(tremolo, target === 'amp', depth);
    },
    fx() {
      // Sin drive, la distorsión no está (sin mezcla); con él, del todo.
      drive.distortion = params.drive;
      drive.wet.value = params.drive > 0 ? 1 : 0;
      driveTrim.gain.rampTo(Tone.dbToGain(-params.drive * 9), 0.05);
      chorus.wet.value = params.chorus;
      delay.wet.value = params.delay;
      delay.delayTime.rampTo(params.delayTime, 0.08);
      delay.feedback.value = params.feedback;
    },
    reverb() {
      reverb.wet.value = params.reverb;
      // Cambiar el tamaño rehace la reverb entera (su respuesta al impulso): al arrastrar,
      // solo cuando se para un momento.
      clearTimeout(apply.reverbTimer);
      apply.reverbTimer = setTimeout(() => {
        if (reverb.decay !== params.size) reverb.decay = params.size;
      }, 180);
    },
    out() {
      volume.volume.rampTo(params.volume, 0.05);
    },
  };
  const applyAll = () => Object.keys(GROUPS).forEach((g) => apply[g]());
  applyAll();

  // Las notas que suenan ahora, tocadas en directo (en número MIDI).
  const held = new Set();
  const hz = (midi) => Tone.Frequency(midi, 'midi').toFrequency();

  return {
    params,

    set(key, value) {
      if (!(key in params)) return;
      params[key] = value;
      apply[groupOf(key)]();
    },

    // Los valores de un preset, sin aplicarlos.
    defaults: (name) => ({ ...DEFAULTS, ...(PRESETS[name] || {}) }),

    preset(name) {
      Object.assign(params, DEFAULTS, PRESETS[name] || {});
      voices.releaseAll();
      held.clear();
      applyAll();
    },

    // Para cargar lo guardado: todos los parámetros de golpe.
    load(saved) {
      for (const key of Object.keys(DEFAULTS)) if (typeof saved?.[key] === typeof DEFAULTS[key]) params[key] = saved[key];
      applyAll();
    },

    // En directo: suena ya.
    noteOn(midi, velocity = 0.8) {
      if (held.has(midi)) return;
      held.add(midi);
      voices.triggerAttack(hz(midi), Tone.immediate(), velocity);
    },
    noteOff(midi) {
      if (!held.delete(midi)) return;
      voices.triggerRelease(hz(midi), Tone.immediate());
    },
    releaseAll() {
      held.clear();
      voices.releaseAll();
    },

    // Desde el secuenciador: una nota que empieza en «time» y dura «duration» segundos.
    play(midi, duration, time, velocity = 0.8) {
      voices.triggerAttackRelease(hz(midi), duration, time, velocity);
    },
  };
}
