// SPDX-License-Identifier: GPL-3.0-or-later
// Entrada tabular estilo WinQSB sincronizada con el texto: fila de la función objetivo, una fila por
// restricción con dirección y lado derecho, y filas de cota inferior, cota superior y tipo de variable.
import { useState } from "react";
import {
  Fraction,
  INFINITY,
  NEG_INFINITY,
  finite,
  formatLP,
  type LPModel,
  type Relation,
  type Sense,
} from "@libreio/core";
import { t } from "../i18n";

type Kind = "continuous" | "integer" | "binary" | "free";

interface DraftConstraint {
  label: string;
  coefficients: string[];
  relation: Relation;
  rhs: string;
}

interface Draft {
  sense: Sense;
  names: string[];
  objective: string[];
  constraints: DraftConstraint[];
  lower: string[];
  upper: string[];
  kinds: Kind[];
}

interface TabularEditorProps {
  readonly model: LPModel | null;
  readonly onChange: (model: LPModel) => void;
}

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

function toDraft(model: LPModel | null): Draft {
  if (!model) {
    return {
      sense: "max",
      names: ["X", "Y"],
      objective: ["1", "1"],
      constraints: [
        { label: "", coefficients: ["1", "1"], relation: "<=", rhs: "10" },
      ],
      lower: ["0", "0"],
      upper: ["", ""],
      kinds: ["continuous", "continuous"],
    };
  }
  return {
    sense: model.sense,
    names: model.variables.map((v) => v.name),
    objective: model.objective.map((c) => c.toString()),
    constraints: model.constraints.map((c) => ({
      label: c.label ?? "",
      coefficients: c.coefficients.map((a) => a.toString()),
      relation: c.relation,
      rhs: c.rhs.toString(),
    })),
    lower: model.variables.map((v) =>
      v.lower.finite ? v.lower.value.toString() : "",
    ),
    upper: model.variables.map((v) =>
      v.upper.finite && v.kind !== "binary" ? v.upper.value.toString() : "",
    ),
    kinds: model.variables.map((v) => (!v.lower.finite ? "free" : v.kind)),
  };
}

function parseCell(text: string, fallback: Fraction | null): Fraction | null {
  if (text.trim() === "") {
    return fallback;
  }
  try {
    return Fraction.parse(text);
  } catch {
    return null;
  }
}

function fromDraft(draft: Draft): {
  model: LPModel | null;
  invalid: Set<string>;
} {
  const invalid = new Set<string>();
  const names = draft.names.map((n) => n.trim().toUpperCase());
  names.forEach((n, i) => {
    if (!NAME.test(n) || names.indexOf(n) !== i) {
      invalid.add(`name-${i}`);
    }
  });
  const objective = draft.objective.map((c, i) => {
    const value = parseCell(c, Fraction.ZERO);
    if (value === null) {
      invalid.add(`obj-${i}`);
    }
    return value ?? Fraction.ZERO;
  });
  const constraints = draft.constraints.map((c, r) => {
    const coefficients = c.coefficients.map((a, i) => {
      const value = parseCell(a, Fraction.ZERO);
      if (value === null) {
        invalid.add(`cons-${r}-${i}`);
      }
      return value ?? Fraction.ZERO;
    });
    const rhs = parseCell(c.rhs, Fraction.ZERO);
    if (rhs === null) {
      invalid.add(`rhs-${r}`);
    }
    if (c.label.trim() !== "" && !NAME.test(c.label.trim())) {
      invalid.add(`label-${r}`);
    }
    if (coefficients.every((a) => a.isZero())) {
      invalid.add(`row-${r}`);
    }
    return {
      label: c.label.trim() === "" ? null : c.label.trim(),
      row: r + 2,
      coefficients,
      relation: c.relation,
      rhs: rhs ?? Fraction.ZERO,
    };
  });
  const variables = names.map((name, i) => {
    const kind = draft.kinds[i]!;
    const lowerValue = parseCell(draft.lower[i]!, Fraction.ZERO);
    const upperValue = parseCell(draft.upper[i]!, null);
    if (lowerValue === null) {
      invalid.add(`lower-${i}`);
    }
    if (draft.upper[i]!.trim() !== "" && upperValue === null) {
      invalid.add(`upper-${i}`);
    }
    if (kind === "free") {
      return {
        name,
        lower: NEG_INFINITY,
        upper: upperValue ? finite(upperValue) : INFINITY,
        kind: "continuous" as const,
      };
    }
    if (kind === "binary") {
      return {
        name,
        lower: finite(Fraction.ZERO),
        upper: finite(Fraction.ONE),
        kind: "binary" as const,
      };
    }
    return {
      name,
      lower: finite(lowerValue ?? Fraction.ZERO),
      upper: upperValue ? finite(upperValue) : INFINITY,
      kind,
    };
  });
  if (
    constraints.length === 0 ||
    names.length === 0 ||
    objective.every((c) => c.isZero())
  ) {
    invalid.add("model");
  }
  if (invalid.size > 0) {
    return { model: null, invalid };
  }
  return {
    model: {
      title: null,
      sense: draft.sense,
      variables,
      objective,
      constraints,
    },
    invalid,
  };
}

