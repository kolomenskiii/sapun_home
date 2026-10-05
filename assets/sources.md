# Asset sources

- `frames/*.jpg`: supplied local `kling_20261002_Image_to_Video_Transform__4429_0.mp4`, extracted with AVFoundation at 24 fps; 1600 × 1199; 123 frames. Original video preserved.
- `after.jpg`: frame 0122.
- `logo.png`: built-in Imagegen, user-provided screenshot as reference. Prompt: “Create a clean isolated reproduction of ONLY the existing logo at the top left of the screenshot: very thin charcoal square frame with the exact elegant thin monogram S H inside, then spaced SAPUN and smaller HOME underneath. Preserve the reference's monogram proportions and delicate linework. Not a new logo design. Flat warm cream background #f4eee7, charcoal #393c33. Center the logo lockup with modest padding in a square image. No other content, no shadows, no textures.”
- `detail-light.png`: built-in Imagegen. Prompt: “Editorial architectural photograph, portrait ratio 4:5, warm cream minimalist living room with natural daylight through sheer linen curtains, curved cream sofa, oak floor, subtle olive branch, cropped intimate composition. High-end real interior photo, neutral ivory taupe olive palette, not glossy CGI, no text/logos.”
- `detail-texture.png`: built-in Imagegen. Prompt: “Editorial interior photograph portrait 4:5 close-up tactile natural oatmeal linen sofa cushions, soft textured throw, corner of warm oak side table with handmade ceramic cup, quiet natural daylight. Warm ivory cream taupe subtle olive palette. Beautiful restrained interior styling magazine photograph, believable material texture, no text/logos.”
- `detail-balance.png`: built-in Imagegen. Prompt: “Editorial interior photograph portrait 4:5 a sculptural matte ivory ceramic vase with one airy olive branch on a simple natural light oak console, two art books and tiny dark stone bowl, warm cream plaster wall, slanting soft afternoon sunlight. Quiet restrained luxury interior styling, real photo material qualities, muted ivory olive natural oak palette, no text/logos or legible book lettering.”
- `detail-*.jpg`: resized and JPEG-compressed copies for the website; original PNGs retained.

Typography uses local Helvetica Neue / Arial and Georgia / Times New Roman. No third-party fonts, icons, libraries, or remote assets are loaded by the website.

## Redesign — 2026-10-05

- `logo.svg`: user-supplied vector logo, used without path modification in header, footer and favicon. Supersedes the generated `logo.png`; the older file is retained but unused.
- `anastasia-sapun.jpg`: unmodified copy of user-provided `Downloads/обо мне.jpg`.
- Layout/style references: `Downloads/референс.jpg`, `референс11.jpg`, `референс12.jpg`. Service and biography copy adapted from the other supplied references and `обо мне1.jpg`; these are content sources, not background artwork.
- `arrow-right.svg`, `arrow-up-right.svg`: Bootstrap Icons, https://github.com/twbs/icons, MIT license in `BOOTSTRAP-ICONS-LICENSE.txt`. Used locally as CSS masks so icons inherit link state colors.
- Updated typography: system Times New Roman / Times for display headings, Helvetica Neue / Arial for interface and body text. No font network requests.
