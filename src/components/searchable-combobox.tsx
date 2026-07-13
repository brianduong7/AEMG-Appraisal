"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableOption = {
  id: string;
  label: string;
  searchText?: string;
};

type Props = {
  id?: string;
  label: string;
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
  emptyLabel?: string;
};

/**
 * Single-field combobox: type to filter, pick from the list (or clear).
 */
export function SearchableCombobox({
  id: idProp,
  label,
  options,
  value,
  onChange,
  placeholder = "Type to search…",
  className = "",
  allowClear = false,
  emptyLabel = "No matches",
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listId = `${id}-listbox`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? "");
      setHighlight(0);
    }
  }, [open, selected?.label, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = (o.searchText ?? o.label).toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(opt: SearchableOption) {
    onChange(opt.id);
    setQuery(opt.label);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`relative min-w-[14rem] ${className}`} ref={wrapRef}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-navy-950 shadow-sm outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-500/15"
          value={open ? query : (selected?.label ?? query)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (allowClear && e.target.value.trim() === "") {
              onChange("");
            }
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.label ?? "");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) =>
                filtered.length === 0 ? 0 : Math.min(h + 1, filtered.length - 1)
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const hit = filtered[highlight];
              if (hit) pick(hit);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery(selected?.label ?? "");
            }
          }}
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400"
          aria-hidden
        >
          ∨
        </span>
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {allowClear && value && (
            <li role="option">
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clear}
              >
                Clear selection
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">{emptyLabel}</li>
          ) : (
            filtered.map((opt, i) => (
              <li key={opt.id} role="option" aria-selected={opt.id === value}>
                <button
                  type="button"
                  className={`flex w-full px-3 py-2 text-left transition ${
                    i === highlight || opt.id === value
                      ? "bg-navy-50 text-navy-950"
                      : "text-navy-950 hover:bg-slate-50"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
