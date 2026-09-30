// Neutralize spreadsheet formulas before exporting user controlled text.
export function exportCsv(filename: string, rows: string[][]) {
  const csv =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value
            return '"' + safe.replaceAll('"', '""') + '"'
          })
          .join(';'),
      )
      .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
