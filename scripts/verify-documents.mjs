import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const root = new URL('../', import.meta.url)
const records = JSON.parse(await readFile(new URL('docs/referencias/inventario.json', root), 'utf8'))
for (const record of records) {
  const path = new URL(record.preserved_path, root)
  const bytes = await readFile(path)
  if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) {
    throw new Error(`Documento alterado: ${fileURLToPath(path)}`)
  }
}
console.log(`${records.length} documentos/fontes preservados com tamanho e SHA-256 originais.`)
