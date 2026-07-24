import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook para detectar escaneos de pistola USB/Bluetooth.
 * Las pistolas escaner se comportan como teclados HID: escriben el codigo
 * a gran velocidad (<30ms entre teclas) y terminan con Enter.
 * Este hook distingue escritura humana (lenta) de escaneo (rapido).
 *
 * @param onScan Callback cuando se detecta un escaneo completo
 * @param enabled Si false, el hook se pausa (ej: cuando hay un modal abierto)
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled: boolean = true) {
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);
    const onScanRef = useRef(onScan);

    // Mantener el callback actualizado sin re-registrar el listener
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const now = Date.now();
        const gap = now - lastKeyTimeRef.current;
        lastKeyTimeRef.current = now;

        // Si el gap entre teclas es > 50ms, probablemente es humano -> reset buffer
        if (gap > 50 && bufferRef.current.length > 0) {
            bufferRef.current = '';
        }

        // Enter final: si el buffer tiene contenido, es un escaneo
        if (e.key === 'Enter') {
            if (bufferRef.current.length >= 3) {
                const code = bufferRef.current;
                bufferRef.current = '';
                onScanRef.current(code);
            } else {
                bufferRef.current = '';
            }
            return;
        }

        // Ignorar teclas modificadoras y de control
        if (e.ctrlKey || e.metaKey || e.altKey) {
            bufferRef.current = '';
            return;
        }

        // Solo caracteres imprimibles (letras, numeros, simbolos)
        if (e.key.length === 1) {
            bufferRef.current += e.key;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            bufferRef.current = '';
            return;
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            bufferRef.current = '';
        };
    }, [enabled, handleKeyDown]);
}

