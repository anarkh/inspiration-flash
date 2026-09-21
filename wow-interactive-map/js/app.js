/**
 * World of Warcraft Interactive Map - Application Engine
 * Unified True Stitched Composite & 4K Regional Zone Detail Engine (1.0 -> 11.0)
 */

class WowMapApp {
    constructor() {
        this.currentContinentId = 'khaz-algar'; // Default to 11.0 The War Within or Eastern Kingdoms
        this.currentViewType = 'continent'; // 'continent' | 'zone'
        this.currentZoneId = null;
        this.mapMode = 'composite'; // 'composite' or 'overview'
        this.currentFilter = 'all';

        this.map = null;
        this.currentImageLayer = null;
        this.markersLayerGroup = null;
        this.activeMarkers = [];

        this.init();
    }

    init() {
        this.initMap();
        this.initUIEvents();
        this.loadContinent(this.currentContinentId);
    }

    /**
     * 1. Initialize Leaflet Map
     */
    initMap() {
        this.map = L.map('map-viewport', {
            crs: L.CRS.Simple,
            minZoom: -3,
            maxZoom: 3,
            zoomDelta: 0.25,
            zoomSnap: 0.05,
            zoomControl: false,
            attributionControl: false,
            inertia: true,
            inertiaDeceleration: 3000,
            bounceAtZoomLimits: true
        });

        // Add Leaflet zoom control
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        // Marker layer group
        this.markersLayerGroup = L.layerGroup().addTo(this.map);

        // Mouse tracking
        this.map.on('mousemove', (e) => this.handleMouseMove(e));
        this.map.on('mouseout', () => {
            const coordEl = document.getElementById('cursor-coords');
            if (coordEl) coordEl.textContent = '--, --';
        });

        // Right-click to zoom out to parent continent or world
        this.map.on('contextmenu', (e) => {
            if (e.originalEvent) e.originalEvent.preventDefault();
            this.handleRightClickZoomOut();
        });

        // Dismiss interaction hint on click
        this.map.on('mousedown', () => {
            const hint = document.getElementById('interaction-hint');
            if (hint) {
                hint.style.opacity = '0';
                setTimeout(() => { if (hint) hint.remove(); }, 800);
            }
        });
    }

    /**
     * 2. Load Continent
     */
    loadContinent(continentId, targetPos = null, targetZoom = null, openMarkerId = null) {
        const data = WOW_MAP_DATA.continents[continentId];
        if (!data) return;

        this.currentViewType = 'continent';
        this.currentContinentId = continentId;
        this.currentZoneId = null;

        // Update Continent Dropdown value
        const continentSelect = document.getElementById('continent-select');
        if (continentSelect && continentSelect.value !== continentId) {
            continentSelect.value = continentId;
        }

        // Update Bottom HUD
        const nameEl = document.getElementById('current-continent-name');
        if (nameEl) nameEl.textContent = `${data.name} (${data.englishName})`;

        const tagEl = document.getElementById('current-level-tag');
        if (tagEl) {
            tagEl.textContent = data.era || (this.mapMode === 'composite' ? '超清大地图' : '官方原版图');
        }

        // Remove old map layer
        if (this.currentImageLayer) {
            this.map.removeLayer(this.currentImageLayer);
        }

        const bounds = data.bounds;
        this.map.setMaxBounds([
            [-bounds[1][0] * 0.4, -bounds[1][1] * 0.4],
            [bounds[1][0] * 1.4, bounds[1][1] * 1.4]
        ]);

        const textureUrl = (this.mapMode === 'composite' && data.compositeMapUrl) ?
            data.compositeMapUrl : (data.overviewMapUrl || data.localMapUrl);

        this.currentImageLayer = L.imageOverlay(textureUrl, bounds, {
            className: 'composite-map-layer'
        }).addTo(this.map);

        // Camera positioning
        if (targetPos) {
            this.map.setView(targetPos, targetZoom !== null ? targetZoom : (data.initialZoom || -1));
        } else {
            this.map.fitBounds(bounds);
        }

        // Render POIs
        this.renderMarkers(data.pois);

        // If target marker specified, open its popup
        if (openMarkerId) {
            setTimeout(() => {
                const targetMarker = this.activeMarkers.find(m => m.poiData && m.poiData.id === openMarkerId);
                if (targetMarker) {
                    targetMarker.openPopup();
                }
            }, 350);
        }
    }

