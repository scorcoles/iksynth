// =========================================================================================
// Compartir: un enlace con la canción
// =========================================================================================
//
// El botón de arriba a la derecha no comparte una foto (como en los otros experimentos):
// comparte la canción, en un enlace (src/song.js). Donde el navegador sabe compartir
// (el menú del sistema: móviles, Safari…), lo abre; donde no, copia el enlace y lo dice.
//
// El enlace se prepara antes, cada vez que algo cambia: comprimir es asíncrono y, si se
// hiciera al pulsar, el navegador podría no dejar abrir el menú (solo lo deja justo
// después de un clic).

// getUrl(): el enlace de ahora mismo.
export function setupShare(getUrl) {
  const button = document.querySelector('[data-share]');
  if (!button) return;
  button.hidden = false;

  // El aviso, debajo del botón.
  const toast = document.createElement('p');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  button.after(toast);
  let toastTimer = 0;
  const say = (text) => {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 2200);
  };

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      say('link copiado');
    } catch {
      // Sin permiso para el portapapeles: al menos, en la barra de direcciones.
      history.replaceState(null, '', url);
      say('link en la barra de direcciones');
    }
  };

  button.addEventListener('click', async () => {
    const url = getUrl();
    if (!url) return;
    if (navigator.share && (navigator.canShare?.({ url }) ?? true)) {
      try {
        await navigator.share({ title: 'iksynth', url });
        return;
      } catch (err) {
        // Cerrar el menú sin compartir no es un fallo.
        if (err?.name === 'AbortError') return;
      }
    }
    copy(url);
  });
}
