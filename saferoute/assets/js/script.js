// SafeRoute — Day 3, Step 3
// Inline card expansion + Emergency Mode collapse + Advanced markers + trip switcher.

let map;
let emergencyMode = false;
let activeRouteId = "quickest";
let expandedRouteId = null;
let currentTripId = "jubilee-hitech";
let allTrips = null;

const routePolylines = {};
const routeMarkers = {};
let routeData = null;

async function initMap() {
  const HYDERABAD_CENTER = { lat: 17.4410, lng: 78.4440 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: HYDERABAD_CENTER,
    zoom: 13,
    mapId: "SAFEROUTE_DEMO_MAP",
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: "greedy",
    styles: LIGHT_MAP_STYLE
  });

  wireEmergencyToggle();
  wireWhySheet();

  // Load all trips once
  const res = await fetch("assets/data/routes.json");
  const data = await res.json();
  allTrips = data.trips;

  // Build trip switcher
  renderTripSwitcher();

  // Load the default trip
  await loadTrip(currentTripId);
}

/* -----------------------------------------------------------
   Data
----------------------------------------------------------- */
async function loadRoutes() {
  routeData = allTrips.find(t => t.id === currentTripId);
}

/* -----------------------------------------------------------
   Trip switcher
----------------------------------------------------------- */
function renderTripSwitcher() {
  const container = document.getElementById("trip-switcher");

  if (!container.dataset.built) {
    container.innerHTML = allTrips.map(trip => `
      <button class="trip-pill" data-trip-id="${trip.id}">
        ${trip.label}
      </button>
    `).join("");

    container.querySelectorAll(".trip-pill").forEach(pill => {
      pill.addEventListener("click", () => loadTrip(pill.dataset.tripId));
    });

    container.dataset.built = "true";
  }

  // Update active pill
  container.querySelectorAll(".trip-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.tripId === currentTripId);
  });
}

async function loadTrip(tripId) {
  currentTripId = tripId;

  clearMap();
  await loadRoutes();
  await drawRoutes();
  renderRouteCards();
  renderTripSwitcher();
  setActiveRoute("quickest");

  // Update search bar to match current trip
  document.getElementById("origin").value = routeData.origin;
  document.getElementById("destination").value = routeData.destination;

  console.log("[SafeRoute] Loaded trip:", tripId);
}

/* -----------------------------------------------------------
   Map cleanup between trips
----------------------------------------------------------- */
function clearMap() {
  Object.values(routePolylines).forEach(p => p.setMap(null));
  Object.keys(routePolylines).forEach(k => delete routePolylines[k]);

  Object.values(routeMarkers).forEach(m => { m.map = null; });
  Object.keys(routeMarkers).forEach(k => delete routeMarkers[k]);

  const banner = document.getElementById("emergency-banner");
  if (banner) banner.remove();

  if (emergencyMode) {
    emergencyMode = false;
    document.getElementById("emergency-toggle")
      .setAttribute("aria-pressed", "false");
    document.body.classList.remove("emergency");
  }

  expandedRouteId = null;
}

/* -----------------------------------------------------------
   Map rendering
----------------------------------------------------------- */
async function drawRoutes() {
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  routeData.routes.forEach(route => {
    const polyline = new google.maps.Polyline({
      path: route.polyline,
      geodesic: true,
      strokeColor: route.accent,
      strokeOpacity: 0.35,
      strokeWeight: 5,
      map
    });
    routePolylines[route.id] = polyline;
  });

  const origin = routeData.routes[0].polyline[0];
  const dest   = routeData.routes[0].polyline.at(-1);

  routeMarkers.origin = new AdvancedMarkerElement({
    position: origin,
    map,
    title: routeData.origin
  });

  routeMarkers.dest = new AdvancedMarkerElement({
    position: dest,
    map,
    title: routeData.destination
  });

  // Recenter map to fit the trip
  const bounds = new google.maps.LatLngBounds();
  routeData.routes[0].polyline.forEach(p => bounds.extend(p));
  map.fitBounds(bounds, { top: 140, right: 60, bottom: 280, left: 60 });
}

