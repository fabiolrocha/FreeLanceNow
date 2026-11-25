// One content model, two outputs: an editable DOCX (docx-js) and a PDF (HTML printed by Chrome).
// Blocks: {h1|h2|h3: text} {p: text} {ul: [..]} {table: rows, rel, cap, size} {fig: file, cap, maxH} {pb: true}
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, LevelFormat, ImageRun, PageBreak, TableOfContents, Header, Footer, PageNumber, BorderStyle,
} = require('docx')

const ROOT = path.resolve(__dirname, '../../..')
const MODELOS = path.join(ROOT, 'docs/modelos/png')
const FONT = 'Arial'
const PAGE_W = 11906
const MARGIN = 1134
const CONTENT_W = PAGE_W - 2 * MARGIN
const NAVY = '1F3864'
const MEMBERS = [
  'Arthur Almirante Simões',
  'Arthur de Oliveira Sousa',
  'Caio Rafael Alves de Sousa',
  'Enzo Freitas Lima',
  'Fábio Luiz Cardoso Laranjeira Rocha',
  'Felipe Alves Muniz',
]

const imgPath = (f) => (f.startsWith('/') ? f : path.join(MODELOS, f))
function pngSize(file) {
  const b = fs.readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

// ---------- DOCX ----------
function runs(text, opts = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...opts }))
    const t = m[0]
    if (t.startsWith('**')) out.push(new TextRun({ ...opts, text: t.slice(2, -2), bold: true }))
    else out.push(new TextRun({ ...opts, text: t.slice(1, -1), font: 'Consolas', size: (opts.size || 22) - 2 }))
    last = m.index + t.length
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...opts }))
  return out
}
const caption = (t) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new TextRun({ text: t, italics: true, size: 19, color: '444444' })] })

function dCell(text, width, o) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: String(text).split('\n').map((line) => new Paragraph({ spacing: { before: 20, after: 20 }, children: runs(line, { size: o.size, bold: o.bold, color: o.color }) })),
  })
}
function dTable(rows, rel, size = 19) {
  const total = rel.reduce((a, b) => a + b, 0)
  const widths = rel.map((r) => Math.floor((r / total) * CONTENT_W))
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0)
  const border = { style: BorderStyle.SINGLE, size: 4, color: '8EA9DB' }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: rows.map((r, i) =>
      new TableRow({
        tableHeader: i === 0,
        cantSplit: true,
        children: r.map((c, j) => (i === 0 ? dCell(c, widths[j], { bold: true, fill: NAVY, color: 'FFFFFF', size }) : dCell(c, widths[j], { fill: i % 2 === 0 ? 'F2F5FB' : undefined, size }))),
      }),
    ),
  })
}
function dFigure(file, cap, maxHcm = 20) {
  const full = imgPath(file)
  const { w, h } = pngSize(full)
  let width = (CONTENT_W / 1440) * 96
  let height = (h / w) * width
  const maxH = (maxHcm / 2.54) * 96
  if (height > maxH) {
    height = maxH
    width = (w / h) * height
  }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(full), transformation: { width: Math.round(width), height: Math.round(height) }, altText: { title: cap, description: cap, name: path.basename(full) } })],
    }),
    caption(cap),
  ]
}
function dCover(c) {
  const line = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 120 }, children: [new TextRun({ text: t, ...o })] })
  return [
    new Paragraph({ spacing: { before: 1600 }, children: [] }),
    line('FreeLanceNow', { size: 56, bold: true, color: NAVY, after: 200 }),
    line(c.title, { size: 40, bold: true, after: 120 }),
    line(c.subtitle || '', { size: 26, color: '555555', after: 600 }),
    line(`Versão ${c.version} — ${c.date}`, { size: 24, after: 800 }),
    line('Soluções Computacionais — 2026/2', { size: 22, bold: true, after: 80 }),
    line('Turma GPE17M80586 — Equipe FreeLanceNow', { size: 22, after: 240 }),
    ...MEMBERS.map((m) => line(m, { size: 21, after: 40 })),
    ...(c.extra || []).map((t) => line(t, { size: 20, color: '555555', after: 40 })),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}
