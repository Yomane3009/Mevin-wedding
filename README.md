# Mevin-wedding
Wedding invitation website for Alvin Pritish Prince and Mega Dolorus.

A plain static site with no build step: `index.html`, `styles.css`, `script.js`
and `assets/`. Open `index.html` in a browser to preview it. Vercel deploys it as-is.

Guests land on the card wrapped in a vellum sleeve with a ribbon bow. Tapping it
(or dragging it up) pulls the card up out of the sleeve; the full invitation then pops free and settles
in place over a softly animated background (gold dust, petals and candle-light glow), followed by a
countdown and the ceremony and reception details with map and calendar links.

All wording lives in `index.html`. The countdown date is `data-date` on `#countdown`.

The background music (`assets/music.mp3`) is an original piano arrangement of
Pachelbel's Canon in D, a public-domain piece, synthesised by
`tools/compose_music.py`, so it is free of copyright. To regenerate it:
`python3 tools/compose_music.py music.wav && ffmpeg -i music.wav -b:a 128k assets/music.mp3`.
It starts when a guest opens the card and can be paused with the music button.
