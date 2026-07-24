import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear código de barras'
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-scanner-container';
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Detener la cámara de forma segura
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // Ignorar errores de cleanup
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsStarting(true);

    // Pequeño delay para asegurar que el div container exista en el DOM
    const startTimeout = setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' }, // Cámara trasera preferida
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            // Éxito: detener cámara y devolver código
            stopScanner().then(() => {
              onScan(decodedText);
            });
          },
          () => {
            // onScanError: ignorar frames no legibles (es normal mientras apunta)
          }
        );
        setIsStarting(false);
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        if (errMsg.includes('Permission') || errMsg.includes('NotAllowed')) {
          setError('Permiso de cámara denegado. Habilítalo en el navegador.');
        } else if (errMsg.includes('NotFound') || errMsg.includes('NotReadable')) {
          setError('No se encontró ninguna cámara en este dispositivo.');
        } else {
          setError('No se pudo iniciar la cámara: ' + errMsg);
        }
        setIsStarting(false);
      }
    }, 200);

    // Cleanup CRÍTICO: detener cámara al desmontar o cerrar
    return () => {
      clearTimeout(startTimeout);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">barcode_scanner</span>
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4">
          {error ? (
            <div className="text-center py-8 space-y-3">
              <span className="material-symbols-outlined text-5xl text-red-400">videocam_off</span>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 z-10">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <div id={containerId} className="w-full rounded-2xl overflow-hidden bg-slate-900" style={{ minHeight: '200px' }} />
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
                Apunta la cámara al código de barras del producto
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
