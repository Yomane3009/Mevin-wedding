# Mevin-wedding
Wedding invitation website for Alvin Pritish Prince and Mega Dolorus.

A plain static site with no build step: `index.html`, `styles.css`, `script.js`
and `assets/`. Open `index.html` in a browser to preview it. Vercel deploys it as-is.

Guests land on the card in a vellum sleeve tied with a raw-edged chiffon ribbon and
bow like the printed card. Each piece of the bow is a painted image in
`assets/ribbon/` (made by `python3 tools/make_ribbon.py`) that `script.js` moves on a
canvas. As the page loads the bow unties by itself: the
loops slip through the knot, the ribbon falls away, and the full invitation pops up
out of the sleeve over a softly animated gold background. The page then glides down
once through the countdown and the ceremony and reception details (with map and
calendar links); any touch, wheel or key stops it so guests can scroll themselves.

The engagement highlight film (`assets/video/engagement.mp4`, re-encoded for the
web) loops nonstop in a frame near the bottom. A small copy of it
(`engagement-bg.mp4`) runs blurred and washed in gold behind the whole page, kept in
step with the framed film. Turning the film's sound on pauses the background music.

All wording lives in `index.html`. The countdown date is `data-date` on `#countdown`.

The background music (`assets/music.mp3`) is an original piano arrangement of
Pachelbel's Canon in D, a public-domain piece, synthesised by
`tools/compose_music.py`, so it is free of copyright. To regenerate it:
`python3 tools/compose_music.py music.wav && ffmpeg -i music.wav -b:a 128k assets/music.mp3`.
It fades in as the card opens (or at the guest's first touch, if the browser
blocks sound until then) and can be paused with the music button.
