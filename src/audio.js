// =========================================================================================
// El bus de salida: donde se juntan las tres pistas (synth, acid y drums)
// =========================================================================================
//
//   pistas → mezcla → [aquí escuchan los analizadores: lo que se dibuja]
//          → silencio (el botón del altavoz) → limitador → foco de la ventana → altavoces
//
// Los analizadores van antes del silencio: con el sonido apagado, se sigue dibujando.

import * as Tone from 'tone';

export function createBus() {
  // Un margen de anticipación pequeño: el secuenciador programa cada paso un poco antes
  // de que suene (sin margen, los pasos llegarían tarde y a trompicones). Lo que se toca
  // en directo no espera: va con Tone.immediate(), no con Tone.now().
  Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.05 }));

  const mix = new Tone.Gain(1);
  const mute = new Tone.Gain(0);
  const limiter = new Tone.Limiter(-1);
  const focus = new Tone.Gain(1);
  mix.chain(mute, limiter, focus, Tone.getDestination());

  // Lo que se dibuja: el espectro (en decibelios, de 0 a la mitad de la frecuencia de
  // muestreo) y la onda tal cual.
  const fft = new Tone.Analyser({ type: 'fft', size: 2048, smoothing: 0.72 });
  const wave = new Tone.Analyser({ type: 'waveform', size: 1024 });
  mix.connect(fft);
  mix.connect(wave);

  // Sin el foco de la ventana (otra pestaña, otra aplicación) se calla; al volver, suena.
  const followFocus = () => {
    const on = document.hasFocus() && !document.hidden;
    focus.gain.setTargetAtTime(on ? 1 : 0, Tone.immediate(), 0.12);
  };
  addEventListener('blur', followFocus);
  addEventListener('focus', followFocus);
  document.addEventListener('visibilitychange', followFocus);

  return {
    input: mix,
    // El navegador no deja sonar nada hasta un clic, un toque o una tecla: esto, en el
    // primero.
    start: () => Tone.start(),
    setMuted(muted) {
      mute.gain.setTargetAtTime(muted ? 0 : 1, Tone.immediate(), 0.05);
    },
    spectrum: () => fft.getValue(),
    waveform: () => wave.getValue(),
    sampleRate: () => Tone.getContext().sampleRate,
  };
}
