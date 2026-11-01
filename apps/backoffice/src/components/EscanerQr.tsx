// Escáner de QR por cámara (html5-qrcode). Se reutiliza en "Verificar identidad" y, en la
// etapa 4, para la verificación cruzada en exámenes. Entrega un solo resultado por activación:
// después de leer un código se detiene hasta que el padre lo vuelva a activar.
import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function EscanerQr({ activo, onLeido }: { activo: boolean; onLeido: (texto: string) => void }) {
  const id = `escaner-${useId().replace(/:/g, '')}`;
  const [error, setError] = useState<string | null>(null);
  const onLeidoRef = useRef(onLeido);
  onLeidoRef.current = onLeido;

  useEffect(() => {
    if (!activo) return;
    const escaner = new Html5Qrcode(id, false);
    let leido = false;
    setError(null);

    // start() es asíncrono: guardamos la promesa para no llamar a stop() antes de que arranque
    // (pasa con el doble montaje de React StrictMode).
    const arranque = Html5Qrcode.getCameras()
      .then((camaras) => {
        if (camaras.length === 0) throw new Error('No se encontró ninguna cámara');
        // En una notebook suele haber una sola cámara (frontal); en el celular preferimos la trasera.
        const trasera = camaras.find((c) => /back|rear|trasera|environment/i.test(c.label));
        return escaner.start(
          (trasera ?? camaras[0]).id,
          { fps: 10, qrbox: 260 },
          (texto) => {
            if (leido) return;
            leido = true;
            onLeidoRef.current(texto);
          },
          undefined,
        );
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

    return () => {
      void arranque.then(async () => {
        if (escaner.isScanning) await escaner.stop();
        escaner.clear();
      });
    };
  }, [activo, id]);

  return (
    <div>
      <div id={id} className="aspect-square w-full overflow-hidden rounded-xl bg-slate-900" />
      {error && (
        <p className="mt-2 text-sm text-red-600">
          No se pudo abrir la cámara: {error}. Revisá los permisos del navegador (la cámara solo funciona en localhost o HTTPS).
        </p>
      )}
    </div>
  );
}
