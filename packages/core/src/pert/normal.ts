// SPDX-License-Identifier: GPL-3.0-or-later
// Distribución normal estándar: función de distribución (algoritmo de West, 2005) y su inversa (Acklam).

export function normalCdf(z: number): number {
  const x = Math.abs(z);
  let result: number;
  if (x > 37) {
    result = 0;
  } else {
    const exponential = Math.exp((-x * x) / 2);
    if (x < 7.07106781186547) {
      let build = 3.52624965998911e-2 * x + 0.700383064443688;
      build = build * x + 6.37396220353165;
      build = build * x + 33.912866078383;
      build = build * x + 112.079291497871;
      build = build * x + 221.213596169931;
      build = build * x + 220.206867912376;
      result = exponential * build;
      build = 8.83883476483184e-2 * x + 1.75566716318264;
      build = build * x + 16.064177579207;
      build = build * x + 86.7807322029461;
      build = build * x + 296.564248779674;
      build = build * x + 637.333633378831;
      build = build * x + 793.826512519948;
      build = build * x + 440.413735824752;
      result /= build;
    } else {
      let build = x + 0.65;
      build = x + 4 / build;
      build = x + 3 / build;
      build = x + 2 / build;
      build = x + 1 / build;
      result = exponential / build / 2.506628274631;
    }
  }
  return z > 0 ? 1 - result : result;
}

const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
  1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
];
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
  6.680131188771972e1, -1.328068155288572e1,
];
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
  3.754408661907416,
];

export function normalQuantile(p: number): number {
  if (p <= 0) {
    return Number.NEGATIVE_INFINITY;
  }
  if (p >= 1) {
    return Number.POSITIVE_INFINITY;
  }
  const low = 0.02425;
  const high = 1 - low;
  let x: number;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q +
        C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
  } else if (p <= high) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r +
        A[5]!) *
        q) /
      (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(
        ((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q +
        C[5]!
      ) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
  }
  // Un paso de Newton con la función de distribución precisa
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
