// SPDX-License-Identifier: GPL-3.0-or-later
// Modelos de colas con aritmética exacta: M/M/1, M/M/s, M/M/1/K, M/M/s/K, M/M/s con población finita,
// M/G/1, M/D/1 y M/Ek/1.
import { Fraction } from "../rational/Fraction";
import type { PnRow, QueueModel, QueueResult } from "./types";

const PN_ROWS = 15;

function factorial(n: number): Fraction {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i += 1n) {
    f *= i;
  }
  return Fraction.of(f, 1n);
}

function power(base: Fraction, n: number): Fraction {
  let result = Fraction.ONE;
  for (let i = 0; i < n; i += 1) {
    result = result.mul(base);
  }
  return result;
}

function table(pn: (n: number) => Fraction, limit: number): PnRow[] {
  const rows: PnRow[] = [];
  let cumulative = Fraction.ZERO;
  for (let n = 0; n < limit; n += 1) {
    const p = pn(n);
    cumulative = cumulative.add(p);
    rows.push({ n, probability: p, cumulative });
  }
  return rows;
}

function unstable(
  model: QueueModel,
  servers: number,
  rho: Fraction,
  message: string,
): QueueResult {
  const zero = () => Fraction.ZERO;
  return {
    model,
    stable: false,
    lambda: model.lambda,
    mu: model.mu,
    servers,
    lambdaEff: model.lambda,
    rho,
    L: Fraction.ZERO,
    Lq: Fraction.ZERO,
    W: Fraction.ZERO,
    Wq: Fraction.ZERO,
    P0: Fraction.ZERO,
    probabilityOfWaiting: Fraction.ONE,
    Pn: zero,
    pnTable: [],
    messages: [message],
  };
}