function setActiveRoute(id) {
  activeRouteId = id;

  Object.entries(routePolylines).forEach(([routeId, polyline]) => {
    const isActive = routeId === id;
    polyline.setOptions({
      strokeOpacity: isActive ? 0.95 : 0.25,
      strokeWeight: isActive ? 6 : 4,
      zIndex: isActive ? 10 : 1
    });
  });

  document.querySelectorAll(".route-card").forEach(card => {
    card.classList.toggle("active", card.dataset.routeId === id);
  });

  console.log("[SafeRoute] Active route:", id);
}

/* -----------------------------------------------------------
   Route cards — inline expansion
----------------------------------------------------------- */
function renderRouteCards() {
  const container = document.getElementById("route-container");
  container.innerHTML = "";

  routeData.routes.forEach(route => {
    const card = document.createElement("div");
    card.className = "route-card";
    card.dataset.routeId = route.id;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-expanded", "false");

    card.innerHTML = `
      <div class="route-card-header">
        <span class="route-swatch" style="background:${route.accent}"></span>
        <div class="route-card-titles">
          <span class="route-name">${route.name}</span>
          <span class="route-tagline">${route.tagline}</span>
        </div>
        <div class="route-card-eta">
          <span class="eta-main">${route.durationLabel}</span>
          <span class="eta-sub">${route.addedTimeLabel}</span>
        </div>
      </div>

      <div class="route-details">
        <p class="route-tradeoff">${route.labels.tradeoff}</p>

        <div class="route-labels">
          <div class="label-row">
            <span class="label-icon">☀</span>
            <div>
              <span class="label-title">Lighting</span>
              <span class="label-text">${route.labels.lighting}</span>
            </div>
          </div>
          <div class="label-row">
            <span class="label-icon">◐</span>
            <div>
              <span class="label-title">Activity</span>
              <span class="label-text">${route.labels.activity}</span>
            </div>
          </div>
          <div class="label-row">
            <span class="label-icon">◎</span>
            <div>
              <span class="label-title">Isolation</span>
              <span class="label-text">${route.labels.isolation}</span>
            </div>
          </div>
        </div>
        <button class="why-link" type="button" data-why-id="${route.id}">
          Why this route? →
        </button>
      </div>

      <span class="route-expand-hint">See why</span>
    `;

    card.addEventListener("click", () => toggleExpand(route.id));

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleExpand(route.id);
      }
    });

    card.querySelector(".why-link")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.__openWhySheet?.(route.id);
    });

    container.appendChild(card);
  });
}

function toggleExpand(id) {
  const card = document.querySelector(`.route-card[data-route-id="${id}"]`);
  if (!card) return;

  const wasExpanded = expandedRouteId === id;

  document.querySelectorAll(".route-card").forEach(c => {
    c.classList.remove("expanded");
    c.setAttribute("aria-expanded", "false");
  });

  if (wasExpanded) {
    expandedRouteId = null;
  } else {
    card.classList.add("expanded");
    card.setAttribute("aria-expanded", "true");
    expandedRouteId = id;
    setActiveRoute(id);
  }

  console.log("[SafeRoute] Expanded route:", expandedRouteId);
}

/* -----------------------------------------------------------
   Emergency Mode
----------------------------------------------------------- */
function wireEmergencyToggle() {
  const toggle = document.getElementById("emergency-toggle");

  toggle.addEventListener("click", () => {
    emergencyMode = !emergencyMode;
    toggle.setAttribute("aria-pressed", String(emergencyMode));
    document.body.classList.toggle("emergency", emergencyMode);
    applyEmergencyState();
    console.log("[SafeRoute] Emergency Mode:", emergencyMode);
  });
}

