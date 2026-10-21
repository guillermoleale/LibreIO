// SPDX-License-Identifier: GPL-3.0-or-later
import type { ReactNode } from "react";

export interface TabItem<K extends string> {
  readonly key: K;
  readonly label: string;
  readonly disabled?: boolean;
}

interface TabsProps<K extends string> {
  readonly items: readonly TabItem<K>[];
  readonly active: K;
  readonly onChange: (key: K) => void;
  readonly idPrefix: string;
  readonly children: ReactNode;
}

export function Tabs<K extends string>({
  items,
  active,
  onChange,
  idPrefix,
  children,
}: TabsProps<K>) {
  return (
    <div className="tabs">
      <div className="tabs-list" role="tablist">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.key}`}
            aria-selected={item.key === active}
            aria-controls={`${idPrefix}-panel-${item.key}`}
            className={`tab${item.key === active ? " active" : ""}`}
            disabled={item.disabled ?? false}
            onClick={() => onChange(item.key)}
            data-testid={`tab-${item.key}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="tabs-panel"
        role="tabpanel"
        id={`${idPrefix}-panel-${active}`}
        aria-labelledby={`${idPrefix}-tab-${active}`}
        data-testid={`panel-${active}`}
      >
        {children}
      </div>
    </div>
  );
}
