// =========================================================================================
// El sinte: Tone.js, voces con su filtro, un LFO, efectos y lo que se dibuja
// =========================================================================================
//
// El camino del sonido, de las teclas a los altavoces:
//
//   voces (hasta 12 a la vez; cada una, un oscilador, «unison» si se le dan varias voces,
//   con su envolvente de volumen y su filtro de paso bajo con su propia envolvente)
//     → LFO (uno de tres efectos, según a qué se aplique: el filtro, el tono o el volumen)
//     → chorus → delay → reverb → volumen general
//     → [aquí escuchan los analizadores: lo que se dibuja]
//     → silencio (el botón del altavoz) → limitador → foco de la ventana → altavoces
//
// Los analizadores van antes del silencio: con el sonido apagado, se sigue dibujando.

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

// Qué parámetros toca cada grupo: al cambiar uno, solo se reaplica su grupo (cambiar el
// oscilador de las voces mientras suenan, por ejemplo, solo cuando cambia el oscilador).
const GROUPS = {
  osc: ['wave', 'unison', 'spread'],
  amp: ['attack', 'decay', 'sustain', 'release'],
  filter: ['cutoff', 'resonance', 'envAmount', 'envDecay'],
  lfo: ['lfoTarget', 'lfoRate', 'lfoDepth'],
  fx: ['chorus', 'delay', 'delayTime', 'feedback'],
  reverb: ['reverb', 'size'],
  out: ['volume'],
};
const groupOf = (key) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(key));

export function createSynth() {
  // Sin margen de anticipación: una nota suena en cuanto se pulsa (Tone, por defecto,
  // programa todo una décima de segundo por delante, que se nota al tocar).
  Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0 }));

  const params = { ...DEFAULTS };

  const voices = new Tone.PolySynth(Tone.MonoSynth);
  voices.maxPolyphony = 12;

  // El LFO: tres efectos, de los que suena uno (los otros dos, sin mezcla).
  const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0, wet: 0 });
  const autoFilter = new Tone.AutoFilter({ frequency: 1, depth: 0, octaves: 3, wet: 0 }).start();
  const tremolo = new Tone.Tremolo({ frequency: 1, depth: 0, wet: 0 }).start();

  const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, spread: 180, wet: 0 }).start();
  const delay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.35, wet: 0 });
  const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.02, wet: 0 });
  const volume = new Tone.Volume(params.volume);
  const mute = new Tone.Gain(1);
  const limiter = new Tone.Limiter(-1);
  const focus = new Tone.Gain(1);

  voices.chain(vibrato, autoFilter, tremolo, chorus, delay, reverb, volume, mute, limiter, focus, Tone.getDestination());

  // Lo que se dibuja: el espectro (en decibelios, de 0 a la mitad de la frecuencia de
  // muestreo) y la onda tal cual.
  const fft = new Tone.Analyser({ type: 'fft', size: 2048, smoothing: 0.72 });
  const wave = new Tone.Analyser({ type: 'waveform', size: 1024 });
  volume.connect(fft);
  volume.connect(wave);

  // Sin el foco de la ventana (otra pestaña, otra aplicación) se calla; al volver, suena.
  const followFocus = () => {
    const on = document.hasFocus() && !document.hidden;
    focus.gain.setTargetAtTime(on ? 1 : 0, Tone.now(), 0.12);
  };
  addEventListener('blur', followFocus);
  addEventListener('focus', followFocus);
  document.addEventListener('visibilitychange', followFocus);

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

  // Las notas que suenan ahora (en número MIDI) y la intensidad de la última pulsada, para
  // los dibujos.
  const held = new Set();
  let lastHit = 0;

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

    // El navegador no deja sonar nada hasta un clic, un toque o una tecla: esto, en el
    // primero.
    start: () => Tone.start(),

    noteOn(midi, velocity = 0.8) {
      if (held.has(midi)) return;
      held.add(midi);
      lastHit = performance.now();
      voices.triggerAttack(Tone.Frequency(midi, 'midi').toFrequency(), Tone.now(), velocity);
    },
    noteOff(midi) {
      if (!held.delete(midi)) return;
      voices.triggerRelease(Tone.Frequency(midi, 'midi').toFrequency(), Tone.now());
    },
    releaseAll() {
      held.clear();
      voices.releaseAll();
    },
    held,
    lastHit: () => lastHit,

    setMuted(muted) {
      mute.gain.setTargetAtTime(muted ? 0 : 1, Tone.now(), 0.05);
    },

    spectrum: () => fft.getValue(),
    waveform: () => wave.getValue(),
    sampleRate: () => Tone.getContext().sampleRate,
  };
}
