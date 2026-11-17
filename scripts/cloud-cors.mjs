#!/usr/bin/env node
// Let the app reach a DigitalOcean Space from the browser and the Android
// WebView (see docs/cloud.md). Run once per Space:
//
//   SPACES_REGION=lon1 SPACES_BUCKET=my-space \
//   SPACES_KEY=… SPACES_SECRET=… node scripts/cloud-cors.mjs [extra origins…]
import { createHash } from 'node:crypto'
import { AwsClient } from 'aws4fetch'

const { SPACES_REGION, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET } = process.env
if (!SPACES_REGION || !SPACES_BUCKET || !SPACES_KEY || !SPACES_SECRET) {
  console.error(
    'Set SPACES_REGION, SPACES_BUCKET, SPACES_KEY and SPACES_SECRET.',
  )
  process.exit(1)
}

const origins = [
  'https://localhost', // the Android app (Capacitor's WebView)
  'http://localhost:3000', // npm run dev
  ...process.argv.slice(2),
]

const body = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
${origins.map((o) => `    <AllowedOrigin>${o}</AllowedOrigin>`).join('\n')}
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`

const aws = new AwsClient({
  accessKeyId: SPACES_KEY,
  secretAccessKey: SPACES_SECRET,
  service: 's3',
  region: 'us-east-1',
})
const res = await aws.fetch(
  `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com/?cors`,
  {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': 'application/xml',
      'Content-MD5': createHash('md5').update(body).digest('base64'),
    },
  },
)
if (!res.ok) {
  console.error(`Failed: ${res.status}\n${await res.text()}`)
  process.exit(1)
}
console.log(`CORS set on ${SPACES_BUCKET} for:\n  ${origins.join('\n  ')}`)
