# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step or dependencies. Open `index.html` directly in a browser:

- Double-click `index.html` in File Explorer, or
- Drag it into a browser window, or
- `open index.html` (Mac/Linux)

## Architecture

This is a single-page vanilla JS app with no framework, bundler, or dependencies. Three files:

- `index.html` — static markup with all result sections pre-rendered but hidden via the `hidden` attribute
- `style.css` — all styling
- `app.js` — all logic; runs entirely in the browser, no backend

**Data flow in `app.js`:**

1. `handleSearch()` validates the zip, then calls `geocodeZip()` → `fetchWeather()` → `render()`
2. `geocodeZip(zip)` hits `https://api.zippopotam.us/us/{zip}` to get lat/lon/city/state — no API key needed
3. `fetchWeather(lat, lon)` hits `https://api.open-meteo.com/v1/forecast` for hourly `precipitation_probability` and `temperature_2m` (Fahrenheit, `forecast_days=2`, `timezone=auto`) — no API key needed. Two days are fetched so there is always a full 24-hour lookahead regardless of time of day.
4. `render()` uses `weather.utc_offset_seconds` from the Open-Meteo response to find the current hour index, then slices exactly 24 entries (`startIdx` to `startIdx + 24`) to form a rolling window. Results are written into pre-existing DOM elements by toggling their `hidden` attribute.

**Dry window logic:** A "window" is a consecutive run of hours with `precipitation_probability < 15`. The first window is shown prominently as "Next dry window". If only one window exists, an `afterWindow` message notes no windows remain in the next 24 hours. If no windows exist at all, `noWindows` is shown.

**Time handling:** Open-Meteo returns ISO timestamps in the location's local time (no `Z` suffix), so they are safe to parse directly with `new Date()` for display. The current hour is found by converting `Date.now()` using `utc_offset_seconds`. `formatHour()` and `getWindowEndLabel()` both accept a `todayStr` (`"YYYY-MM-DD"`) and append `(tomorrow)` to any time that falls on the next calendar day.
