// =========================================================================================
// El secuenciador: 16 pasos por pista, el transporte y la grabación
// =========================================================================================
//
// Tres pistas, cada una con su secuencia de 16 pasos (semicorcheas: un compás de 4/4):
//
//   synth → en cada paso, las notas que empiezan ahí y cuántos pasos duran (acordes, notas
//           largas);
//   acid  → en cada paso, una nota o nada, y si lleva accent y slide;
//   drums → siete filas (un instrumento cada una) de 16 pasos, encendidos o no.
//
// Grabar (REC):
//   - en marcha, lo que se toca se cuadra al paso más cercano (con su largo, al soltar);
//   - parado, paso a paso: cada nota o acorde va al paso marcado, y al soltar todo, pasa al
//     siguiente.
//
// El reloj es el Transport de Tone: avisa un poco antes de cada semicorchea, con la hora
// exacta a la que debe sonar; lo que se ve (el paso que suena) se pinta a esa hora con
// Tone.Draw.

import * as Tone from 'tone';
import { VOICES } from './drums.js';

export const STEPS = 16;
export const TRACKS = ['synth', 'acid', 'drums'];

const emptyState = () => ({
  bpm: 120,
  swing: 0,
  synth: Array.from({ length: STEPS }, () => []),
  acid: Array.from({ length: STEPS }, () => null),
  drums: VOICES.map(() => Array(STEPS).fill(false)),
});

