// Centralized financial types and parsing/normalization helpers
// Branded types add compile-time clarity while remaining plain numbers at runtime

export type Money = number & { __brand: 'Money' };
export type MoneyMonthly = number & { __brand: 'MoneyMonthly' };
export type PercentFraction = number & { __brand: 'PercentFraction' }; // 0..1
export type Integer = number & { __brand: 'Integer' };
export type Year = number & { __brand: 'Year' };

// Type guards (runtime) and brand casters (compile-time)
export function asMoney(n: number): Money { return n as Money; }
export function asMoneyMonthly(n: number): MoneyMonthly { return n as MoneyMonthly; }
export function asPercent(n: number): PercentFraction { return n as PercentFraction; }
export function asInteger(n: number): Integer { return n as Integer; }
export function asYear(n: number): Year { return n as Year; }

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// Normalize a currency-like string: handle commas, spaces, symbols, parentheses for negatives
export function normalizeCurrencyString(raw: string): string {
  const s0 = raw.trim();
  let negative = false;
  let s = s0;
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[\s,]/g, '');
  // Remove currency symbols and any non-numeric except dot and minus
  s = s.replace(/[^0-9.\-]/g, '');
  if (negative && !s.startsWith('-')) s = '-' + s;
  return s;
}

export function parseMoney(input: unknown): Money | null {
  if (isFiniteNumber(input)) return asMoney(input);
  const s = String(input ?? '').trim();
  if (!s) return null;
  const norm = normalizeCurrencyString(s);
  const n = Number(norm);
  return Number.isFinite(n) ? asMoney(n) : null;
}

// Parse percent as fraction 0..1. Accepts '10%', 10, '0.1', 0.1
export function parsePercentFraction(input: unknown): PercentFraction | null {
  if (isFiniteNumber(input)) {
    const n = input;
    return asPercent(n > 1 ? n / 100 : n);
  }
  let s = String(input ?? '').trim();
  if (!s) return null;
  if (s.endsWith('%')) s = s.slice(0, -1);
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return asPercent(n > 1 ? n / 100 : n);
}

export function parseBoolean(input: unknown): boolean | null {
  if (typeof input === 'boolean') return input;
  const s = String(input ?? '').trim().toLowerCase();
  if (['true','yes','y','1'].includes(s)) return true;
  if (['false','no','n','0'].includes(s)) return false;
  return null;
}

export function parseIntegerFromText(input: unknown): Integer | null {
  if (isFiniteNumber(input)) return asInteger(Math.max(0, Math.floor(input)));
  const m = String(input ?? '').match(/-?\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (!Number.isFinite(n)) return null;
  return asInteger(n);
}

// Accept age or year-like strings and coerce to a Year
export function parseBirthYear(input: unknown): Year | null {
  const nowYear = new Date().getFullYear();
  if (isFiniteNumber(input)) {
    const n = Math.floor(input);
    if (n <= 150) return asYear(nowYear - Math.max(0, n)); // treat as age
    if (n >= 1900 && n <= 2100) return asYear(n);
    return null;
  }
  const s = String(input ?? '').trim();
  // age like '35 years'
  const ageMatch = s.match(/^(\d{1,3})\s*(years?|yrs?)?$/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (Number.isFinite(age)) return asYear(nowYear - Math.max(0, age));
  }
  const yMatch = s.match(/(19\d{2}|20\d{2})/);
  if (yMatch) return asYear(parseInt(yMatch[1], 10));
  return null;
}

// Generic parser for UI kinds
export function parseByKind(kind: 'money'|'percent'|'number'|'bool'|'text', raw: unknown) {
  switch (kind) {
    case 'bool': return parseBoolean(raw);
    case 'text': return String(raw ?? '').trim();
    case 'percent': return parsePercentFraction(raw);
    case 'money': {
      const m = parseMoney(raw);
      return m;
    }
    case 'number': {
      const s = String(raw ?? '').trim();
      const norm = normalizeCurrencyString(s);
      const n = Number(norm);
      return Number.isFinite(n) ? n : null;
    }
  }
}

