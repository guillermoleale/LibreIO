// SPDX-License-Identifier: GPL-3.0-or-later
// Editor de texto con resaltado básico, números de línea y marca de la línea con error.
// Un textarea transparente escribe sobre un pre resaltado que se mantiene sincronizado.
import {
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import { t } from "../i18n";
import { highlightLine } from "./highlight";

interface ModelEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSolve: () => void;
  readonly errorLine: number | null;
  readonly errorMessage: string | null;
}

export function ModelEditor({
  value,
  onChange,
  onSolve,
  errorLine,
  errorMessage,
}: ModelEditorProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n"), [value]);

  const syncScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = target.scrollTop;
      preRef.current.scrollLeft = target.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSolve();
      }
    },
    [onSolve],
  );

  return (
    <div className="editor-wrapper">
      <div className={`editor${errorLine !== null ? " has-error" : ""}`}>
        <div className="editor-gutter" ref={gutterRef} aria-hidden="true">
          {lines.map((_, i) => (
            <div
              key={i}
              className={`gutter-line${errorLine === i + 1 ? " error" : ""}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div className="editor-body">
          <pre className="editor-highlight" ref={preRef} aria-hidden="true">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`code-line${errorLine === i + 1 ? " error" : ""}`}
              >
                {highlightLine(line).map((tok, j) => (
                  <span key={j} className={`tok-${tok.kind}`}>
                    {tok.text}
                  </span>
                ))}
                {line === "" ? " " : ""}
              </div>
            ))}
          </pre>
          <textarea
            className="editor-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            spellCheck={false}
            wrap="off"
            aria-label={t("editor.aria")}
            aria-invalid={errorLine !== null}
            placeholder={t("editor.placeholder")}
            data-testid="editor"
          />
        </div>
      </div>
      {errorMessage !== null && (
        <p className="editor-error" role="alert" data-testid="editor-error">
          {errorLine !== null ? `${t("editor.lineError")} ${errorLine}: ` : ""}
          {errorMessage}
        </p>
      )}
    </div>
  );
}
