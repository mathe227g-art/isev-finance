"use client";

import { useState } from "react";

export function formatMoneyInput(value: string, allowNegative = false) {
  const negative = allowNegative && value.trim().startsWith("-");
  const digits = value.replace(/\D/g, "").slice(0, 18);
  if (!digits) return `${negative ? "- " : ""}R$ 0,00`;
  const cents = digits.padStart(3, "0");
  const whole = BigInt(cents.slice(0, -2)).toLocaleString("pt-BR");
  return `${negative ? "- " : ""}R$ ${whole},${cents.slice(-2)}`;
}

export function MoneyInput({
  name,
  defaultValue = "",
  required = true,
  allowNegative = false,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  allowNegative?: boolean;
}) {
  const [value, setValue] = useState(() =>
    defaultValue ? formatMoneyInput(defaultValue, allowNegative) : "R$ 0,00",
  );
  return (
    <input
      name={name}
      inputMode="numeric"
      value={value}
      required={required}
      aria-label="Valor em reais"
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) =>
        setValue(formatMoneyInput(event.target.value, allowNegative))
      }
    />
  );
}
