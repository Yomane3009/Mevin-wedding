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
(`engagement-bg.mp4`, made by `sh tools/make_backdrop.sh` with the blur and gold tint
baked in so phones scroll smoothly) runs behind the whole page, kept in step with the
framed film.

All wording lives in `index.html`. The countdown date is `data-date` on `#countdown`.

The film's own soundtrack is the site's music. It fades in as the card opens (or at
the guest's first touch, since browsers block sound until then) and the note button
turns it off and on.
