# iksynth

Un sintetizador en el navegador, con su sonido dibujado en tiempo real. Un experimento de [VERTIK](https://www.vertik.net).

- Se toca con el teclado del ordenador, como en casi todos los sintes de navegador: la fila de la A son las teclas blancas (A = do, hasta la Ñ) y la de encima, las negras (W, E, T, Y, U, O, P). Z y X bajan y suben una octava. O con el teclado de la pantalla, con el dedo o el ratón (arrastrando se pasa de una tecla a otra).
- Hasta 12 notas a la vez. Cada voz: un oscilador (sin, tri, saw, sqr; con varias voces desafinadas entre sí, *unison*), su envolvente de volumen y un filtro de paso bajo de 24 dB con su propia envolvente.
- Un LFO que se aplica al filtro, al tono (vibrato) o al volumen (trémolo), y efectos: chorus, delay y reverb.
- Seis presets (init, pad, bass, pluck, lead, drone) y el panel de la derecha para cambiarlo todo. Doble clic en un deslizador: vuelve al valor del preset.
- **Random** (o la tecla R): una variación al azar del preset elegido, siempre desde sus valores. Tiempos y frecuencias, de la mitad al doble más o menos; mezclas y cantidades, un poco arriba o abajo. Lo que el preset tiene a cero se queda a cero, y la onda, el destino del LFO y el volumen no cambian.
- El sonido se enciende solo con la primera nota; el altavoz de arriba lo apaga y lo enciende. Sin el foco de la ventana, se calla.
- Tres modos (← Prev · Next → en el pie, las flechas o `#orb`, `#wire`): **ridge**, el espectro como una cordillera que se aleja (graves a la izquierda, agudos a la derecha), naranja sobre negro; **orb**, una esfera de puntos que respira con el sonido (los graves empujan el ecuador, los agudos los polos, y la onda la riza alrededor), azul hielo sobre negro; **wire**, la misma esfera en malla gris sobre papel.

## Cómo está hecho

[Tone.js](https://tonejs.github.io), [Three.js](https://threejs.org) y [Vite](https://vite.dev).

| Archivo | Qué hace |
| --- | --- |
| `index.html` · `style.css` | La página: el dibujo a toda pantalla, el símbolo, los botones, el panel, el teclado y el pie. |
| `src/main.js` | El escenario, la cámara, los modos y el bucle. |
| `src/synth.js` | El sonido: las voces, el LFO, los efectos, los presets y los analizadores. |
| `src/visual.js` | Lo que se ve: la cordillera, la esfera y su malla. |
| `src/panel.js` | El panel del sinte. |
| `src/keys.js` | Tocar: el teclado del ordenador y el de la pantalla. Un teclado MIDI solo tendría que llamar a `noteOn` y `noteOff`. |
| `src/share.js` | Compartir una foto. |

```sh
npm install
npm run dev     # para trabajar
npm run build   # dist/iksynth.js y dist/iksynth.css, para la web de VERTIK
```
