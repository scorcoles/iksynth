// =========================================================================================
// drums: una caja de ritmos sintetizada (sin muestras)
// =========================================================================================
//
// Siete instrumentos, todos hechos con osciladores y ruido:
//
//   kick  → una membrana: un seno que cae de tono muy deprisa
//   snare → ruido sin graves y, debajo, un golpe de membrana (el cuerpo)
//   clap  → ruido por un paso banda, tres golpes casi juntos y una cola
//   hat   → ruido muy agudo, cortísimo
//   open  → el mismo, largo; el hat cerrado lo corta (como en las de verdad)
//   tom   → una membrana más aguda y más corta que el kick
//   cow   → dos cuadradas desafinadas entre sí por un paso banda: un cencerro
//
// Cada uno con su volumen, su afinación (en semitonos; en los de ruido, mueve el filtro)
// y su largo (una proporción del de serie).
//
//   instrumentos → volumen de cada uno → volumen de la pista → el bus de salida (audio.js)

import * as Tone from 'tone';

export const VOICES = ['kick', 'snare', 'clap', 'hat', 'open', 'tom', 'cow'];

export const DRUM_DEFAULTS = {
  volume: -4,
  ...Object.fromEntries(VOICES.flatMap((v) => [[`${v}Level`, v === 'hat' || v === 'open' ? -10 : v === 'cow' ? -12 : -4], [`${v}Tune`, 0], [`${v}Decay`, 1]])),
};

const semis = (n) => 2 ** (n / 12);

export function createDrums(output) {
  const params = { ...DRUM_DEFAULTS };
  const volume = new Tone.Volume(params.volume).connect(output);
  const levels = Object.fromEntries(VOICES.map((v) => [v, new Tone.Volume(0).connect(volume)]));

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.05 },
  }).connect(levels.kick);

  const snareNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } });
  const snareHigh = new Tone.Filter(1400, 'highpass');
  snareNoise.chain(snareHigh, levels.snare);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } });
  const snareBodyLevel = new Tone.Volume(-8);
  snareBody.chain(snareBodyLevel, levels.snare);

  const clapNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } });
  const clapBand = new Tone.Filter({ frequency: 1100, type: 'bandpass', Q: 1.2 });
  clapNoise.chain(clapBand, levels.clap);

  const hatHigh = new Tone.Filter(8000, 'highpass');
  hatHigh.connect(levels.hat);
  const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 } }).connect(hatHigh);
  const openHigh = new Tone.Filter(7500, 'highpass');
  openHigh.connect(levels.open);
  const open = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.02 } }).connect(openHigh);

  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 2.5,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.05 },
  }).connect(levels.tom);

  const cowBand = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 2.5 });
  cowBand.connect(levels.cow);
  const cowOptions = { oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.02 } };
  const cowA = new Tone.Synth(cowOptions).connect(cowBand);
  const cowB = new Tone.Synth(cowOptions).connect(cowBand);

  // Los largos de serie de cada uno (segundos), que «Decay» multiplica.
  const BASE_DECAY = { kick: 0.45, snare: 0.16, clap: 0.2, hat: 0.045, open: 0.42, tom: 0.3, cow: 0.28 };

  const applyAll = () => {
    volume.volume.rampTo(params.volume, 0.05);
    for (const v of VOICES) levels[v].volume.rampTo(params[`${v}Level`], 0.05);
    const d = (v) => BASE_DECAY[v] * params[`${v}Decay`];
    kick.envelope.decay = d('kick');
    snareNoise.envelope.decay = d('snare');
    snareBody.envelope.decay = d('snare') * 0.75;
    clapNoise.envelope.decay = d('clap');
    hat.envelope.decay = d('hat');
    open.envelope.decay = d('open');
    tom.envelope.decay = d('tom');
    cowA.envelope.decay = d('cow');
    cowB.envelope.decay = d('cow');
    snareHigh.frequency.value = 1400 * semis(params.snareTune);
    clapBand.frequency.value = 1100 * semis(params.clapTune);
    hatHigh.frequency.value = 8000 * semis(params.hatTune);
    openHigh.frequency.value = 7500 * semis(params.openTune);
    cowBand.frequency.value = 800 * semis(params.cowTune);
  };
  applyAll();

  // Cada instrumento, a la hora «time», con la fuerza «velocity».
  const hit = {
    kick: (t, vel) => kick.triggerAttackRelease(42 * semis(params.kickTune), 0.1, t, vel),
    snare: (t, vel) => {
      snareNoise.triggerAttackRelease(0.1, t, vel);
      snareBody.triggerAttackRelease(185 * semis(params.snareTune), 0.05, t, vel);
    },
    clap: (t, vel) => {
      // Tres golpes casi juntos (las manos no chocan todas a la vez) y el último, largo.
      for (const [dt, v] of [[0, 0.7], [0.011, 0.6], [0.023, 1]]) clapNoise.triggerAttackRelease(0.02, t + dt, vel * v);
    },
    hat: (t, vel) => {
      // El cerrado corta el abierto.
      open.triggerRelease(t);
      hat.triggerAttackRelease(0.03, t, vel);
    },
    open: (t, vel) => open.triggerAttack(t, vel),
    tom: (t, vel) => tom.triggerAttackRelease(110 * semis(params.tomTune), 0.1, t, vel),
    cow: (t, vel) => {
      cowA.triggerAttackRelease(540 * semis(params.cowTune), 0.05, t, vel * 0.6);
      cowB.triggerAttackRelease(800 * semis(params.cowTune), 0.05, t, vel * 0.6);
    },
  };

  return {
    params,
    set(key, value) {
      if (!(key in params)) return;
      params[key] = value;
      applyAll();
    },
    load(saved) {
      for (const key of Object.keys(DRUM_DEFAULTS)) if (typeof saved?.[key] === typeof DRUM_DEFAULTS[key]) params[key] = saved[key];
      applyAll();
    },
    defaults: () => ({ ...DRUM_DEFAULTS }),

    // Un golpe del instrumento «index» (de 0 a 6), ya o a la hora «time».
    trigger(index, time = Tone.immediate(), velocity = 0.9) {
      const name = VOICES[index];
      if (!name) return;
      // Un golpe en directo justo encima de uno programado puede pedir una hora anterior
      // a la del último: Tone se queja. Ese golpe se pierde, sin más.
      try {
        hit[name](time, velocity);
      } catch {
        /* nada */
      }
    },
  };
}
