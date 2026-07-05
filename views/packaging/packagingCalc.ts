// ============================================================================
// packagingCalc.ts — Logica pura del modulo de Envasado (Litreados)
// Extraida de Packaging.tsx para testabilidad (vitest environment=node).
// Sin dependencias de React ni Supabase — 100 por ciento testeable.
// ============================================================================

export type PackageType = "galon" | "litro" | "medio_litro" | "cuarto_litro";

export interface CalcLine {
    packageType: PackageType;
    qty: number;
    targetProductId: string;
}

/** Record keyed by PackageType — imposibilita find() -> undefined por construccion. */
export type CalcLines = Record<PackageType, CalcLine>;

export const PACKAGE_TYPES: PackageType[] = ["galon", "litro", "medio_litro", "cuarto_litro"];

export const GALON_LITERS_DEFAULT = 3.785;
export const DRUM_LITERS_DEFAULT = 200;

/** Factory para una linea vacia — usada como fallback. */
export const emptyLine = (type: PackageType): CalcLine => ({ packageType: type, qty: 0, targetProductId: "" });

/** Estado inicial en forma Record (antes del refactor era array). */
export const INITIAL_CALC_LINES: CalcLines = {
    galon:        emptyLine("galon"),
    litro:        emptyLine("litro"),
    medio_litro:  emptyLine("medio_litro"),
    cuarto_litro: emptyLine("cuarto_litro"),
};

/** Litros por unidad segun el tipo de presentacion. */
export function getLitersPerUnit(type: PackageType, galonLiters = GALON_LITERS_DEFAULT): number {
    if (type === "galon") return galonLiters;
    if (type === "litro") return 1;
    if (type === "medio_litro") return 0.5;
    return 0.25;
}

/** Getter seguro — NUNCA retorna undefined (fallback a emptyLine). */
export function getLineByType(lines: CalcLines, type: PackageType): CalcLine {
    return lines[type] ?? emptyLine(type);
}

/** Total de litros usados en todas las lineas activas. */
export function calcTotalUsed(lines: CalcLines, galonLiters = GALON_LITERS_DEFAULT): number {
    return PACKAGE_TYPES.reduce(
        (sum, type) => sum + getLineByType(lines, type).qty * getLitersPerUnit(type, galonLiters),
        0
    );
}

/** Capacidad total disponible: tambos cerrados + remanente a granel. */
export function calcTotalCapacity(drumQty: number, drumLiters: number, availableBulkLiters: number): number {
    return drumQty * drumLiters + availableBulkLiters;
}

/** Merma estimada del proceso de envasado. */
export function calcMerma(totalUsed: number, totalCapacity: number): number {
    return totalUsed > 0 ? Math.max(0, totalCapacity - totalUsed) : 0;
}

/** Lineas activas (qty > 0), preservando el orden de PACKAGE_TYPES. */
export function getActiveLines(lines: CalcLines): CalcLine[] {
    return PACKAGE_TYPES.map(type => getLineByType(lines, type)).filter(l => l.qty > 0);
}

/** Validacion de submit: no excede capacidad, hay lineas activas con producto, hay branch y bulk. */
export function canSubmitCheck(
    lines: CalcLines,
    bulkId: string,
    branchId: string,
    drumQty: number,
    drumLiters: number,
    availableBulkLiters: number,
    galonLiters = GALON_LITERS_DEFAULT
): boolean {
    const totalUsed = calcTotalUsed(lines, galonLiters);
    const totalCapacity = calcTotalCapacity(drumQty, drumLiters, availableBulkLiters);
    const isOverCapacity = totalUsed > totalCapacity;
    const activeLines = getActiveLines(lines);
    return !isOverCapacity
        && activeLines.length > 0
        && !!bulkId
        && !!branchId
        && activeLines.every(l => !!l.targetProductId);
}

/** Invariante: CalcLines debe tener exactamente las 4 claves de PACKAGE_TYPES con tipos correctos. */
export function isValidCalcLines(lines: unknown): lines is CalcLines {
    if (typeof lines !== "object" || lines === null) return false;
    const obj = lines as Record<string, unknown>;
    return PACKAGE_TYPES.every(type =>
        type in obj &&
        typeof obj[type] === "object" &&
        obj[type] !== null &&
        typeof (obj[type] as CalcLine).qty === "number" &&
        typeof (obj[type] as CalcLine).targetProductId === "string"
    );
}

/** Actualiza la cantidad de una linea de forma inmutable. */
export function updateLineQty(lines: CalcLines, type: PackageType, qty: number): CalcLines {
    return { ...lines, [type]: { ...getLineByType(lines, type), qty: Math.max(0, qty) } };
}

/** Actualiza el producto destino de una linea de forma inmutable. */
export function updateLineTarget(lines: CalcLines, type: PackageType, targetProductId: string): CalcLines {
    return { ...lines, [type]: { ...getLineByType(lines, type), targetProductId } };
}
