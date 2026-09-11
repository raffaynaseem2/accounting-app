"use client";

import { useEffect, useState } from "react";

export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  required = false,
  placeholder = "Search...",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; search?: string }>;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = `options-${label.replace(/\W/g, "-")}`;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const [query, setQuery] = useState(selectedLabel);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  return (
    <label className="field">
      {label}
      <input
        required={required}
        list={disabled ? undefined : listId}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        readOnly={disabled}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          const found = options.find(
            (o) => o.label.toLowerCase() === nextQuery.toLowerCase() || o.value === nextQuery,
          );
          if (found) onChange(found.value);
          else if (!nextQuery) onChange("");
        }}
      />
      {!disabled ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.value} value={option.label}>{option.search}</option>
          ))}
        </datalist>
      ) : null}
    </label>
  );
}
