# C64-Pad

### Goal:
To Create a cross platform multi view editor for creating Commodore 64 graphics. Primary editing surfaces should be a "Sprite designer", a "Character designer" and a "Charmap designer".
Android tablet support should be its primary focus, as I want to create C64 graphics on Android tablet.  Ultimately, designs and sprites can be loaded directly in our own Assembly programs using 
my open source web based emulator: "c64-ready".


### Plan notes
- This applicaiton will be web based, and bundled as an android app using Capacitor, bundled as a Linux / Windows app as an Electron (or similar) app.

- Projects and designs will be savable locally or published to a future deployed environment.

- I have added some photos of a paper based Sprite / Character and Screen designer for creating these by hand at ./art/designs/.  Our app editors can loosely be modelled on these.

- The editor pages should limit the user with the boundaries of C64 colour, pixel and screen modes. So a knowledge of these will be necessary.

- Designs should have export options, but we can start with something simple then add options later.  A simple output of Screen could be the same as Charpad (a windows only C64 character map and charset editor). These axport as binary files importable via asm.  I'll need to provide examples if llm's struggle to get these themselves.


### Sitemap

- Homepage
- My Projects
- Charset editor
- Charmap editor
- Sprite designer