// engines: { synth, acid, drums }. onChange: algo cambió en las secuencias (para pintar y
// guardar). onStep(step): suena el paso «step» (−1: parado). onBeat(track): suena algo de
// una pista (para los dibujos).
export function createSequencer(engines, { onChange, onStep, onBeat }) {
  const transport = Tone.getTransport();
  const draw = Tone.getDraw();
  let state = emptyState();
  let playing = false;
  let recording = false;
  let cursor = 0;

  transport.bpm.value = state.bpm;
  transport.swingSubdivision = '16n';

  // El paso que toca y cuántos van desde que se dio a play (para saber si un paso ya está
  // programado al grabar).
  let counter = 0;
  // Lo grabado en esta misma vuelta en un paso que aún no ha sonado, que no debe sonar
  // otra vez al pasar por él (ya sonó al tocarlo): paso absoluto → { pista: valores }.
  const fresh = new Map();

  const stepSeconds = () => Tone.Time('16n').toSeconds();
  // Dónde va el transporte ahora mismo, en pasos (con decimales).
  const position = () => transport.getTicksAtTime(Tone.immediate()) / (transport.PPQ / 4);

  // ---- Cada semicorchea ----
  transport.scheduleRepeat((time) => {
    const abs = counter++;
    const step = abs % STEPS;
    const just = fresh.get(abs) || {};
    fresh.delete(abs);
    const skip = (track, value) => just[track]?.has(value);
    const dur = stepSeconds();
    const beats = new Set();

    // synth: cada nota con su largo (un pelo menos, para que se note el corte).
    {
      for (const { midi, len } of state.synth[step]) {
        if (skip('synth', midi)) continue;
        engines.synth.play(midi, len * dur * 0.92, time);
        beats.add('synth');
      }
    }

    // acid: si el paso anterior tenía slide y nota, este llega deslizándose (si tiene nota).
    const prev = state.acid[(step + STEPS - 1) % STEPS];
    const here = state.acid[step];
    const next = state.acid[(step + 1) % STEPS];
    if (here && here.midi != null && !skip('acid', here.midi)) {
      const slidIn = !!(prev && prev.midi != null && prev.slide && abs > 0);
      const slideOut = here.slide && next && next.midi != null;
      engines.acid.play(here.midi, time, { accent: here.accent, slidIn, gate: slideOut ? null : dur * 0.55 });
      beats.add('acid');
    } else if (prev && prev.midi != null && prev.slide) {
      // Se deslizaba hacia un paso vacío: aquí se suelta.
      engines.acid.stop(time);
    }

    // drums
    {
      state.drums.forEach((row, v) => {
        if (row[step] && !skip('drums', v)) {
          engines.drums.trigger(v, time);
          beats.add(v === 0 ? 'kick' : 'drums');
        }
      });
    }

    draw.schedule(() => {
      onStep(step);
      for (const b of beats) onBeat(b);
    }, time);
  }, '16n', 0);

  // ---- Grabar ----
  // Las notas que están pulsadas al grabar en marcha: dónde empezaron (para su largo).
  const liveStarts = new Map();
  // Paso a paso: las teclas pulsadas ahora; al soltarlas todas, el cursor avanza.
  const stepHeld = new Set();
  let stepWrote = false;

  // A qué paso va lo que se toca ahora (en marcha): el más cercano. Si ese paso aún no ha
  // sonado en esta vuelta (está por delante), se marca para que no suene dos veces.
  const quantize = (track, value) => {
    const pos = position();
    const abs = Math.round(pos);
    if (abs >= counter) {
      const just = fresh.get(abs) || {};
      (just[track] ||= new Set()).add(value);
      fresh.set(abs, just);
    }
    return { step: ((abs % STEPS) + STEPS) % STEPS, pos };
  };

  function noteOn(track, value) {
    if (!recording) return;
    if (playing) {
      const { step, pos } = quantize(track, value);
      if (track === 'synth') {
        state.synth[step] = state.synth[step].filter((n) => n.midi !== value);
        state.synth[step].push({ midi: value, len: 1 });
        liveStarts.set(value, { step, pos });
      } else if (track === 'acid') {
        state.acid[step] = { midi: value, accent: state.acid[step]?.accent || false, slide: state.acid[step]?.slide || false };
      } else state.drums[value][step] = true;
    } else {
      stepHeld.add(`${track}:${value}`);
      stepWrote = true;
      if (track === 'synth') {
        if (!state.synth[cursor].some((n) => n.midi === value)) state.synth[cursor].push({ midi: value, len: 1 });
      } else if (track === 'acid') {
        state.acid[cursor] = { midi: value, accent: state.acid[cursor]?.accent || false, slide: state.acid[cursor]?.slide || false };
      } else state.drums[value][cursor] = true;
    }
    onChange();
  }

  function noteOff(track, value) {
    if (!recording) return;
    if (playing) {
      if (track !== 'synth' || !liveStarts.has(value)) return;
      const { step, pos } = liveStarts.get(value);
      liveStarts.delete(value);
      const len = Math.max(1, Math.min(STEPS, Math.round(position() - pos)));
      const note = state.synth[step].find((n) => n.midi === value);
      if (note) note.len = len;
      onChange();
    } else {
      stepHeld.delete(`${track}:${value}`);
      if (!stepHeld.size && stepWrote) {
        stepWrote = false;
        cursor = (cursor + 1) % STEPS;
        onChange();
      }
    }
  }

  return {
    get state() {
      return state;
    },
    get playing() {
      return playing;
    },
    get recording() {
      return recording;
    },
    get cursor() {
      return cursor;
    },

    toggle() {
      if (playing) {
        transport.stop();
        engines.acid.stop(Tone.immediate());
        playing = false;
        onStep(-1);
      } else {
        counter = 0;
        fresh.clear();
        transport.position = 0;
        transport.start('+0.02');
        playing = true;
      }
      liveStarts.clear();
      onChange();
    },
    toggleRecord() {
      recording = !recording;
      stepHeld.clear();
      onChange();
    },
    setBpm(bpm) {
      state.bpm = Math.max(40, Math.min(240, Math.round(bpm)));
      transport.bpm.rampTo(state.bpm, 0.05);
      onChange();
    },
    setSwing(swing) {
      state.swing = Math.max(0, Math.min(1, swing));
      transport.swing = state.swing * 0.6;
      onChange();
    },
    setCursor(step) {
      cursor = ((step % STEPS) + STEPS) % STEPS;
      onChange();
    },

    noteOn,
    noteOff,

    // Editar a mano, desde la rejilla.
    toggleDrum(voice, step) {
      state.drums[voice][step] = !state.drums[voice][step];
      onChange();
    },
    toggleAcid(step, flag) {
      const s = state.acid[step];
      if (!s || s.midi == null) return;
      s[flag] = !s[flag];
      onChange();
    },
    clearStep(track, step = cursor) {
      if (track === 'synth') state.synth[step] = [];
      else if (track === 'acid') state.acid[step] = null;
      else state.drums.forEach((row) => (row[step] = false));
      onChange();
    },
    clearTrack(track) {
      state[track] = emptyState()[track];
      onChange();
    },

    // Guardar y cargar (lo guarda main.js en el navegador).
    load(saved) {
      const base = emptyState();
      if (!saved) return;
      const ok = (a, n) => Array.isArray(a) && a.length === n;
      state = {
        bpm: Number(saved.bpm) || base.bpm,
        swing: Number(saved.swing) || 0,
        synth: ok(saved.synth, STEPS) ? saved.synth.map((s) => (Array.isArray(s) ? s.filter((n) => Number.isFinite(n?.midi)) : [])) : base.synth,
        acid: ok(saved.acid, STEPS) ? saved.acid.map((s) => (s && Number.isFinite(s.midi) ? { midi: s.midi, accent: !!s.accent, slide: !!s.slide } : null)) : base.acid,
        drums: ok(saved.drums, VOICES.length) ? saved.drums.map((r) => (ok(r, STEPS) ? r.map(Boolean) : Array(STEPS).fill(false))) : base.drums,
      };
      transport.bpm.value = state.bpm;
      transport.swing = state.swing * 0.6;
    },
  };
}
