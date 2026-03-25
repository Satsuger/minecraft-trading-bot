const COMPACT_NUMBER_SUFFIXES = [
  { suffix: "b", multiplier: 1_000_000_000 },
  { suffix: "m", multiplier: 1_000_000 },
  { suffix: "k", multiplier: 1_000 },
] as const;

export const decodeCompactNumber = (value?: string) => {
  if (!value?.trim()) return;

  const normalizedValue = value.trim().toLowerCase();
  const suffixConfig = COMPACT_NUMBER_SUFFIXES.find(({ suffix }) =>
    normalizedValue.endsWith(suffix),
  );
  const numericPart = suffixConfig
    ? normalizedValue.slice(0, -1).replace(",", ".")
    : normalizedValue.replace(/,/g, "");
  const parsedNumber = Number.parseFloat(numericPart);

  if (Number.isNaN(parsedNumber)) return;
  if (!suffixConfig) return parsedNumber;

  return Math.round(parsedNumber * suffixConfig.multiplier);
};

export const encodeCompactNumber = (value: number) => {
  const absoluteValue = Math.abs(value);
  const suffixConfig = COMPACT_NUMBER_SUFFIXES.find(
    ({ multiplier }) => absoluteValue >= multiplier,
  );

  if (!suffixConfig) return `${value}`;

  const normalizedValue = value / suffixConfig.multiplier;
  const formattedValue = Number.isInteger(normalizedValue)
    ? `${normalizedValue}`
    : normalizedValue.toFixed(1).replace(/\.0$/, "");

  return `${formattedValue}${suffixConfig.suffix}`;
};