function toDocx(doc) {
  const kids = [...dCover(doc.cover)]
  kids.push(new Paragraph({ children: [new TextRun({ text: 'Sumário', bold: true, size: 32, color: NAVY })], spacing: { after: 200 } }))
  kids.push(new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }))
  kids.push(new Paragraph({ children: [new TextRun({ text: 'No Word, clique com o botão direito no sumário e escolha "Atualizar campo" para numerar as páginas.', italics: true, size: 17, color: '888888' })] }))
  kids.push(new Paragraph({ children: [new PageBreak()] }))
  for (const b of doc.blocks) {
    if (b.h1) kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: !!b.newPage, children: [new TextRun(b.h1)] }))
    else if (b.h2) kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.h2)] }))
    else if (b.h3) kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(b.h3)] }))
    else if (b.p) kids.push(new Paragraph({ children: runs(b.p), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 300 } }))
    else if (b.ul) b.ul.forEach((t) => kids.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: runs(t), spacing: { after: 60, line: 280 } })))
    else if (b.table) {
      kids.push(dTable(b.table, b.rel, b.size ? b.size * 2 : 19))
      kids.push(b.cap ? caption(b.cap) : new Paragraph({ spacing: { after: 160 }, children: [] }))
    } else if (b.fig) kids.push(...dFigure(b.fig, b.cap, b.maxH))
    else if (b.pb) kids.push(new Paragraph({ children: [new PageBreak()] }))
  }
  const d = new Document({
    creator: 'Equipe FreeLanceNow',
    title: `${doc.cover.title}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, keepLines: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, keepLines: true, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, keepLines: true, outlineLevel: 2 } },
      ],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 567, footer: 567 } }, titlePage: true },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '8EA9DB', space: 4 } }, children: [new TextRun({ text: `FreeLanceNow — ${doc.cover.title}`, size: 17, color: '666666' })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 17, color: '666666' })] })] }) },
        children: kids,
      },
    ],
  })
  return Packer.toBuffer(d)
}

// ---------- HTML / PDF ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
const CSS = `
@page { size: A4; margin: 2cm 2cm 2cm 2cm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; }
h1 { font-size: 16pt; color: #1F3864; margin: 18pt 0 8pt; page-break-after: avoid; }
h1.newpage { page-break-before: always; }
h2 { font-size: 13pt; color: #1F3864; margin: 14pt 0 6pt; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #2F5496; margin: 10pt 0 5pt; page-break-after: avoid; }
p { text-align: justify; margin: 0 0 6pt; }
ul { margin: 0 0 8pt 0; padding-left: 18pt; } li { margin-bottom: 3pt; }
code { font-family: Consolas, Menlo, monospace; font-size: 9.5pt; background: #f2f2f2; padding: 0 2px; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 2pt; font-size: 9.5pt; page-break-inside: auto; table-layout: fixed; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th { background: #1F3864; color: #fff; text-align: left; padding: 4px 6px; border: 1px solid #8EA9DB; }
td { padding: 3px 6px; border: 1px solid #8EA9DB; vertical-align: top; overflow-wrap: anywhere; }
tbody tr:nth-child(even) td { background: #F2F5FB; }
.cap { text-align: center; font-style: italic; font-size: 9.5pt; color: #444; margin: 3pt 0 12pt; }
figure { margin: 8pt 0 0; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; }
.cover { height: 25cm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
.cover .brand { font-size: 28pt; font-weight: bold; color: #1F3864; }
.cover .title { font-size: 20pt; font-weight: bold; margin-top: 8pt; }
.cover .sub { font-size: 13pt; color: #555; margin-top: 6pt; }
.cover .ver { margin-top: 36pt; font-size: 12pt; }
.cover .team { margin-top: 48pt; font-size: 10.5pt; line-height: 1.6; }
.toc { page-break-after: always; } .toc h1 { margin-top: 0; }
.toc ol { list-style: none; padding-left: 0; } .toc li.l2 { padding-left: 16pt; font-size: 10pt; }
.toc a { color: #111; text-decoration: none; }
`
function toHtml(doc) {
  const c = doc.cover
  let ids = 0
  const tocItems = []
  const body = []
  for (const b of doc.blocks) {
    if (b.h1 || b.h2) {
      const id = 's' + ++ids
      tocItems.push(`<li class="${b.h1 ? 'l1' : 'l2'}"><a href="#${id}">${esc(b.h1 || b.h2)}</a></li>`)
      body.push(b.h1 ? `<h1 id="${id}"${b.newPage ? ' class="newpage"' : ''}>${esc(b.h1)}</h1>` : `<h2 id="${id}">${esc(b.h2)}</h2>`)
    } else if (b.h3) body.push(`<h3>${esc(b.h3)}</h3>`)
    else if (b.p) body.push(`<p>${inline(b.p)}</p>`)
    else if (b.ul) body.push(`<ul>${b.ul.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`)
    else if (b.table) {
      const total = b.rel.reduce((a, x) => a + x, 0)
      const cols = b.rel.map((r) => `<col style="width:${((r / total) * 100).toFixed(1)}%">`).join('')
      const cellHtml = (t) => inline(t).replace(/\n/g, '<br>')
      body.push(`<table style="${b.size ? `font-size:${b.size}pt` : ''}"><colgroup>${cols}</colgroup><thead><tr>${b.table[0].map((h) => `<th>${cellHtml(h)}</th>`).join('')}</tr></thead><tbody>${b.table.slice(1).map((r) => `<tr>${r.map((x) => `<td>${cellHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      body.push(b.cap ? `<div class="cap">${esc(b.cap)}</div>` : '<div style="height:8pt"></div>')
    } else if (b.fig) {
      const full = imgPath(b.fig)
      const maxH = b.maxH || 20
      body.push(`<figure><img src="data:image/png;base64,${fs.readFileSync(full).toString('base64')}" style="max-height:${maxH}cm"><div class="cap">${esc(b.cap)}</div></figure>`)
    } else if (b.pb) body.push('<div style="page-break-after:always"></div>')
  }
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(c.title)}</title><style>${CSS}</style></head><body>
<div class="cover"><div class="brand">FreeLanceNow</div><div class="title">${esc(c.title)}</div><div class="sub">${esc(c.subtitle || '')}</div><div class="ver">Versão ${esc(c.version)} — ${esc(c.date)}</div>
<div class="team"><b>Soluções Computacionais — 2026/2</b><br>Turma GPE17M80586 — Equipe FreeLanceNow<br><br>${MEMBERS.map(esc).join('<br>')}${(c.extra || []).length ? '<br><br>' + c.extra.map(esc).join('<br>') : ''}</div></div>
<div class="toc"><h1>Sumário</h1><ol>${tocItems.join('')}</ol></div>
${body.join('\n')}
</body></html>`
}

async function toPdf(html, out, title) {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
    headerTemplate: `<div style="font-size:8px;color:#666;width:100%;text-align:right;margin:0 2cm;font-family:Arial">FreeLanceNow — ${esc(title)}</div>`,
    footerTemplate: '<div style="font-size:8px;color:#666;width:100%;text-align:center;font-family:Arial">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
  })
  await browser.close()
}

async function render(doc, outBase) {
  fs.writeFileSync(outBase + '.docx', await toDocx(doc))
  const html = toHtml(doc)
  await toPdf(html, outBase + '.pdf', doc.cover.title)
  console.log('ok', outBase)
}

module.exports = { render, MEMBERS }
