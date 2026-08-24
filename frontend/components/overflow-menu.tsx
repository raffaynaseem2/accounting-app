"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type MenuItem = { label: string; onClick: () => void; danger?: boolean };

export default function OverflowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 150) });
    };

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || popover.current?.contains(target)) return;
      setOpen(false);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("mousedown", close);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        className="icon-button overflow-trigger"
        aria-label="More actions"
        title="More actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        ⋯
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popover}
              className="overflow-popover overflow-popover-portal"
              style={{ top: position.top, left: position.left }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  className={item.danger ? "overflow-item danger-text" : "overflow-item"}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
