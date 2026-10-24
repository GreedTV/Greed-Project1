# Sinners

A gaming and streaming website built with plain HTML, CSS and JavaScript.

Live at https://greedtv.github.io/Greed-Project1/

## Pages

- `index.html`: home page with live/next-stream badge, stats, latest clips and socials
- `schedule.html`: weekly stream schedule (today is highlighted automatically)
- `gallery.html`: filterable image gallery with a click-to-enlarge viewer
- `about.html`: about, setup and collab info

## Other files

- `styles.css`: colors, layout and animations
- `script.js`: menu, scroll animations, live badge, gallery filters and viewer
- `images/`: gallery and clip images

## Editing

- **Colors:** change `--accent` and `--accent-2` at the top of `styles.css`.
- **Social links:** replace the `href="#"` links (marked with comments) in each page.
- **Schedule:** edit the rows in `schedule.html`, and update the `STREAMS` list at the top of `script.js` so the home page badge matches.
- **Gallery:** add an image to `images/`, then copy one `<button class="gallery-item">` block in `gallery.html`. The `data-category` value must match a filter button.
- **Stats:** change the `data-count` numbers in `index.html`.

## Run it locally

Open `index.html` in a browser, or run `python -m http.server` in this folder and visit http://localhost:8000.
