"use client";

type Props = {
  label: string;
  sortKey: string;
  currentKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
};

export default function TableSortHeader({ label, sortKey, currentKey, sortDir, onSort }: Props) {
  const active = sortKey === currentKey;

  return (
    <button type="button" className={active ? "table-sort active" : "table-sort"} onClick={() => onSort(sortKey)}>
      {label}
      <span className="sort-indicator">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}
