// =========================================================================================
// Compartir: una foto del cartel como está ahora
// =========================================================================================
//
// Como en los otros experimentos: el botón de arriba a la derecha abre el menú de
// compartir del sistema con una foto del momento. La foto es un cartel pequeño: lo que se
// ve, tal cual, con un marco del color de la página (el del modo que esté puesto) y, abajo,
// «IKSYNTH · VERTIK.NET». Donde no se puede compartir una imagen (Firefox de escritorio,
// por ejemplo), el botón no aparece.
//
// WebGL borra su imagen en cuanto el navegador la enseña: al pulsar, pintamos un fotograma
// («render») y lo copiamos en el acto, sin esperar a nada.

// «canvas»: el de la página. «render()»: pinta un fotograma ahora mismo. «colors()»: los
// colores del marco y del texto, { background, ink }, los del modo que esté puesto.
export function setupShare(canvas, render, colors) {
  const button = document.querySelector('[data-share]');
  if (!button) return;

  // ¿Este navegador sabe compartir imágenes? Se pregunta con una imagen de prueba.
  const canShareImages = (() => {
    try {
      const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
      return !!navigator.canShare?.({ files: [probe] });
    } catch {
      return false;
    }
  })();
  button.hidden = !canShareImages;
  if (!canShareImages) return;

  function snapshot() {
    render();
    const { background, ink } = colors();
    // El marco, en proporción al recuadro; abajo, más alto, para el texto.
    const side = Math.min(canvas.width, canvas.height);
    const frame = Math.round(side * 0.05);
    const band = Math.round(side * 0.09);
    const out = document.createElement('canvas');
    out.width = canvas.width + frame * 2;
    out.height = canvas.height + frame + band;
    const o = out.getContext('2d');
    o.fillStyle = background;
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, frame, frame);

    // El pie: una línea fina y el nombre, como en la página.
    const size = Math.round(side * 0.022);
    o.strokeStyle = ink;
    o.lineWidth = Math.max(1, Math.round(side * 0.0015));
    const lineY = canvas.height + frame + Math.round(band * 0.3);
    o.beginPath();
    o.moveTo(frame, lineY);
    o.lineTo(out.width - frame, lineY);
    o.stroke();
    o.font = `${size}px ui-monospace, Menlo, Consolas, monospace`;
    o.textBaseline = 'middle';
    o.fillStyle = ink;
    o.fillText('IKSYNTH · VERTIK.NET', frame, lineY + (out.height - lineY) / 2);

    // Síncrono (sin toBlob) para no perder el gesto del usuario antes de compartir.
    const bin = atob(out.toDataURL('image/png').split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], 'iksynth.png', { type: 'image/png' });
  }

  button.addEventListener('click', async () => {
    // Solo la imagen: con título o texto, «Copiar» de Chrome guarda dos cosas.
    try {
      await navigator.share({ files: [snapshot()] });
    } catch (err) {
      // Cerrar el menú sin compartir no es un fallo; cualquier otro error sí: fuera botón.
      if (err?.name !== 'AbortError') button.hidden = true;
    }
  });

  // Para probarlo desde la consola: iksynth.snapshot() da la foto sin compartirla.
  window.iksynth = { ...window.iksynth, snapshot };
}
