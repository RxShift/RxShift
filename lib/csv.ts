// Small CSV parser — handles quoted fields, embedded commas, and CRLF.
// Used by the staff import (client-side parse, server-side validate).

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  return rows;
}

/** Best-effort header → field guess for the import mapping UI. */
export function guessField(header: string): string | "" {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  if (/(fullname|name|employee)/.test(h) && !/(first|last)/.test(h)) return "full_name";
  if (/loginemail|login/.test(h)) return "login_email";
  if (/(workemail|email)/.test(h)) return "work_email";
  if (/(title|jobtitle|position)/.test(h)) return "job_title";
  if (/(ratiotype|type|role)/.test(h)) return "ratio_type";
  if (/(employment|employmenttype|status)/.test(h)) return "employment_type";
  return "";
}

/** Normalize free-text ratio type values from spreadsheets. */
export function normalizeRatioType(value: string): string {
  const v = value.toLowerCase().trim();
  if (/(pharmacist|rph|pharm)/.test(v)) return "pharmacist";
  if (/(tech|cpht)/.test(v)) return "technician";
  return "non_counting";
}

/** Normalize free-text employment type values. */
export function normalizeEmploymentType(value: string): string {
  const v = value.toLowerCase().trim();
  if (/per.?diem|prn/.test(v)) return "per_diem";
  if (/part/.test(v)) return "part_time";
  if (/(1099|contract)/.test(v)) return "contractor_1099";
  return "full_time";
}