export function TabularEditor({ model, onChange }: TabularEditorProps) {
  const incoming = model ? formatLP(model) : null;
  const [lastEmitted, setLastEmitted] = useState<string | null>(null);
  const [seen, setSeen] = useState(incoming);
  const [draft, setDraft] = useState<Draft>(() => toDraft(model));
  if (incoming !== seen) {
    // El texto cambió desde afuera: se reconstruye el borrador, salvo que sea el eco de nuestra propia edición.
    setSeen(incoming);
    if (incoming !== null && incoming !== lastEmitted) {
      setDraft(toDraft(model));
    }
  }
  const { invalid } = fromDraft(draft);

  const update = (mutate: (d: Draft) => Draft) => {
    const next = mutate(draft);
    setDraft(next);
    const built = fromDraft(next);
    if (built.model) {
      const text = formatLP(built.model);
      setLastEmitted(text);
      setSeen(text);
      onChange(built.model);
    }
  };

  const cls = (key: string, extra = "") =>
    `${extra}${invalid.has(key) ? " invalid" : ""}`.trim();
  const n = draft.names.length;

  return (
    <div className="table-editor" data-testid="table-view">
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>
                <select
                  value={draft.sense}
                  onChange={(e) =>
                    update((d) => ({ ...d, sense: e.target.value as Sense }))
                  }
                  aria-label={t("table.objective")}
                  data-testid="table-sense"
                >
                  <option value="max">MAX</option>
                  <option value="min">MIN</option>
                </select>
              </th>
              {draft.names.map((name, i) => (
                <th key={i}>
                  <input
                    className={cls(`name-${i}`, "cell name")}
                    value={name}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        names: d.names.map((x, k) =>
                          k === i ? e.target.value : x,
                        ),
                      }))
                    }
                    aria-label={`${t("table.variable")} ${i + 1}`}
                    data-testid={`var-name-${i}`}
                  />
                  {n > 1 && (
                    <button
                      type="button"
                      className="icon"
                      title={t("table.remove")}
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          names: d.names.filter((_, k) => k !== i),
                          objective: d.objective.filter((_, k) => k !== i),
                          lower: d.lower.filter((_, k) => k !== i),
                          upper: d.upper.filter((_, k) => k !== i),
                          kinds: d.kinds.filter((_, k) => k !== i),
                          constraints: d.constraints.map((c) => ({
                            ...c,
                            coefficients: c.coefficients.filter(
                              (_, k) => k !== i,
                            ),
                          })),
                        }))
                      }
                      data-testid={`remove-variable-${i}`}
                    >
                      ×
                    </button>
                  )}
                </th>
              ))}
              <th>{t("table.direction")}</th>
              <th>{t("table.rhs")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr className="objective-row">
              <th scope="row">{t("table.objective")}</th>
              {draft.objective.map((c, i) => (
                <td key={i}>
                  <input
                    className={cls(`obj-${i}`, "cell")}
                    value={c}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        objective: d.objective.map((x, k) =>
                          k === i ? e.target.value : x,
                        ),
                      }))
                    }
                    data-testid={`obj-coef-${i}`}
                  />
                </td>
              ))}
              <td />
              <td />
              <td />
            </tr>
            {draft.constraints.map((c, r) => (
              <tr
                key={r}
                className={invalid.has(`row-${r}`) ? "invalid-row" : ""}
              >
                <th scope="row">
                  <input
                    className={cls(`label-${r}`, "cell name")}
                    value={c.label}
                    placeholder={String(r + 2)}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        constraints: d.constraints.map((x, k) =>
                          k === r ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                    aria-label={`${t("table.label")} ${r + 2}`}
                    data-testid={`cons-${r}-label`}
                  />
                </th>
                {c.coefficients.map((a, i) => (
                  <td key={i}>
                    <input
                      className={cls(`cons-${r}-${i}`, "cell")}
                      value={a}
                      onChange={(e) =>
                        update((d) => ({
                          ...d,
                          constraints: d.constraints.map((x, k) =>
                            k === r
                              ? {
                                  ...x,
                                  coefficients: x.coefficients.map((y, m) =>
                                    m === i ? e.target.value : y,
                                  ),
                                }
                              : x,
                          ),
                        }))
                      }
                      data-testid={`cons-${r}-coef-${i}`}
                    />
                  </td>
                ))}
                <td>
                  <select
                    value={c.relation}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        constraints: d.constraints.map((x, k) =>
                          k === r
                            ? { ...x, relation: e.target.value as Relation }
                            : x,
                        ),
                      }))
                    }
                    data-testid={`cons-${r}-rel`}
                  >
                    <option value="<=">{"<="}</option>
                    <option value=">=">{">="}</option>
                    <option value="=">=</option>
                  </select>
                </td>
                <td>
                  <input
                    className={cls(`rhs-${r}`, "cell")}
                    value={c.rhs}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        constraints: d.constraints.map((x, k) =>
                          k === r ? { ...x, rhs: e.target.value } : x,
                        ),
                      }))
                    }
                    data-testid={`cons-${r}-rhs`}
                  />
                </td>
                <td>
                  {draft.constraints.length > 1 && (
                    <button
                      type="button"
                      className="icon"
                      title={t("table.remove")}
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          constraints: d.constraints.filter((_, k) => k !== r),
                        }))
                      }
                      data-testid={`remove-constraint-${r}`}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">{t("table.lower")}</th>
              {draft.lower.map((v, i) => (
                <td key={i}>
                  <input
                    className={cls(`lower-${i}`, "cell")}
                    value={
                      draft.kinds[i] === "free" || draft.kinds[i] === "binary"
                        ? ""
                        : v
                    }
                    disabled={
                      draft.kinds[i] === "free" || draft.kinds[i] === "binary"
                    }
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        lower: d.lower.map((x, k) =>
                          k === i ? e.target.value : x,
                        ),
                      }))
                    }
                    data-testid={`lower-${i}`}
                  />
                </td>
              ))}
              <td colSpan={3} />
            </tr>
            <tr>
              <th scope="row">{t("table.upper")}</th>
              {draft.upper.map((v, i) => (
                <td key={i}>
                  <input
                    className={cls(`upper-${i}`, "cell")}
                    value={draft.kinds[i] === "binary" ? "1" : v}
                    disabled={draft.kinds[i] === "binary"}
                    placeholder="∞"
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        upper: d.upper.map((x, k) =>
                          k === i ? e.target.value : x,
                        ),
                      }))
                    }
                    data-testid={`upper-${i}`}
                  />
                </td>
              ))}
              <td colSpan={3} />
            </tr>
            <tr>
              <th scope="row">{t("table.kind")}</th>
              {draft.kinds.map((k, i) => (
                <td key={i}>
                  <select
                    value={k}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        kinds: d.kinds.map((x, m) =>
                          m === i ? (e.target.value as Kind) : x,
                        ),
                      }))
                    }
                    data-testid={`kind-${i}`}
                  >
                    <option value="continuous">
                      {t("table.kind.continuous")}
                    </option>
                    <option value="integer">{t("table.kind.integer")}</option>
                    <option value="binary">{t("table.kind.binary")}</option>
                    <option value="free">{t("table.kind.free")}</option>
                  </select>
                </td>
              ))}
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            update((d) => {
              let k = d.names.length + 1;
              while (d.names.map((x) => x.toUpperCase()).includes(`X${k}`)) {
                k += 1;
              }
              return {
                ...d,
                names: [...d.names, `X${k}`],
                objective: [...d.objective, "0"],
                lower: [...d.lower, "0"],
                upper: [...d.upper, ""],
                kinds: [...d.kinds, "continuous"],
                constraints: d.constraints.map((c) => ({
                  ...c,
                  coefficients: [...c.coefficients, "0"],
                })),
              };
            })
          }
          data-testid="add-variable"
        >
          {t("table.addVariable")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            update((d) => ({
              ...d,
              constraints: [
                ...d.constraints,
                {
                  label: "",
                  coefficients: d.names.map(() => "0"),
                  relation: "<=",
                  rhs: "0",
                },
              ],
            }))
          }
          data-testid="add-constraint"
        >
          {t("table.addConstraint")}
        </button>
        {invalid.size > 0 && (
          <span className="editor-error inline" role="status">
            {t("table.invalid")}
          </span>
        )}
      </div>
    </div>
  );
}
