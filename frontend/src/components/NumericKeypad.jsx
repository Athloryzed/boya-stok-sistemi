import React from "react";
import { Delete } from "lucide-react";

/**
 * Paylaşılan sayısal tuş takımı — Hızlı Mod (PaintFlow) gibi dokunmatik,
 * hızlı miktar girişi gereken akışlar için. Controlled: value/onChange
 * dışında hiçbir state tutmaz. Her tuş min 48px (h-14 = 56px).
 */
export default function NumericKeypad({ value, onChange, className = "" }) {
  const press = (key) => {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (value.includes(".")) return;
      onChange((value || "0") + ".");
      return;
    }
    if (value === "0") {
      onChange(key);
      return;
    }
    onChange((value || "") + key);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`} data-testid="numeric-keypad">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          data-testid={`keypad-${k}`}
          className="h-14 rounded-xl text-xl font-bold bg-surface-highlight text-text-primary border border-border hover:border-primary/50 active:bg-primary/20 transition-colors flex items-center justify-center"
        >
          {k === "back" ? <Delete className="h-5 w-5" /> : k}
        </button>
      ))}
    </div>
  );
}
