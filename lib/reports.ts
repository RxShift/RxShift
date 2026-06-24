import "server-only";
import * as XLSX from "xlsx";

/**
 * Build an .xlsx download Response from row objects. Column headers come
 * from the object keys, in key order — build rows with the headers you
 * want shown.
 */
export function xlsxResponse(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string
): Response {
  const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);

  // Reasonable column widths from content
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  sheet["!cols"] = keys.map((k) => ({
    wch: Math.min(
      60,
      Math.max(
        k.length + 2,
        ...rows.slice(0, 200).map((r) => String(r[k] ?? "").length + 2)
      )
    ),
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Like xlsxResponse but with multiple tabs (e.g. a detail sheet + summary tabs). */
export function xlsxMultiSheet(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string
): Response {
  const book = XLSX.utils.book_new();
  for (const s of sheets) {
    const sheet = XLSX.utils.json_to_sheet(s.rows.length > 0 ? s.rows : [{}]);
    const keys = s.rows.length > 0 ? Object.keys(s.rows[0]) : [];
    sheet["!cols"] = keys.map((k) => ({
      wch: Math.min(
        60,
        Math.max(
          k.length + 2,
          ...s.rows.slice(0, 200).map((r) => String(r[k] ?? "").length + 2)
        )
      ),
    }));
    XLSX.utils.book_append_sheet(book, sheet, s.name.slice(0, 31));
  }
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
