const zipInput = document.getElementById('zipInput');
const searchBtn = document.getElementById('searchBtn');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const locationNameEl = document.getElementById('locationName');
const currentTempEl = document.getElementById('currentTemp');
const nextWindowEl = document.getElementById('nextWindow');
const nextWindowTimeEl = document.getElementById('nextWindowTime');
const moreWindowsEl = document.getElementById('moreWindows');
const windowListEl = document.getElementById('windowList');
const noWindowsEl = document.getElementById('noWindows');
const afterWindowEl = document.getElementById('afterWindow');

searchBtn.addEventListener('click', handleSearch);
zipInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

async function handleSearch() {
  const zip = zipInput.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    showError('Please enter a valid 5-digit ZIP code.');
    return;
  }
  setLoading(true);
  hideError();
  hideResults();

  try {
    const { lat, lon, city, state } = await geocodeZip(zip);
    const weather = await fetchWeather(lat, lon);
    render(city, state, weather);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

async function geocodeZip(zip) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error(`ZIP code "${zip}" not found. Please try another.`);
  const data = await res.json();
  const place = data.places[0];
  return {
    lat: parseFloat(place.latitude),
    lon: parseFloat(place.longitude),
    city: place['place name'],
    state: place['state abbreviation'],
  };
}

async function fetchWeather(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('hourly', 'precipitation_probability,temperature_2m');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not fetch weather data. Please try again.');
  return res.json();
}

function render(city, state, weather) {
  const { time, precipitation_probability: precip, temperature_2m: temps } = weather.hourly;

  // Find the current hour index using the API's reported timezone offset
  const nowMs = Date.now();
  const tzOffset = weather.utc_offset_seconds * 1000;
  const localNow = new Date(nowMs + tzOffset);
  const currentHourStr = localNow.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"

  let startIdx = time.findIndex((t) => t.startsWith(currentHourStr));
  if (startIdx === -1) startIdx = 0;

  // Slice to remaining hours of the day
  const remainingTimes = time.slice(startIdx);
  const remainingPrecip = precip.slice(startIdx);
  const remainingTemps = temps.slice(startIdx);

  // Current temperature
  const currentTemp = Math.round(remainingTemps[0]);
  locationNameEl.textContent = `${city}, ${state}`;
  currentTempEl.textContent = `${currentTemp}°F`;

  // Build dry windows (consecutive blocks where precip < 15%)
  const DRY_THRESHOLD = 15;
  const windows = [];
  let blockStart = null;

  for (let i = 0; i < remainingTimes.length; i++) {
    const isDry = remainingPrecip[i] < DRY_THRESHOLD;
    if (isDry && blockStart === null) {
      blockStart = i;
    } else if (!isDry && blockStart !== null) {
      windows.push({ startIdx: blockStart, endIdx: i - 1, times: remainingTimes });
      blockStart = null;
    }
  }
  // Close any open block at end of day
  if (blockStart !== null) {
    windows.push({ startIdx: blockStart, endIdx: remainingTimes.length - 1, times: remainingTimes });
  }

  if (windows.length === 0) {
    nextWindowEl.hidden = true;
    moreWindowsEl.hidden = true;
    afterWindowEl.hidden = true;
    noWindowsEl.hidden = false;
  } else {
    noWindowsEl.hidden = true;
    nextWindowEl.hidden = false;
    nextWindowTimeEl.textContent = formatWindow(windows[0]);

    if (windows.length > 1) {
      windowListEl.innerHTML = '';
      windows.slice(1).forEach((w) => {
        const li = document.createElement('li');
        li.textContent = formatWindow(w);
        windowListEl.appendChild(li);
      });
      moreWindowsEl.hidden = false;
      afterWindowEl.hidden = true;
    } else {
      moreWindowsEl.hidden = true;
      afterWindowEl.textContent = `After ${getWindowEndLabel(windows[0])}, no dry windows remain today.`;
      afterWindowEl.hidden = false;
    }
  }

  resultsEl.hidden = false;
}

function getWindowEndLabel(win) {
  const endDate = new Date(win.times[win.endIdx]);
  endDate.setHours(endDate.getHours() + 1);
  return endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatWindow(win) {
  return `${formatHour(win.times[win.startIdx])} – ${getWindowEndLabel(win)}`;
}

function formatHour(isoStr) {
  // ISO string from Open-Meteo is local time (no Z), safe to parse as-is
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function setLoading(loading) {
  searchBtn.disabled = loading;
  searchBtn.textContent = loading ? 'Loading…' : 'Find Windows';
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

function hideResults() {
  resultsEl.hidden = true;
}