    /**
     * 3. Load Detailed 4K Regional Zone Map (加载区域详图)
     */
    loadZone(zoneId) {
        const zone = WOW_MAP_DATA.zones[zoneId];
        if (!zone) return;

        this.currentViewType = 'zone';
        this.currentZoneId = zoneId;

        // Sync continent dropdown to parent continent if available
        if (zone.parentContinent) {
            const continentSelect = document.getElementById('continent-select');
            if (continentSelect && continentSelect.value !== zone.parentContinent) {
                continentSelect.value = zone.parentContinent;
            }
        }

        // Update Bottom HUD
        const nameEl = document.getElementById('current-continent-name');
        if (nameEl) nameEl.textContent = `${zone.name} (${zone.englishName})`;

        const tagEl = document.getElementById('current-level-tag');
        if (tagEl) tagEl.textContent = `${zone.era || '4K 详细地区详图'}`;

        // Remove old map layer
        if (this.currentImageLayer) {
            this.map.removeLayer(this.currentImageLayer);
        }

        const bounds = zone.bounds || [[0, 0], [2560, 3840]];
        this.map.setMaxBounds([
            [-bounds[1][0] * 0.4, -bounds[1][1] * 0.4],
            [bounds[1][0] * 1.4, bounds[1][1] * 1.4]
        ]);

        this.currentImageLayer = L.imageOverlay(zone.localMapUrl, bounds, {
            className: 'composite-map-layer'
        }).addTo(this.map);

        this.map.fitBounds(bounds);

        // Render Zone POIs
        this.renderMarkers(zone.pois || []);
    }

    /**
     * 4. Right-Click Zoom-Out Logic
     */
    handleRightClickZoomOut() {
        if (this.currentViewType === 'zone') {
            const zone = WOW_MAP_DATA.zones[this.currentZoneId];
            if (zone && zone.parentContinent) {
                this.loadContinent(zone.parentContinent);
            } else {
                this.loadContinent('azeroth');
            }
        } else if (this.currentContinentId !== 'azeroth') {
            this.loadContinent('azeroth');
        }
    }

    /**
     * 5. Render Markers & POIs
     */
    renderMarkers(poisList) {
        this.markersLayerGroup.clearLayers();
        this.activeMarkers = [];

        if (!poisList) return;

        poisList.forEach(poi => {
            if (this.currentFilter !== 'all' && poi.type !== this.currentFilter) {
                return;
            }

            const marker = this.createMarker(poi);
            this.markersLayerGroup.addLayer(marker);
            this.activeMarkers.push(marker);
        });
    }