function applyEmergencyState() {
  const banner = document.getElementById("emergency-banner");

  if (emergencyMode) {
    expandedRouteId = null;
    document.querySelectorAll(".route-card").forEach(c => {
      c.classList.remove("expanded");
      c.setAttribute("aria-expanded", "false");
    });

    setActiveRoute("quickest");

    if (routePolylines.comfort) routePolylines.comfort.setMap(null);
    document.querySelector('.route-card[data-route-id="comfort"]')
      ?.classList.add("hidden");

    if (!banner) {
      const el = document.createElement("div");
      el.id = "emergency-banner";
      el.className = "emergency-banner";
      el.innerHTML = `
        <strong>Emergency Mode on.</strong>
        Prioritizing speed. You're taking the quickest route even if it's less comfortable.
      `;
      document.querySelector(".bottom-stack").prepend(el);
    } else {
      banner.classList.remove("hidden");
    }
  } else {
    if (routePolylines.comfort) routePolylines.comfort.setMap(map);
    document.querySelector('.route-card[data-route-id="comfort"]')
      ?.classList.remove("hidden");

    if (banner) banner.classList.add("hidden");

    setActiveRoute("quickest");
  }
}

/* -----------------------------------------------------------
   Map style
----------------------------------------------------------- */
const LIGHT_MAP_STYLE = [
  { elementType: "geometry",           stylers: [{ color: "#e9e7e2" }] },
  { elementType: "labels.icon",        stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#6b6d74" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#e9e7e2" }] },
  { featureType: "administrative",     elementType: "geometry", stylers: [{ color: "#d6d3cd" }] },
  { featureType: "poi",                elementType: "labels.text.fill", stylers: [{ color: "#8a8c92" }] },
  { featureType: "poi.park",           elementType: "geometry", stylers: [{ color: "#d7e0d0" }] },
  { featureType: "road",               elementType: "geometry", stylers: [{ color: "#fbfaf7" }] },
  { featureType: "road",               elementType: "labels.text.fill", stylers: [{ color: "#9a9ca3" }] },
  { featureType: "road.highway",       elementType: "geometry", stylers: [{ color: "#e6e0d3" }] },
  { featureType: "road.highway",       elementType: "geometry.stroke", stylers: [{ color: "#d6cfc0" }] },
  { featureType: "transit",            stylers: [{ visibility: "off" }] },
  { featureType: "water",              elementType: "geometry", stylers: [{ color: "#cdd9de" }] }
];

/* -----------------------------------------------------------
   "Why this route?" bottom sheet
----------------------------------------------------------- */
function wireWhySheet() {
  const sheet = document.getElementById("why-sheet");
  const backdrop = document.getElementById("sheet-backdrop");
  const closeBtn = document.getElementById("sheet-close");
  const titleEl = document.getElementById("why-title");
  const tradeoffEl = document.getElementById("why-tradeoff");
  const labelsEl = document.getElementById("why-labels");

  const open = (route) => {
    titleEl.textContent = `Why ${route.name}?`;
    tradeoffEl.textContent = route.labels.tradeoff;

    labelsEl.innerHTML = `
      <div class="sheet-label">
        <span class="sheet-label-name">Lighting</span>
        <span class="sheet-label-value">${route.labels.lighting}</span>
      </div>
      <div class="sheet-label">
        <span class="sheet-label-name">Activity</span>
        <span class="sheet-label-value">${route.labels.activity}</span>
      </div>
      <div class="sheet-label">
        <span class="sheet-label-name">Isolation</span>
        <span class="sheet-label-value">${route.labels.isolation}</span>
      </div>
    `;

    sheet.classList.add("open");
    backdrop.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    sheet.classList.remove("open");
    backdrop.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
  };

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  window.__openWhySheet = (routeId) => {
    const route = routeData.routes.find(r => r.id === routeId);
    if (route) open(route);
  };
}

window.initMap = initMap;