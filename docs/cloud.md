# Cloud (personal)

Projects can be kept in a DigitalOcean Space so they move between devices
without exporting files. This is for one person's own Space: each device has
the keys typed into **Cloud → Settings**, and they're stored only on that
device. A cloud plan for everyone is a separate job.

## Setting up a Space

1. Create a Space (private, any region), e.g. `lon1`.
2. Create a Spaces access key limited to that Space (read and write).
3. Allow the app's origins (CORS), once:

   ```sh
   SPACES_REGION=lon1 SPACES_BUCKET=my-space \
   SPACES_KEY=… SPACES_SECRET=… node scripts/cloud-cors.mjs
   ```

   That allows `https://localhost` (the Android app) and
   `http://localhost:3000` (`npm run dev`); pass any other origin the web
   app is served from as an argument. If the key isn't allowed to change
   CORS, add the same rule in the control panel (Space → Settings → CORS):
   those origins, methods GET, PUT, DELETE, HEAD, allowed header `*`.

4. In the app: **Cloud**, then enter the region, Space name and keys.

## How it works

- Each project is `<folder>/<id>.c64pad` (the export format) plus
  `<folder>/<id>.json`, a summary for the cloud list.
- Nothing syncs by itself: **Save to cloud** on a project, and **Cloud →
  Open / Download** to bring one to this device.
- Each device remembers the version it last saved or opened, so it knows
  which side changed. Saving or opening asks first if it would overwrite
  changes the other side doesn't have; opening offers **Keep both**.
- Tracing images aren't in projects, so they don't travel.
