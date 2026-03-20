let precipChart = null;

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
  url.searchParams.set('forecast_days', '2');

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
  const currentMinute = localNow.getUTCMinutes();

  let startIdx = time.findIndex((t) => t.startsWith(currentHourStr));
  if (startIdx === -1) startIdx = 0;

  // Slice to the next 24 hours (rolling window)
  const remainingTimes = time.slice(startIdx, startIdx + 24);
  const remainingPrecip = precip.slice(startIdx, startIdx + 24);
  const remainingTemps = temps.slice(startIdx, startIdx + 24);
  const todayStr = currentHourStr.slice(0, 10); // "YYYY-MM-DD"

  // If we're 30+ minutes into the current hour, the next hour's reading
  // is closer to actual current conditions than the current hour's slot.
  const tempOffset = currentMinute >= 30 ? 1 : 0;
  const currentTemp = Math.round(remainingTemps[tempOffset]);
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
    nextWindowTimeEl.textContent = formatWindow(windows[0], todayStr);

    if (windows.length > 1) {
      windowListEl.innerHTML = '';
      windows.slice(1).forEach((w) => {
        const li = document.createElement('li');
        li.textContent = formatWindow(w, todayStr);
        windowListEl.appendChild(li);
      });
      moreWindowsEl.hidden = false;
      afterWindowEl.hidden = true;
    } else {
      moreWindowsEl.hidden = true;
      afterWindowEl.textContent = `After ${getWindowEndLabel(windows[0], todayStr)}, no dry windows remain in the next 24 hours.`;
      afterWindowEl.hidden = false;
    }
  }

  renderChart(remainingTimes, remainingPrecip);
  resultsEl.hidden = false;
}

function renderChart(times, precip) {
  const labels = times.map((t) => {
    const d = new Date(t + 'Z');
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  });

  const barColors = precip.map((p) => (p < 15 ? '#5ba4d4' : '#e07070'));

  if (precipChart) precipChart.destroy();

  precipChart = new Chart(document.getElementById('precipChart'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Precip %',
          data: precip,
          backgroundColor: barColors,
          borderRadius: 3,
          order: 2,
        },
        {
          type: 'line',
          label: 'Dry threshold',
          data: new Array(24).fill(15),
          borderColor: '#e8a045',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2a35',
          titleColor: '#f0e8d8',
          bodyColor: '#8fa8bc',
          borderColor: '#2e4155',
          borderWidth: 1,
          callbacks: { label: (ctx) => `${ctx.parsed.y}%` },
        },
      },
      scales: {
        y: {
          min: 0, max: 50,
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#8fa8bc', stepSize: 5, callback: (v) => `${v}%` },
        },
        x: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#8fa8bc', maxRotation: 45, minRotation: 45 },
        },
      },
    },
  });
}

function getWindowEndLabel(win, todayStr) {
  const endIso = win.times[win.endIdx]; // e.g. "2026-03-19T23:00"
  let endHour = parseInt(endIso.slice(11, 13), 10) + 1;
  let endDateStr = endIso.slice(0, 10);

  if (endHour >= 24) {
    endHour = 0;
    const d = new Date(endDateStr + 'T12:00:00Z'); // noon UTC avoids DST edge cases
    d.setUTCDate(d.getUTCDate() + 1);
    endDateStr = d.toISOString().slice(0, 10);
  }

  // Append Z and use timeZone:'UTC' so the browser's local offset never interferes
  const display = new Date(`${endDateStr}T${String(endHour).padStart(2, '0')}:00:00Z`);
  const label = display.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  return endDateStr !== todayStr ? `${label} (tomorrow)` : label;
}

function formatWindow(win, todayStr) {
  return `${formatHour(win.times[win.startIdx], todayStr)} – ${getWindowEndLabel(win, todayStr)}`;
}

function formatHour(isoStr, todayStr) {
  // Append Z and use timeZone:'UTC' so the browser's local offset never interferes
  const d = new Date(isoStr + 'Z');
  const label = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  return isoStr.slice(0, 10) !== todayStr ? `${label} (tomorrow)` : label;
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
