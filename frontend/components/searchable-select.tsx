"use client";

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
  const display = options.find((o) => o.value === value)?.label ?? value;
  return (
    <label className="field">
      {label}
      <input
        required={required}
        list={disabled ? undefined : listId}
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        readOnly={disabled}
        onChange={(event) => {
          const found = options.find(
            (o) => o.label.toLowerCase() === event.target.value.toLowerCase() || o.value === event.target.value,
          );
          onChange(found?.value ?? "");
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
