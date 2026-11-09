// =========================================================================================
// Lo que se ve del secuenciador: el transporte, las pistas y la rejilla de 16 pasos
// =========================================================================================
//
// Arriba, una barra: play, rec, el tempo, el swing, las tres pistas (1, 2, 3) y borrar
// (el paso marcado o la pista entera). Debajo, la rejilla de la pista elegida:
//
//   synth → una fila: las notas de cada paso (las largas tiñen los pasos que ocupan);
//   acid  → tres filas: la nota, el accent y el slide;
//   drums → siete filas, una por instrumento.
//
// Tocar un paso de notas lo marca (ahí va lo que se grabe paso a paso); tocar accent,
// slide o un paso de la caja lo enciende o lo apaga. Cada cuatro pasos, un poco de aire:
// los tiempos del compás.

import { STEPS, TRACKS } from './sequencer.js';
import { VOICES } from './drums.js';
import { noteName } from './keys.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, label) => {
  const b = el('button', cls, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
};

// root: donde va. seq: el secuenciador. actions: { play(), setTrack(track) }.
export function createSeqView(root, seq, actions) {
  // ---- La barra ----
  const bar = el('div', 'seq__bar');
  const play = button('seq__play', 'play', 'Reproducir o parar (espacio)');
  const rec = button('seq__rec', 'rec', 'Grabar');
  play.addEventListener('click', () => actions.play());
  rec.addEventListener('click', () => seq.toggleRecord());

  const bpmBox = el('div', 'seq__bpm');
  const bpmDown = button(null, '−', 'Más lento');
  const bpmIn = el('input');
  bpmIn.type = 'number';
  bpmIn.min = 40;
  bpmIn.max = 240;
  bpmIn.setAttribute('aria-label', 'Tempo (bpm)');
  const bpmUp = button(null, '+', 'Más rápido');
  bpmDown.addEventListener('click', (e) => seq.setBpm(seq.state.bpm - (e.shiftKey ? 10 : 1)));
  bpmUp.addEventListener('click', (e) => seq.setBpm(seq.state.bpm + (e.shiftKey ? 10 : 1)));
  bpmIn.addEventListener('change', () => seq.setBpm(Number(bpmIn.value) || seq.state.bpm));
  bpmBox.append(bpmDown, bpmIn, el('span', 'seq__unit', 'bpm'), bpmUp);

  const swingBox = el('label', 'seq__swing');
  const swingIn = el('input');
  swingIn.type = 'range';
  swingIn.min = 0;
  swingIn.max = 100;
  const swingOut = el('span', 'seq__unit');
  swingIn.addEventListener('input', () => seq.setSwing(Number(swingIn.value) / 100));
  swingBox.append(el('span', null, 'swing'), swingIn, swingOut);

  const tabs = el('div', 'seq__tabs');
  tabs.setAttribute('role', 'tablist');
  const tabEls = TRACKS.map((t, i) => {
    const b = button(null, `${i + 1} ${t}`);
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => actions.setTrack(t));
    tabs.append(b);
    return b;
  });

  const edit = el('div', 'seq__edit');
  const del = button(null, 'del', 'Borrar el paso marcado (retroceso)');
  const clear = button(null, 'clear', 'Borrar la pista entera');
  del.addEventListener('click', () => seq.clearStep(track));
  // Borrar la pista: dos toques (el primero pregunta).
  let armed = 0;
  clear.addEventListener('click', () => {
    if (performance.now() - armed < 2500) {
      seq.clearTrack(track);
      armed = 0;
      clear.textContent = 'clear';
    } else {
      armed = performance.now();
      clear.textContent = 'sure?';
      setTimeout(() => (clear.textContent = 'clear'), 2500);
    }
  });
  edit.append(del, clear);

  bar.append(play, rec, bpmBox, swingBox, tabs, edit);

  // ---- La rejilla ----
  const grid = el('div', 'seq__grid');
  root.append(bar, grid);

  let track = 'synth';
  let playing = -1;

  // Una fila: su nombre y 16 celdas. cell(step) → { text, on, tied, onClick }.
  const row = (name, cls, cell) => {
    const r = el('div', `seq__row ${cls || ''}`);
    r.append(el('span', 'seq__name', name));
    for (let s = 0; s < STEPS; s++) {
      const c = cell(s);
      const b = button('seq__cell', c.text ?? '');
      b.dataset.step = s;
      b.classList.toggle('is-on', !!c.on);
      b.classList.toggle('is-tied', !!c.tied);
      b.classList.toggle('is-cursor', !!c.cursor);
      b.classList.toggle('is-beat', s % 4 === 0);
      if (c.label) b.setAttribute('aria-label', c.label);
      b.addEventListener('click', c.onClick);
      r.append(b);
    }
    grid.append(r);
  };

  function render() {
    const st = seq.state;
    play.classList.toggle('is-on', seq.playing);
    play.textContent = seq.playing ? 'stop' : 'play';
    rec.classList.toggle('is-on', seq.recording);
    rec.setAttribute('aria-pressed', String(seq.recording));
    if (document.activeElement !== bpmIn) bpmIn.value = st.bpm;
    swingIn.value = Math.round(st.swing * 100);
    swingOut.textContent = `${Math.round(st.swing * 100)}%`;
    tabEls.forEach((b, i) => {
      const on = TRACKS[i] === track;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    grid.dataset.track = track;

    grid.textContent = '';
    if (track === 'synth') {
      // Qué pasos ocupan las notas largas que empiezan antes.
      const tied = Array(STEPS).fill(false);
      st.synth.forEach((notes, s) => notes.forEach((n) => {
        for (let k = 1; k < n.len; k++) tied[(s + k) % STEPS] = true;
      }));
      row('notes', 'seq__row--notes', (s) => {
        const notes = st.synth[s];
        const names = notes.map((n) => noteName(n.midi));
        return {
          text: names.length > 2 ? `${names.slice(0, 2).join(' ')} +${names.length - 2}` : names.join(' '),
          on: notes.length > 0,
          tied: tied[s],
          cursor: seq.cursor === s,
          label: `Paso ${s + 1}${names.length ? `: ${names.join(', ')}` : ''}`,
          onClick: () => seq.setCursor(s),
        };
      });
    } else if (track === 'acid') {
      row('notes', 'seq__row--notes', (s) => {
        const a = st.acid[s];
        return {
          text: a ? noteName(a.midi) : '',
          on: !!a,
          tied: !!(st.acid[(s + STEPS - 1) % STEPS]?.slide && a),
          cursor: seq.cursor === s,
          label: `Paso ${s + 1}${a ? `: ${noteName(a.midi)}` : ''}`,
          onClick: () => seq.setCursor(s),
        };
      });
      row('accent', null, (s) => ({ on: st.acid[s]?.accent, label: `Accent en el paso ${s + 1}`, onClick: () => seq.toggleAcid(s, 'accent') }));
      row('slide', null, (s) => ({ on: st.acid[s]?.slide, label: `Slide en el paso ${s + 1}`, onClick: () => seq.toggleAcid(s, 'slide') }));
    } else {
      VOICES.forEach((v, i) => {
        row(v, null, (s) => ({
          on: st.drums[i][s],
          cursor: seq.cursor === s && seq.recording && !seq.playing,
          label: `${v} en el paso ${s + 1}`,
          onClick: () => {
            seq.toggleDrum(i, s);
            seq.setCursor(s);
          },
        }));
      });
    }
    setStep(playing);
  }

  // El paso que suena, iluminado en todas las filas.
  function setStep(step) {
    playing = step;
    for (const c of grid.querySelectorAll('.seq__cell')) c.classList.toggle('is-now', Number(c.dataset.step) === step);
  }

  return {
    render,
    setStep,
    setTrack(t) {
      track = t;
      render();
    },
  };
}
