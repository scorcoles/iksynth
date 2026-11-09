# iksynth

Un sintetizador en el navegador, con un bajo ácido, una caja de ritmos y un secuenciador de 16 pasos; todo lo que suena se dibuja mientras suena. Un experimento de [VERTIK](https://www.vertik.net).

Demo: [scorcoles.github.io/iksynth](https://scorcoles.github.io/iksynth/) · En la web: [vertik.net/iksynth](https://www.vertik.net/iksynth/)

### Las tres pistas

- **synth**: hasta 12 notas a la vez. Cada voz: un oscilador (sin, tri, saw, sqr; con varias voces desafinadas entre sí, *unison*), su envolvente de volumen y un filtro de paso bajo de 24 dB con su propia envolvente. Un LFO (al filtro, al tono o al volumen) y efectos: drive, chorus, delay y reverb. Seis presets (init, pad, bass, pluck, lead, drone).
- **acid**: un bajo monofónico para líneas ácidas: diente de sierra o cuadrada por un filtro muy resonante con una envolvente corta. En cada paso, **accent** (más fuerte, y el filtro se abre más y se cierra antes) y **slide** (no se suelta: se desliza hasta la nota siguiente). Drive y delay. Presets classic, squelch y deep.
- **drums**: una caja de ritmos sintetizada, sin muestras: kick, snare, clap, hat, open (el hat cerrado lo corta), tom y cow. Cada uno con su volumen, su afinación y su largo.

### Tocar y grabar

- Se toca la pista elegida (1, 2 y 3, o sus pestañas) con el teclado del ordenador: la fila de la A son las teclas blancas (A = do, hasta la Ñ) y la de encima, las negras (W, E, T, Y, U, O, P); Z y X bajan y suben una octava. O con el teclado de la pantalla (arrastrando se pasa de una tecla a otra). Con la caja, cada tecla blanca es un instrumento (A = kick, S = snare…), y su nombre se ve en la tecla.
- **rec** en marcha: lo que se toca se cuadra al paso más cercano (en el synth, con su largo al soltar). **rec** parado: paso a paso; cada nota o acorde va al paso marcado y, al soltar, pasa al siguiente.
- En la rejilla: tocar un paso de notas lo marca; accent y slide se encienden y apagan tocándolos. En la caja, cada toque sube la intensidad del paso (baja, media, alta y, otra vez, apagado), y se ve en lo relleno que está; lo grabado tocando entra en media. Con el botón derecho, la vía rápida: se borra lo que haya en ese paso (en la fila de notas, el paso entero; en accent o slide, se apaga; en la caja, solo ese golpe). **del** (o retroceso) borra el paso marcado; **clear**, dos veces, la pista entera.
- Espacio, play y stop. Tempo (de 40 a 240 bpm; con mayúsculas, de diez en diez) y swing.
- Los sonidos, las secuencias y la pista elegida se guardan en el navegador.
- **Compartir** (arriba a la derecha) no comparte una foto: comparte la canción. Hace un enlace con todo (las tres secuencias, el tempo, el swing, el sonido de las tres pistas y el modo) comprimido en la dirección (`?song=…`); abre el menú de compartir del sistema o, donde no lo hay, copia el enlace. Quien lo abre recibe la canción cargada, lista para darle a play.

### Lo demás

- **Random** (o la tecla R), en synth y acid: una variación al azar del preset elegido, siempre desde sus valores. Tiempos y frecuencias, de la mitad al doble más o menos; mezclas y cantidades, un poco arriba o abajo. Lo que el preset tiene a cero se queda a cero.
- El sonido se enciende solo con la primera nota o el primer play; el altavoz de arriba lo apaga y lo enciende. Sin el foco de la ventana, se calla.
- Dos modos (← Prev · Next → en el pie, las flechas o `#wire`): **orb**, una esfera de puntos que respira con el sonido (los graves empujan el ecuador, los agudos los polos, y la onda la riza alrededor), azul hielo sobre negro; **wire**, la misma esfera en malla gris sobre papel.

## Cómo está hecho

[Tone.js](https://tonejs.github.io), [Three.js](https://threejs.org) y [Vite](https://vite.dev).

| Archivo | Qué hace |
| --- | --- |
| `index.html` · `style.css` | La página: el dibujo a toda pantalla, el símbolo, los botones, el panel, el teclado y el pie. |
| `src/main.js` | El escenario, la cámara, los modos, las pistas, los atajos y el guardado. |
| `src/audio.js` | El bus de salida: la mezcla, el silencio, el foco de la ventana y los analizadores. |
| `src/synth.js` · `src/acid.js` · `src/drums.js` | Las tres pistas: el sinte, el bajo ácido y la caja de ritmos. |
| `src/sequencer.js` · `src/seqview.js` | El secuenciador (los 16 pasos, el transporte y la grabación) y lo que se ve de él. |
| `src/visual.js` | Lo que se ve: la esfera de puntos y su malla. |
| `src/panel.js` | El panel con el sonido de cada pista. |
| `src/keys.js` | Tocar: el teclado del ordenador y el de la pantalla. Un teclado MIDI solo tendría que llamar a `noteOn` y `noteOff`. |
| `src/song.js` · `src/share.js` | La canción en la URL (empaquetada y comprimida) y compartirla con un enlace. |

```sh
npm install
npm run dev     # para trabajar
npm run build   # dist/iksynth.js y dist/iksynth.css, para la web de VERTIK
```