export function solveQueue(model: QueueModel): QueueResult {
  const { lambda, mu } = model;
  if (!lambda.isPositive() || !mu.isPositive()) {
    throw new RangeError("λ y μ deben ser positivos");
  }
  const servers =
    model.kind === "MMs" || model.kind === "MMsK" || model.kind === "MMsN"
      ? (model.servers ?? 1)
      : 1;
  if (servers < 1 || !Number.isInteger(servers)) {
    throw new RangeError(
      "La cantidad de servidores debe ser un entero positivo",
    );
  }
  const r = lambda.div(mu);
  switch (model.kind) {
    case "MM1":
    case "MMs": {
      const s = servers;
      const rho = r.div(Fraction.of(s));
      if (rho.ge(Fraction.ONE)) {
        return unstable(
          model,
          s,
          rho,
          `El sistema es inestable: la utilización ρ = ${rho.toString()} es mayor o igual que 1 (la cola crece sin límite).`,
        );
      }
      let sum = Fraction.ZERO;
      for (let n = 0; n < s; n += 1) {
        sum = sum.add(power(r, n).div(factorial(n)));
      }
      const tail = power(r, s).div(factorial(s)).div(Fraction.ONE.sub(rho));
      const P0 = Fraction.ONE.div(sum.add(tail));
      const Lq = P0.mul(power(r, s))
        .mul(rho)
        .div(
          factorial(s).mul(Fraction.ONE.sub(rho)).mul(Fraction.ONE.sub(rho)),
        );
      const L = Lq.add(r);
      const Pn = (n: number): Fraction =>
        n < s
          ? P0.mul(power(r, n)).div(factorial(n))
          : P0.mul(power(r, n)).div(
              factorial(s).mul(power(Fraction.of(s), n - s)),
            );
      const probabilityOfWaiting = P0.mul(power(r, s)).div(
        factorial(s).mul(Fraction.ONE.sub(rho)),
      );
      return {
        model,
        stable: true,
        lambda,
        mu,
        servers: s,
        lambdaEff: lambda,
        rho,
        L,
        Lq,
        W: L.div(lambda),
        Wq: Lq.div(lambda),
        P0,
        probabilityOfWaiting,
        Pn,
        pnTable: table(Pn, PN_ROWS),
        messages: [
          `${s === 1 ? "M/M/1" : `M/M/${s}`} estable con ρ = ${rho.toString()}.`,
        ],
      };
    }
    case "MM1K":
    case "MMsK": {
      const s = servers;
      const K = model.capacity ?? s;
      if (K < s || !Number.isInteger(K)) {
        throw new RangeError(
          "La capacidad K debe ser un entero mayor o igual que la cantidad de servidores",
        );
      }
      const rho = r.div(Fraction.of(s));
      const unnormalized = (n: number): Fraction =>
        n < s
          ? power(r, n).div(factorial(n))
          : power(r, n).div(factorial(s).mul(power(Fraction.of(s), n - s)));
      let sum = Fraction.ZERO;
      for (let n = 0; n <= K; n += 1) {
        sum = sum.add(unnormalized(n));
      }
      const P0 = Fraction.ONE.div(sum);
      const Pn = (n: number): Fraction =>
        n < 0 || n > K ? Fraction.ZERO : P0.mul(unnormalized(n));
      let L = Fraction.ZERO;
      let Lq = Fraction.ZERO;
      for (let n = 0; n <= K; n += 1) {
        const p = Pn(n);
        L = L.add(p.mul(Fraction.of(n)));
        if (n > s) {
          Lq = Lq.add(p.mul(Fraction.of(n - s)));
        }
      }
      const lambdaEff = lambda.mul(Fraction.ONE.sub(Pn(K)));
      let waiting = Fraction.ZERO;
      for (let n = s; n < K; n += 1) {
        waiting = waiting.add(Pn(n));
      }
      return {
        model,
        stable: true,
        lambda,
        mu,
        servers: s,
        lambdaEff,
        rho,
        L,
        Lq,
        W: lambdaEff.isZero() ? Fraction.ZERO : L.div(lambdaEff),
        Wq: lambdaEff.isZero() ? Fraction.ZERO : Lq.div(lambdaEff),
        P0,
        probabilityOfWaiting: waiting,
        Pn,
        pnTable: table(Pn, K + 1),
        messages: [
          `Capacidad ${K}: se rechaza una fracción ${Pn(K).toString()} de las llegadas, λ efectiva = ${lambdaEff.toString()}.`,
        ],
      };
    }
    case "MMsN": {
      const s = servers;
      const N = model.population ?? s;
      if (N < 1 || !Number.isInteger(N)) {
        throw new RangeError("La población N debe ser un entero positivo");
      }
      // λ es la tasa de llegada de cada cliente que está fuera del sistema
      const unnormalized = (n: number): Fraction => {
        if (n > N) {
          return Fraction.ZERO;
        }
        const comb = factorial(N).div(factorial(n).mul(factorial(N - n)));
        if (n < s) {
          return comb.mul(power(r, n));
        }
        return factorial(N)
          .div(
            factorial(N - n)
              .mul(factorial(s))
              .mul(power(Fraction.of(s), n - s)),
          )
          .mul(power(r, n));
      };
      let sum = Fraction.ZERO;
      for (let n = 0; n <= N; n += 1) {
        sum = sum.add(unnormalized(n));
      }
      const P0 = Fraction.ONE.div(sum);
      const Pn = (n: number): Fraction =>
        n < 0 || n > N ? Fraction.ZERO : P0.mul(unnormalized(n));
      let L = Fraction.ZERO;
      let Lq = Fraction.ZERO;
      for (let n = 0; n <= N; n += 1) {
        const p = Pn(n);
        L = L.add(p.mul(Fraction.of(n)));
        if (n > s) {
          Lq = Lq.add(p.mul(Fraction.of(n - s)));
        }
      }
      const lambdaEff = lambda.mul(Fraction.of(N).sub(L));
      let waiting = Fraction.ZERO;
      for (let n = s; n < N; n += 1) {
        waiting = waiting.add(Pn(n));
      }
      return {
        model,
        stable: true,
        lambda,
        mu,
        servers: s,
        lambdaEff,
        rho: lambdaEff.div(mu.mul(Fraction.of(s))),
        L,
        Lq,
        W: lambdaEff.isZero() ? Fraction.ZERO : L.div(lambdaEff),
        Wq: lambdaEff.isZero() ? Fraction.ZERO : Lq.div(lambdaEff),
        P0,
        probabilityOfWaiting: waiting,
        Pn,
        pnTable: table(Pn, N + 1),
        messages: [
          `Población finita de ${N} clientes: λ efectiva = λ (N - L) = ${lambdaEff.toString()}.`,
        ],
      };
    }
    case "MG1":
    case "MD1":
    case "MEk1": {
      const rho = r;
      if (rho.ge(Fraction.ONE)) {
        return unstable(
          model,
          1,
          rho,
          `El sistema es inestable: la utilización ρ = ${rho.toString()} es mayor o igual que 1.`,
        );
      }
      let variance: Fraction;
      if (model.kind === "MD1") {
        variance = Fraction.ZERO;
      } else if (model.kind === "MEk1") {
        const k = model.phases ?? 1;
        if (k < 1 || !Number.isInteger(k)) {
          throw new RangeError(
            "La cantidad de fases k debe ser un entero positivo",
          );
        }
        variance = Fraction.ONE.div(Fraction.of(k).mul(mu).mul(mu));
      } else {
        variance = model.serviceVariance ?? Fraction.ZERO;
        if (variance.isNegative()) {
          throw new RangeError(
            "La varianza del tiempo de servicio no puede ser negativa",
          );
        }
      }
      // Pollaczek Khinchine: Lq = (λ² σ² + ρ²) / (2 (1 - ρ))
      const Lq = lambda
        .mul(lambda)
        .mul(variance)
        .add(rho.mul(rho))
        .div(Fraction.of(2).mul(Fraction.ONE.sub(rho)));
      const L = Lq.add(rho);
      const P0 = Fraction.ONE.sub(rho);
      const geometric = (n: number): Fraction => P0.mul(power(rho, n));
      return {
        model,
        stable: true,
        lambda,
        mu,
        servers: 1,
        lambdaEff: lambda,
        rho,
        L,
        Lq,
        W: L.div(lambda),
        Wq: Lq.div(lambda),
        P0,
        probabilityOfWaiting: rho,
        Pn: geometric,
        pnTable: [],
        messages: [
          `Pollaczek Khinchine con varianza del servicio ${variance.toString()}: Lq = ${Lq.toString()}.`,
          "Las probabilidades Pn no tienen fórmula cerrada en M/G/1; solo P0 = 1 - ρ.",
        ],
      };
    }
    default:
      throw new RangeError(
        `Modelo de colas desconocido: ${String(model.kind)}`,
      );
  }
}
