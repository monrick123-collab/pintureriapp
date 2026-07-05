/**
 * Busqueda case-insensitive segura contra null/undefined.
 * Evita crashes del tipo str.toLowerCase() cuando str es null (ej: datos sucios de DB).
 */
export const safeIncludes = (str: string | undefined | null, query: string): boolean =>
    (str || "").toLowerCase().includes((query || "").toLowerCase());
