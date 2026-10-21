// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación INV-01: EOQ básico y variantes.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { eoq } from "../../src/inventory";
import { reportEoq } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

describe("INV-01. EOQ", () => {
  const basic = { demand: fr(1200), orderCost: fr(100), holdingCost: fr(6) };

  it("Q* = 200, costo anual de pedir más mantener 1200, 6 pedidos por año y ciclo de 2 meses", () => {
    const r = eoq(basic);
    expect(r.quantity).toEqual(fr(200));
    expect(r.orderingCost).toEqual(fr(600));
    expect(r.holdingCostTotal).toEqual(fr(600));
    expect(r.annualCost).toEqual(fr(1200));
    expect(r.ordersPerPeriod).toEqual(fr(6));
    expect(r.cycleTime).toEqual(fr("1/6"));
    expect(r.cycleTime.mul(fr(12))).toEqual(fr(2));
    expect(r.maxInventory).toEqual(fr(200));
    expect(r.shortage).toBeNull();
    expect(reportEoq(basic, r)).toContain("Q* = 200");
  });

  it("con faltantes admitidos el lote crece y el inventario máximo baja", () => {
    const r = eoq({ ...basic, shortageCost: fr(18) });
    expect(r.quantity.toNumber()).toBeCloseTo(230.94, 1);
    expect(r.maxInventory.toNumber()).toBeCloseTo(173.21, 1);
    expect(r.shortage!.toNumber()).toBeCloseTo(57.74, 1);
    expect(r.annualCost.toNumber()).toBeCloseTo(1039.23, 1);
  });

  it("con tasa de producción finita el lote crece", () => {
    const r = eoq({ ...basic, productionRate: fr(3600) });
    expect(r.quantity.toNumber()).toBeCloseTo(244.95, 1);
    expect(r.maxInventory.toNumber()).toBeCloseTo(163.3, 1);
    expect(r.annualCost.toNumber()).toBeCloseTo(979.8, 1);
  });

  it("con tiempo de entrega calcula el punto de reorden", () => {
    const r = eoq({ ...basic, leadTime: fr("1/12") });
    expect(r.reorderPoint).toEqual(fr(100));
    const long = eoq({ ...basic, leadTime: fr("1/4") });
    // Tiempo de entrega mayor que el ciclo (1/6): el punto de reorden es la demanda del resto del ciclo
    expect(long.reorderPoint).toEqual(fr(100));
  });

  it("con descuentos por cantidad elige el precio que minimiza el costo total", () => {
    const r = eoq({
      demand: fr(1200),
      orderCost: fr(100),
      holdingRate: fr("1/5"),
      priceBreaks: [
        { minQuantity: fr(0), unitCost: fr(5) },
        { minQuantity: fr(500), unitCost: fr("9/2") },
      ],
    });
    expect(r.unitCost).toEqual(fr("9/2"));
    expect(r.quantity.toNumber()).toBeCloseTo(516.4, 1);
    expect(r.totalCost!.toNumber()).toBeCloseTo(5864.8, 1);
    expect(r.candidates!.length).toBe(2);
    expect(r.candidates![0]!.feasibleQuantity.toNumber()).toBeCloseTo(489.9, 1);
    const forced = eoq({
      demand: fr(1200),
      orderCost: fr(100),
      holdingRate: fr("1/5"),
      priceBreaks: [
        { minQuantity: fr(0), unitCost: fr(5) },
        { minQuantity: fr(2000), unitCost: fr(4) },
      ],
    });
    // Con 2000 unidades el costo total es 4800 + 60 + 800 = 5660, mejor que 6489.9
    expect(forced.quantity).toEqual(fr(2000));
    expect(forced.unitCost).toEqual(fr(4));
  });
});
