// utils/dateParser.js
export function parseDateFromDDMMYYYY(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => p.trim());
  // Basic numeric checks
  if (
    !/^\d{1,2}$/.test(day) ||
    !/^\d{1,2}$/.test(month) ||
    !/^\d{4}$/.test(year)
  ) {
    return null;
  }
  const iso = `${year.padStart(4, "0")}-${month.padStart(
    2,
    "0"
  )}-${day.padStart(2, "0")}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
