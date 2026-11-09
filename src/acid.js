// =========================================================================================
// acid: una voz de bajo monofónica, para líneas ácidas
// =========================================================================================
//
// Un solo oscilador (diente de sierra o cuadrada) por un filtro de paso bajo muy resonante,
// con una envolvente corta que lo abre en cada nota. Dos cosas por paso, como en las cajas
// de bajo de toda la vida:
//
//   accent → la nota suena más fuerte y el filtro se abre más y se cierra antes: el
//            «chirrido»;
//   slide  → la nota no se suelta: se desliza hasta la siguiente, sin volver a atacar.
//
//   oscilador → filtro (con su envolvente) → volumen (con su envolvente, casi una puerta)
//     → drive → delay → volumen de la pista → el bus de salida (audio.js)

import * as Tone from 'tone';

export const ACID_DEFAULTS = {
  wave: 'sawtooth',
  cutoff: 220,
  resonance: 14,
  envAmount: 3.2,
  envDecay: 0.32,
  accent: 0.6,
  drive: 0.25,
  delay: 0.12,
  delayTime: 0.375,
  feedback: 0.35,
  volume: -9,
};

export const ACID_PRESETS = {
  classic: {},
  squelch: { cutoff: 160, resonance: 20, envAmount: 4.5, envDecay: 0.22, accent: 0.85, drive: 0.4 },
  deep: { wave: 'square', cutoff: 120, resonance: 6, envAmount: 2, envDecay: 0.5, accent: 0.4, drive: 0.1, delay: 0.25, delayTime: 0.5, feedback: 0.45 },
};

export const ACID_JITTER = {
  cutoff: { mul: 0.9 },
  resonance: { mul: 0.5 },
  envAmount: { add: 1 },
  envDecay: { mul: 0.8 },
  accent: { add: 0.2 },
  drive: { add: 0.15 },
  delay: { add: 0.1 },
  feedback: { add: 0.1 },
};

// Cuánto tarda en deslizarse de una nota a otra (segundos).
const GLIDE = 0.06;

export function createAcid(output) {
  const params = { ...ACID_DEFAULTS };

  const voice = new Tone.MonoSynth({
    oscillator: { type: params.wave },
    // El volumen: casi una puerta (sube de golpe, se mantiene, se suelta enseguida).
    envelope: { attack: 0.003, decay: 0.1, sustain: 0.9, release: 0.03 },
    filter: { type: 'lowpass', rolloff: -24 },
    filterEnvelope: { attack: 0.003, sustain: 0, release: 0.05 },
  });
  const drive = new Tone.Distortion({ distortion: 0, oversample: '4x', wet: 0 });
  const driveTrim = new Tone.Gain(1);
  const delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.35, wet: 0 });
  const volume = new Tone.Volume(params.volume);
  voice.chain(drive, driveTrim, delay, volume, output);

  // El acento se aplica nota a nota: la envolvente del filtro se ajusta justo antes.
  const shapeFilter = (accented) => {
    const a = accented ? params.accent : 0;
    voice.filterEnvelope.baseFrequency = params.cutoff;
    voice.filterEnvelope.octaves = params.envAmount + a * 2;
    voice.filterEnvelope.decay = params.envDecay * (1 - a * 0.5);
  };

  const applyAll = () => {
    // Cambiar la onda rehace el oscilador: solo si cambia.
    if (voice.oscillator.type !== params.wave) voice.oscillator.type = params.wave;
    voice.filter.Q.value = params.resonance;
    shapeFilter(false);
    drive.distortion = params.drive;
    drive.wet.value = params.drive > 0 ? 1 : 0;
    driveTrim.gain.rampTo(Tone.dbToGain(-params.drive * 9), 0.05);
    delay.wet.value = params.delay;
    delay.delayTime.rampTo(params.delayTime, 0.08);
    delay.feedback.value = params.feedback;
    volume.volume.rampTo(params.volume, 0.05);
  };
  applyAll();

  const hz = (midi) => Tone.Frequency(midi, 'midi').toFrequency();
  // En directo, una sola nota a la vez: la última pulsada manda; al soltarla, vuelve la
  // que siga pulsada (y se desliza a ella, como al tocar ligado).
  const held = [];

  return {
    params,
    set(key, value) {
      if (!(key in params)) return;
      params[key] = value;
      applyAll();
    },
    defaults: (name) => ({ ...ACID_DEFAULTS, ...(ACID_PRESETS[name] || {}) }),
    preset(name) {
      Object.assign(params, ACID_DEFAULTS, ACID_PRESETS[name] || {});
      applyAll();
    },
    load(saved) {
      for (const key of Object.keys(ACID_DEFAULTS)) if (typeof saved?.[key] === typeof ACID_DEFAULTS[key]) params[key] = saved[key];
      applyAll();
    },

    noteOn(midi, velocity = 0.8) {
      if (held.includes(midi)) return;
      const legato = held.length > 0;
      held.push(midi);
      const now = Tone.immediate();
      if (legato) {
        voice.portamento = GLIDE;
        voice.setNote(hz(midi), now);
      } else {
        voice.portamento = 0;
        shapeFilter(false);
        voice.triggerAttack(hz(midi), now, velocity);
      }
    },
    noteOff(midi) {
      const i = held.indexOf(midi);
      if (i < 0) return;
      held.splice(i, 1);
      const now = Tone.immediate();
      if (held.length) {
        voice.portamento = GLIDE;
        voice.setNote(hz(held[held.length - 1]), now);
      } else voice.triggerRelease(now);
    },
    releaseAll() {
      held.length = 0;
      voice.triggerRelease(Tone.immediate());
    },

    // Desde el secuenciador: un paso con nota. «slidIn»: si viene deslizándose del paso
    // anterior (entonces no ataca, solo cambia de nota). «gate»: cuánto dura antes de
    // soltarse, o null si se desliza al siguiente (no se suelta).
    play(midi, time, { accent, slidIn, gate }) {
      if (slidIn) {
        voice.portamento = GLIDE;
        voice.setNote(hz(midi), time);
      } else {
        voice.portamento = 0;
        shapeFilter(accent);
        voice.triggerAttack(hz(midi), time, accent ? 1 : 0.7);
      }
      if (gate != null) voice.triggerRelease(time + gate);
    },
    stop(time) {
      voice.triggerRelease(time);
    },
  };
}
