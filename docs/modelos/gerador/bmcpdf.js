const puppeteer = require('puppeteer')
const fs = require('fs')
const [src, out] = process.argv.slice(2)
;(async () => {
  const exe = process.env.CHROME_PATH || undefined
  const b = await puppeteer.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] })
  const p = await b.newPage()
  await p.goto('file://' + src, { waitUntil: 'load' })
  await p.pdf({ path: out, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true })
  await b.close()
  console.log('ok', out)
})()
