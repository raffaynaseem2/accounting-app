"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("ellipsis");
  if (total > 1) pages.push(total);
  return pages;
}

export default function TablePagination({ page, totalPages, totalItems, pageSize, onPageChange }: Props) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = pageNumbers(page, totalPages);

  return (
    <div className="table-pagination">
      <span className="table-pagination-summary">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="table-pagination-controls">
        <button className="secondary-button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="table-pagination-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={p === page ? "pagination-page active" : "pagination-page"}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button className="secondary-button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
