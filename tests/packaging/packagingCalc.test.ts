import { describe, it, expect } from "vitest";
import {
    INITIAL_CALC_LINES, PACKAGE_TYPES,
    CalcLines,
    emptyLine, getLineByType, getLitersPerUnit,
    calcTotalUsed, calcTotalCapacity, calcMerma,
    getActiveLines, canSubmitCheck, isValidCalcLines,
    updateLineQty, updateLineTarget
} from "../../views/packaging/packagingCalc";

describe("packagingCalc — Modulo de Envasado (Litreados)", () => {

    // === D1: Reproduccion del bug original ===
    describe("D1 — Bug original: crash al cambiar sucursal", () => {
        it("getLineByType NUNCA retorna undefined, incluso con estado vacio", () => {
            const emptyState = {} as CalcLines;
            PACKAGE_TYPES.forEach(type => {
                const line = getLineByType(emptyState, type);
                expect(line).toBeDefined();
                expect(line.qty).toBe(0);
                expect(typeof line.qty).toBe("number");
            });
        });

        it("acceder .qty en una linea inexistente NO crashea (regresion del bug)", () => {
            const partial = { galon: emptyLine("galon") } as CalcLines;
            // Antes del refactor: calcLines.find(...)! devolvia undefined y line.qty crasheaba
            const line = getLineByType(partial, "litro");
            expect(() => line.qty * 3.785).not.toThrow();
        });

        it("calcTotalUsed no crashea con estado recien reseteado", () => {
            expect(() => calcTotalUsed(INITIAL_CALC_LINES)).not.toThrow();
            expect(calcTotalUsed(INITIAL_CALC_LINES)).toBe(0);
        });
    });

    // === D2: Invariante estructural ===
    describe("D2 — Invariante: CalcLines siempre tiene 4 claves validas", () => {
        it("INITIAL_CALC_LINES tiene exactamente 4 claves (una por PackageType)", () => {
            expect(Object.keys(INITIAL_CALC_LINES).length).toBe(4);
            expect(isValidCalcLines(INITIAL_CALC_LINES)).toBe(true);
        });

        it("updateLineQty preserva las 4 claves", () => {
            const updated = updateLineQty(INITIAL_CALC_LINES, "galon", 5);
            expect(isValidCalcLines(updated)).toBe(true);
            expect(Object.keys(updated).length).toBe(4);
            expect(updated.galon.qty).toBe(5);
            // Las demas lineas siguen en 0
            expect(updated.litro.qty).toBe(0);
        });

        it("secuencia de updates nunca rompe el invariante", () => {
            let lines = INITIAL_CALC_LINES;
            lines = updateLineQty(lines, "galon", 3);
            lines = updateLineTarget(lines, "galon", "prod-1");
            lines = updateLineQty(lines, "litro", 10);
            lines = updateLineQty(lines, "galon", 0); // reset
            expect(isValidCalcLines(lines)).toBe(true);
            expect(Object.keys(lines).length).toBe(4);
        });

        it("isValidCalcLines rechaza estados invalidos", () => {
            expect(isValidCalcLines(null)).toBe(false);
            expect(isValidCalcLines(undefined)).toBe(false);
            expect(isValidCalcLines({})).toBe(false);
            expect(isValidCalcLines({ galon: emptyLine("galon") })).toBe(false);
        });
    });

    // === D3: Validacion canSubmit ===
    describe("D3 — canSubmitCheck", () => {
        it("false cuando no hay bulk ni branch", () => {
            expect(canSubmitCheck(INITIAL_CALC_LINES, "", "", 1, 200, 0)).toBe(false);
        });

        it("false cuando hay qty pero no hay targetProductId", () => {
            let lines = updateLineQty(INITIAL_CALC_LINES, "galon", 5);
            expect(canSubmitCheck(lines, "bulk-1", "branch-1", 1, 200, 0)).toBe(false);
        });

        it("true cuando hay qty, target, bulk y branch sin exceder capacidad", () => {
            let lines = updateLineQty(INITIAL_CALC_LINES, "galon", 10);
            lines = updateLineTarget(lines, "galon", "prod-galon-uuid");
            expect(canSubmitCheck(lines, "bulk-1", "branch-1", 1, 200, 0)).toBe(true);
        });

        it("false cuando se excede la capacidad", () => {
            let lines = updateLineQty(INITIAL_CALC_LINES, "galon", 100);
            lines = updateLineTarget(lines, "galon", "prod-uuid");
            // 100 galones = 378.5L > 200L de un tambo
            expect(canSubmitCheck(lines, "bulk-1", "branch-1", 1, 200, 0)).toBe(false);
        });
    });

    // === Calculos de negocio ===
    describe("Calculos de litros y merma", () => {
        it("getLitersPerUnit retorna valores correctos", () => {
            expect(getLitersPerUnit("galon")).toBe(3.785);
            expect(getLitersPerUnit("litro")).toBe(1);
            expect(getLitersPerUnit("medio_litro")).toBe(0.5);
            expect(getLitersPerUnit("cuarto_litro")).toBe(0.25);
        });

        it("calcTotalUsed suma correctamente", () => {
            let lines = updateLineQty(INITIAL_CALC_LINES, "galon", 2);
            lines = updateLineQty(lines, "litro", 4);
            expect(calcTotalUsed(lines)).toBeCloseTo(11.57, 2);
        });

        it("calcMerma y calcTotalCapacity", () => {
            expect(calcMerma(150, 200)).toBe(50);
            expect(calcMerma(200, 200)).toBe(0);
            expect(calcTotalCapacity(1, 200, 50)).toBe(250);
        });
    });
});
