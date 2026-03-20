# Window Finder

A simple weather web app that helps dog owners find dry walking windows throughout the day.

## What it does

Enter a US zip code and Window Finder will:

- Show the **current temperature** (°F) for your location
- Display the **next consecutive dry window** — the next block of hours where precipitation probability stays under 15%
- List any **additional dry windows** in the next 24 hours
- Show a clear message if **no dry windows** exist in the next 24 hours

## How to use it

1. Open `index.html` in any modern web browser
2. Type your 5-digit US zip code into the input field
3. Click **Find Windows** (or press Enter)
4. Your current conditions and dry walking windows will appear below

No account, login, or installation required.

## How to run it

No build step or server needed — it runs entirely in the browser.

Just open `index.html` directly:

- **Mac/Linux:** `open index.html`
- **Windows:** double-click `index.html` in File Explorer, or drag it into a browser window

## APIs used

| API | Purpose | Auth required |
|---|---|---|
| [Zippopotam.us](https://api.zippopotam.us) | Converts US zip code to latitude/longitude and city name | None |
| [Open-Meteo](https://open-meteo.com) | Fetches hourly precipitation probability and temperature forecast | None |

Both APIs are free and require no API key.
