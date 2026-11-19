import { mkdir, writeFile } from 'node:fs/promises'
import {
  applicationReceivedTemplate,
  applicationApprovedTemplate,
} from '../lib/application-email-templates'

const folder = new URL('../artifacts/email-previews/', import.meta.url)
await mkdir(folder, { recursive: true })
for (const [name, content] of [
  ['application-received', applicationReceivedTemplate('Amina')],
  ['application-approved', applicationApprovedTemplate('Amina')],
] as const) {
  await writeFile(new URL(`${name}.html`, folder), content.html)
  await writeFile(new URL(`${name}.txt`, folder), content.text)
}
await writeFile(
  new URL('index.html', folder),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VacayNanny email previews</title><body style="font-family:system-ui;max-width:650px;margin:50px auto;padding:24px;background:#FFF8EF;color:#17324D"><h1>VacayNanny email previews</h1><p>Review copies using a sample name. No messages have been sent. The approval preview shows the supplied wording; the actual email attaches the final agreement PDF once configured.</p><p><a href="application-received.html">Application received</a></p><p><a href="application-approved.html">Application approved</a></p></body></html>`,
)
console.log(
  'Saved email previews to artifacts/email-previews/index.html. No email was sent.',
)