    createMarker(poi) {
        const iconHtml = this.getMarkerHtml(poi);
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'wow-marker-wrapper',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
        });

        const marker = L.marker(poi.pos, { icon: customIcon });
        marker.poiData = poi;

        let actionBtnHtml = '';
        if (poi.targetZone) {
            actionBtnHtml = `<button class="wow-popup-action-btn" onclick="window.wowApp.loadZone('${poi.targetZone}')">🗺️ 加载 4K 地区详图 →</button>`;
        } else if (poi.targetContinent) {
            actionBtnHtml = `<button class="wow-popup-action-btn" onclick="window.wowApp.loadContinent('${poi.targetContinent}')">进入大陆大地图 →</button>`;
        } else {
            actionBtnHtml = `<button class="wow-popup-action-btn" onclick="window.wowApp.focusMarker([${poi.pos[0]}, ${poi.pos[1]}])">聚焦视角 🔍</button>`;
        }

        const popupContent = `
            <div class="wow-popup-card">
                <div class="wow-popup-header">
                    <h3>${poi.name}</h3>
                    <span class="wow-popup-badge ${poi.faction}">${WOW_MAP_DATA.factions[poi.faction]?.name || poi.type}</span>
                </div>
                <div class="wow-popup-body">
                    ${poi.desc}
                </div>
                <div class="wow-popup-footer">
                    <span class="level-info">${poi.level}</span>
                    ${actionBtnHtml}
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 320 });

        return marker;
    }

    getMarkerHtml(poi) {
        let pinClass = 'wow-pin';
        let icon = '📍';

        if (poi.type === 'zone-portal') {
            pinClass += ' zone-portal';
            icon = '📜';
        } else if (poi.type === 'capital') {
            pinClass += ` capital-${poi.faction}`;
            icon = poi.faction === 'alliance' ? '🦁' : (poi.faction === 'horde' ? '🐺' : '🏰');
        } else if (poi.type === 'raid') {
            pinClass += ' raid';
            icon = '💀';
        } else if (poi.type === 'dungeon') {
            pinClass += ' dungeon';
            icon = '🛡️';
        } else if (poi.type === 'flight') {
            pinClass += ' flight';
            icon = '🦅';
        } else if (poi.type === 'continent') {
            pinClass += ' continent-portal';
            icon = '🌀';
        } else {
            pinClass += ' capital-neutral';
            icon = '⭐';
        }

        return `
            <div class="${pinClass}" title="${poi.name}">
                <span class="pin-icon">${icon}</span>
            </div>
        `;
    }

    /**
     * 6. Real-Time Coordinates Tracking
     */
    handleMouseMove(e) {
        let bounds = null;
        if (this.currentViewType === 'zone') {
            const zone = WOW_MAP_DATA.zones[this.currentZoneId];
            bounds = zone ? zone.bounds : [[0, 0], [2560, 3840]];
        } else {
            const continent = WOW_MAP_DATA.continents[this.currentContinentId];
            bounds = continent ? continent.bounds : [[0, 0], [2560, 3840]];
        }

        if (!bounds) return;

        const maxLat = bounds[1][0];
        const maxLng = bounds[1][1];

        let x = (e.latlng.lng / maxLng) * 100;
        let y = (1 - (e.latlng.lat / maxLat)) * 100;

        x = Math.max(0, Math.min(100, x)).toFixed(1);
        y = Math.max(0, Math.min(100, y)).toFixed(1);

        const coordEl = document.getElementById('cursor-coords');
        if (coordEl) {
            coordEl.textContent = `X: ${x}, Y: ${y}`;
        }
    }

    /**
     * 7. Global Search Across All Versions (1.0 -> 11.0)
     */
    searchLocations(query) {
        const resultsBox = document.getElementById('search-results');
        if (!query || query.trim().length === 0) {
            resultsBox.style.display = 'none';
            resultsBox.innerHTML = '';
            return;
        }

        const q = query.trim().toLowerCase();
        const matches = [];

        // 1. Search Detailed Zones
        Object.values(WOW_MAP_DATA.zones).forEach(zone => {
            if (zone.name.toLowerCase().includes(q) || zone.englishName.toLowerCase().includes(q)) {
                matches.push({
                    kind: 'zone',
                    id: zone.id,
                    name: `【${zone.name}】4K 地区地图`,
                    sub: `${zone.era || '详细地区'}`,
                    pos: zone.center,
                    poi: null
                });
            }
            if (zone.pois) {
                zone.pois.forEach(poi => {
                    if (poi.name.toLowerCase().includes(q) || poi.en.toLowerCase().includes(q) || (poi.desc && poi.desc.toLowerCase().includes(q))) {
                        matches.push({
                            kind: 'zone',
                            id: zone.id,
                            name: poi.name,
                            sub: `${zone.name} · ${poi.level}`,
                            pos: poi.pos,
                            poi: poi
                        });
                    }
                });
            }
        });

        // 2. Search Continents
        Object.values(WOW_MAP_DATA.continents).forEach(continent => {
            if (continent.name.toLowerCase().includes(q) || continent.englishName.toLowerCase().includes(q)) {
                matches.push({
                    kind: 'continent',
                    id: continent.id,
                    name: continent.name,
                    sub: `${continent.era || '大陆地图'}`,
                    pos: continent.center,
                    zoom: -1,
                    poi: null
                });
            }

            if (continent.pois) {
                continent.pois.forEach(poi => {
                    if (poi.name.toLowerCase().includes(q) || poi.en.toLowerCase().includes(q) || (poi.desc && poi.desc.toLowerCase().includes(q))) {
                        matches.push({
                            kind: 'continent',
                            id: continent.id,
                            name: poi.name,
                            sub: `${continent.name} · ${poi.level}`,
                            pos: poi.pos,
                            zoom: 1,
                            poi: poi
                        });
                    }
                });
            }
        });

        if (matches.length === 0) {
            resultsBox.innerHTML = `<div class="search-result-item" style="color: #9e8e78; justify-content: center;">未找到匹配地点</div>`;
            resultsBox.style.display = 'block';
            return;
        }

        resultsBox.innerHTML = matches.slice(0, 9).map(m => `
            <div class="search-result-item" data-kind="${m.kind}" data-id="${m.id}" data-pos="${m.pos.join(',')}" data-zoom="${m.zoom || 0.8}" data-poi-id="${m.poi ? m.poi.id : ''}">
                <div class="name">
                    <span>${m.poi ? (WOW_MAP_DATA.poiCategories[m.poi.type]?.icon || '📍') : (m.kind === 'zone' ? '📜' : '🗺️')}</span>
                    <span>${m.name}</span>
                </div>
                <div class="zone-sub">${m.sub}</div>
            </div>
        `).join('');

        resultsBox.style.display = 'block';

        resultsBox.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const kind = item.dataset.kind;
                const id = item.dataset.id;
                const pos = item.dataset.pos.split(',').map(Number);
                const zoom = Number(item.dataset.zoom);
                const poiId = item.dataset.poiId;

                resultsBox.style.display = 'none';
                document.getElementById('search-input').value = '';

                if (kind === 'zone') {
                    this.loadZone(id);
                } else {
                    if (this.currentContinentId !== id || this.currentViewType !== 'continent') {
                        this.loadContinent(id, pos, zoom, poiId || null);
                    } else {
                        this.map.flyTo(pos, zoom, { animate: true, duration: 1.2 });
                        if (poiId) {
                            setTimeout(() => {
                                const marker = this.activeMarkers.find(m => m.poiData && m.poiData.id === poiId);
                                if (marker) marker.openPopup();
                            }, 400);
                        }
                    }
                }
            });
        });
    }

    focusMarker(pos) {
        this.map.flyTo(pos, 1, {
            animate: true,
            duration: 1.2
        });
    }

    /**
     * 8. UI Events & Controls
     */
    initUIEvents() {
        // Continent Dropdown Selection
        const continentSelect = document.getElementById('continent-select');
        if (continentSelect) {
            continentSelect.addEventListener('change', (e) => {
                const cid = e.target.value;
                if (cid) {
                    this.loadContinent(cid);
                }
            });
        }

        // Quick Region Jump Dropdown (Can load 4K zone or continent area)
        const jumpSelect = document.getElementById('zone-quick-jump');
        if (jumpSelect) {
            jumpSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (!val) return;

                const [cid, zoneId] = val.split(':');

                // If this is an existing dedicated 4K zone detail, load it directly
                if (WOW_MAP_DATA.zones[zoneId]) {
                    this.loadZone(zoneId);
                } else {
                    // Otherwise switch continent and flyTo region
                    const continent = WOW_MAP_DATA.continents[cid];
                    let targetCenter = [1280, 1920];
                    if (continent && continent.regions) {
                        const r = continent.regions.find(reg => reg.id === zoneId);
                        if (r) targetCenter = r.center;
                    }
                    if (this.currentContinentId !== cid || this.currentViewType !== 'continent') {
                        this.loadContinent(cid, targetCenter, 0.8);
                    } else {
                        this.map.flyTo(targetCenter, 0.8, { animate: true, duration: 1.2 });
                    }
                }

                // Reset select display
                setTimeout(() => { jumpSelect.value = ''; }, 600);
            });
        }

        // Mosaic Mode Toggle Button
        const mosaicBtn = document.getElementById('mosaic-toggle-btn');
        if (mosaicBtn) {
            mosaicBtn.addEventListener('click', () => {
                this.mapMode = this.mapMode === 'composite' ? 'overview' : 'composite';
                mosaicBtn.textContent = this.mapMode === 'composite' ? '🧩 模式: 超清大地图' : '📜 模式: 官方原版图';
                mosaicBtn.classList.toggle('active', this.mapMode === 'composite');
                if (this.currentViewType === 'continent') {
                    this.loadContinent(this.currentContinentId);
                }
            });
        }

        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentFilter = chip.dataset.type || 'all';
                const currentList = this.currentViewType === 'zone' ?
                    (WOW_MAP_DATA.zones[this.currentZoneId]?.pois || []) :
                    (WOW_MAP_DATA.continents[this.currentContinentId]?.pois || []);
                this.renderMarkers(currentList);
            });
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchLocations(e.target.value);
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-box-wrap')) {
                    const box = document.getElementById('search-results');
                    if (box) box.style.display = 'none';
                }
            });
        }

        // Reset view button
        const resetBtn = document.getElementById('reset-view-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const bounds = this.currentViewType === 'zone' ?
                    (WOW_MAP_DATA.zones[this.currentZoneId]?.bounds || [[0, 0], [2560, 3840]]) :
                    (WOW_MAP_DATA.continents[this.currentContinentId]?.bounds || [[0, 0], [2560, 3840]]);
                this.map.fitBounds(bounds);
            });
        }

        // Fullscreen button
        const fullBtn = document.getElementById('fullscreen-btn');
        if (fullBtn) {
            fullBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                    fullBtn.innerHTML = '⤓';
                } else {
                    document.exitFullscreen();
                    fullBtn.innerHTML = '⛶';
                }
            });
        }
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.wowApp = new WowMapApp();
});
