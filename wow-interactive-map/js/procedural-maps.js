/**
 * World of Warcraft Procedural Canvas & SVG Map Generator
 * Generates rich, authentic Warcraft-style cartography parchment maps
 * Acts as high-res fallback and custom artistic style layer
 */

const WOW_MAP_CANVAS = {
    /**
     * Create an interactive canvas-backed image URL for the specified continent
     */
    generateContinentMap(continentId, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width || 1600;
        canvas.height = height || 1200;
        const ctx = canvas.getContext('2d');

        // Draw parchment ocean background
        this.drawOceanBackground(ctx, canvas.width, canvas.height);

        // Draw cartographic grid & latitude lines
        this.drawMapGrid(ctx, canvas.width, canvas.height);

        // Draw continent-specific landmasses, mountain ridges, and coastal shelf
        if (continentId === 'azeroth') {
            this.drawAzerothWorld(ctx, canvas.width, canvas.height);
        } else if (continentId === 'kalimdor') {
            this.drawKalimdor(ctx, canvas.width, canvas.height);
        } else if (continentId === 'eastern-kingdoms') {
            this.drawEasternKingdoms(ctx, canvas.width, canvas.height);
        } else if (continentId === 'northrend') {
            this.drawNorthrend(ctx, canvas.width, canvas.height);
        } else if (continentId === 'outland') {
            this.drawOutland(ctx, canvas.width, canvas.height);
        } else if (continentId === 'pandaria') {
            this.drawPandaria(ctx, canvas.width, canvas.height);
        }

        // Draw ornate sea serpents, decorative compass rose, and cartouche
        this.drawDecorations(ctx, canvas.width, canvas.height, continentId);

        return canvas.toDataURL('image/jpeg', 0.88);
    },

    drawOceanBackground(ctx, w, h) {
        // Deep vintage nautical parchment gradient
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
        bgGrad.addColorStop(0, '#1c2834');
        bgGrad.addColorStop(0.5, '#131e28');
        bgGrad.addColorStop(1, '#0b1219');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Subtle water wave ripples
        ctx.strokeStyle = 'rgba(70, 105, 130, 0.12)';
        ctx.lineWidth = 1.5;
        for (let y = 30; y < h; y += 45) {
            ctx.beginPath();
            for (let x = 0; x < w; x += 60) {
                ctx.quadraticCurveTo(x + 15, y - 5, x + 30, y);
                ctx.quadraticCurveTo(x + 45, y + 5, x + 60, y);
            }
            ctx.stroke();
        }

        // Vignette effect
        const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(5, 7, 10, 0.8)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    },

    drawMapGrid(ctx, w, h) {
        ctx.save();
        ctx.strokeStyle = 'rgba(180, 150, 90, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);

        // Rhumb lines radiating
        const cx = w * 0.5;
        const cy = h * 0.5;
        for (let i = 0; i < 16; i++) {
            const angle = (i * Math.PI * 2) / 16;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * w, cy + Math.sin(angle) * h);
            ctx.stroke();
        }
        ctx.restore();
    },

    // Landmass rendering helper
    renderLand(ctx, paths, fillColor, strokeColor, shadowColor = 'rgba(0,0,0,0.6)') {
        ctx.save();
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;

        paths.forEach(p => {
            ctx.beginPath();
            p(ctx);
            ctx.fill();
            ctx.stroke();
        });
        ctx.restore();

        // Coastal shallow water glow
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 180, 210, 0.25)';
        ctx.lineWidth = 8;
        paths.forEach(p => {
            ctx.beginPath();
            p(ctx);
            ctx.stroke();
        });
        ctx.restore();
    },

    drawAzerothWorld(ctx, w, h) {
        // Kalimdor (West)
        this.renderLand(ctx, [
            (c) => {
                c.moveTo(w * 0.18, h * 0.15);
                c.bezierCurveTo(w * 0.28, h * 0.18, w * 0.32, h * 0.35, w * 0.28, h * 0.55);
                c.bezierCurveTo(w * 0.34, h * 0.65, w * 0.29, h * 0.85, w * 0.22, h * 0.88);
                c.bezierCurveTo(w * 0.15, h * 0.80, w * 0.12, h * 0.55, w * 0.14, h * 0.30);
                c.closePath();
            }
        ], '#3a4430', '#c89b3c');

        // Eastern Kingdoms (East)
        this.renderLand(ctx, [
            (c) => {
                c.moveTo(w * 0.74, h * 0.12);
                c.bezierCurveTo(w * 0.82, h * 0.15, w * 0.85, h * 0.35, w * 0.78, h * 0.50);
                c.bezierCurveTo(w * 0.83, h * 0.65, w * 0.80, h * 0.88, w * 0.70, h * 0.90);
                c.bezierCurveTo(w * 0.65, h * 0.78, w * 0.68, h * 0.52, w * 0.67, h * 0.32);
                c.closePath();
            }
        ], '#423d32', '#c89b3c');

        // Northrend (North)
        this.renderLand(ctx, [
            (c) => {
                c.moveTo(w * 0.42, h * 0.12);
                c.bezierCurveTo(w * 0.58, h * 0.08, w * 0.62, h * 0.25, w * 0.50, h * 0.32);
                c.bezierCurveTo(w * 0.38, h * 0.28, w * 0.34, h * 0.18, w * 0.42, h * 0.12);
                c.closePath();
            }
        ], '#d0e0e8', '#90b0c8');

        // Pandaria (South)
        this.renderLand(ctx, [
            (c) => {
                c.moveTo(w * 0.44, h * 0.75);
                c.bezierCurveTo(w * 0.56, h * 0.72, w * 0.58, h * 0.88, w * 0.48, h * 0.92);
                c.bezierCurveTo(w * 0.38, h * 0.89, w * 0.36, h * 0.78, w * 0.44, h * 0.75);
                c.closePath();
            }
        ], '#364e38', '#6fa372');

        // The Maelstrom (Center)
        ctx.save();
        const mx = w * 0.50;
        const my = h * 0.50;
        const whirl = ctx.createRadialGradient(mx, my, 5, mx, my, 75);
        whirl.addColorStop(0, '#00e5ff');
        whirl.addColorStop(0.3, '#0b4060');
        whirl.addColorStop(0.8, '#102538');
        whirl.addColorStop(1, 'rgba(16, 37, 56, 0)');
        ctx.fillStyle = whirl;
        ctx.beginPath();
        ctx.arc(mx, my, 80, 0, Math.PI * 2);
        ctx.fill();

        // Swirling spiral arms
        ctx.strokeStyle = 'rgba(120, 240, 255, 0.7)';
        ctx.lineWidth = 2.5;
        for (let a = 0; a < 3; a++) {
            ctx.beginPath();
            const startAngle = (a * Math.PI * 2) / 3;
            for (let r = 5; r < 75; r += 2) {
                const theta = startAngle + r * 0.15;
                const px = mx + Math.cos(theta) * r;
                const py = my + Math.sin(theta) * r;
                if (r === 5) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        ctx.restore();
    },

    drawKalimdor(ctx, w, h) {
        // Detailed Kalimdor shape
        this.renderLand(ctx, [
            (c) => {
                // Teldrassil island
                c.arc(w * 0.32, h * 0.12, 45, 0, Math.PI * 2);
            },
            (c) => {
                // Azuremyst & Bloodmyst
                c.arc(w * 0.18, h * 0.16, 35, 0, Math.PI * 2);
            },
            (c) => {
                // Main continent body
                c.moveTo(w * 0.42, h * 0.15); // Darkshore / Moonglade
                c.bezierCurveTo(w * 0.58, h * 0.18, w * 0.65, h * 0.28, w * 0.62, h * 0.42); // Azshara / Durotar
                c.bezierCurveTo(w * 0.68, h * 0.58, w * 0.62, h * 0.75, w * 0.55, h * 0.88); // Tanaris
                c.bezierCurveTo(w * 0.42, h * 0.95, w * 0.35, h * 0.85, w * 0.32, h * 0.72); // Silithus
                c.bezierCurveTo(w * 0.25, h * 0.58, w * 0.28, h * 0.40, w * 0.30, h * 0.25); // Desolace / Feralas
                c.closePath();
            }
        ], '#3b432e', '#c89b3c');

        // Interior regions coloring (Barrens savannah, Durotar red clay, Ashenvale forest)
        this.drawKalimdorBiomes(ctx, w, h);
    },

    drawKalimdorBiomes(ctx, w, h) {
        ctx.save();
        // Red clay of Durotar
        ctx.fillStyle = 'rgba(180, 75, 40, 0.45)';
        ctx.beginPath();
        ctx.ellipse(w * 0.58, h * 0.45, 55, 45, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Golden Savannah of Barrens & Mulgore
        ctx.fillStyle = 'rgba(195, 160, 60, 0.45)';
        ctx.beginPath();
        ctx.ellipse(w * 0.48, h * 0.52, 60, 80, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Lush Forest of Ashenvale & Hyjal
        ctx.fillStyle = 'rgba(35, 80, 45, 0.55)';
        ctx.beginPath();
        ctx.ellipse(w * 0.46, h * 0.30, 80, 35, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Desert of Tanaris & Silithus
        ctx.fillStyle = 'rgba(215, 185, 110, 0.55)';
        ctx.beginPath();
        ctx.ellipse(w * 0.48, h * 0.78, 65, 55, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawEasternKingdoms(ctx, w, h) {
        this.renderLand(ctx, [
            (c) => {
                // Quel'Danas
                c.arc(w * 0.56, h * 0.06, 25, 0, Math.PI * 2);
            },
            (c) => {
                // Main continent body: Eversong -> Lordaeron -> Khaz Modan -> Stormwind -> Stranglethorn
                c.moveTo(w * 0.54, h * 0.10);
                c.bezierCurveTo(w * 0.64, h * 0.15, w * 0.60, h * 0.28, w * 0.52, h * 0.35); // Lordaeron & Plaguelands
                c.bezierCurveTo(w * 0.65, h * 0.42, w * 0.58, h * 0.56, w * 0.50, h * 0.62); // Wetlands / Ironforge
                c.bezierCurveTo(w * 0.54, h * 0.72, w * 0.48, h * 0.82, w * 0.42, h * 0.94); // Elwynn / Stranglethorn
                c.bezierCurveTo(w * 0.35, h * 0.90, w * 0.38, h * 0.70, w * 0.36, h * 0.60); // Westfall coastline
                c.bezierCurveTo(w * 0.30, h * 0.48, w * 0.34, h * 0.32, w * 0.44, h * 0.22); // Tirisfal coastline
                c.closePath();
            }
        ], '#3e3a32', '#c89b3c');

        // Biomes: Plaguelands (sickly purple), Dun Morogh (snow white), Elwynn (bright green), Stranglethorn (jungle)
        ctx.save();
        // Dun Morogh snow
        ctx.fillStyle = 'rgba(215, 230, 245, 0.6)';
        ctx.beginPath();
        ctx.ellipse(w * 0.46, h * 0.52, 50, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Plaguelands decay
        ctx.fillStyle = 'rgba(85, 75, 45, 0.6)';
        ctx.beginPath();
        ctx.ellipse(w * 0.52, h * 0.26, 60, 40, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Stranglethorn dense jungle
        ctx.fillStyle = 'rgba(25, 70, 30, 0.65)';
        ctx.beginPath();
        ctx.ellipse(w * 0.43, h * 0.84, 40, 60, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawNorthrend(ctx, w, h) {
        this.renderLand(ctx, [
            (c) => {
                c.moveTo(w * 0.25, h * 0.48); // Borean Tundra
                c.bezierCurveTo(w * 0.30, h * 0.25, w * 0.50, h * 0.18, w * 0.68, h * 0.26); // Storm Peaks
                c.bezierCurveTo(w * 0.85, h * 0.38, w * 0.82, h * 0.65, w * 0.74, h * 0.76); // Howling Fjord
                c.bezierCurveTo(w * 0.58, h * 0.80, w * 0.48, h * 0.70, w * 0.42, h * 0.62); // Dragonblight
                c.bezierCurveTo(w * 0.28, h * 0.65, w * 0.20, h * 0.55, w * 0.25, h * 0.48);
                c.closePath();
            }
        ], '#cbd9e2', '#8da8be');

        // Icecrown dark glacier
        ctx.save();
        ctx.fillStyle = 'rgba(25, 45, 70, 0.7)';
        ctx.beginPath();
        ctx.ellipse(w * 0.45, h * 0.36, 65, 45, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Sholazar Basin lush jungle pocket
        ctx.fillStyle = 'rgba(40, 110, 45, 0.75)';
        ctx.beginPath();
        ctx.ellipse(w * 0.32, h * 0.42, 35, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawOutland(ctx, w, h) {
        // Space nebula background for Outland
        ctx.save();
        const voidGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.6);
        voidGrad.addColorStop(0, '#2d143f');
        voidGrad.addColorStop(0.5, '#150921');
        voidGrad.addColorStop(1, '#050208');
        ctx.fillStyle = voidGrad;
        ctx.fillRect(0, 0, w, h);

        // Floating shattered chunks
        this.renderLand(ctx, [
            (c) => {
                // Main broken landmass
                c.moveTo(w * 0.40, h * 0.25); // Netherstorm
                c.bezierCurveTo(w * 0.65, h * 0.22, w * 0.75, h * 0.45, w * 0.68, h * 0.68); // Shadowmoon
                c.bezierCurveTo(w * 0.55, h * 0.82, w * 0.35, h * 0.75, w * 0.25, h * 0.58); // Terokkar / Nagrand
                c.bezierCurveTo(w * 0.22, h * 0.38, w * 0.32, h * 0.30, w * 0.40, h * 0.25);
                c.closePath();
            }
        ], '#342923', '#c87d3c', 'rgba(120, 40, 180, 0.6)');

        // Hellfire Peninsula crimson core
        ctx.fillStyle = 'rgba(165, 45, 25, 0.65)';
        ctx.beginPath();
        ctx.ellipse(w * 0.58, h * 0.48, 60, 45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Zangarmarsh blue glowing marsh
        ctx.fillStyle = 'rgba(25, 125, 160, 0.65)';
        ctx.beginPath();
        ctx.ellipse(w * 0.38, h * 0.46, 50, 40, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Nagrand serene green
        ctx.fillStyle = 'rgba(75, 140, 45, 0.65)';
        ctx.beginPath();
        ctx.ellipse(w * 0.30, h * 0.58, 45, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawPandaria(ctx, w, h) {
        this.renderLand(ctx, [
            (c) => {
                c.moveTo(w * 0.45, h * 0.25); // Kun-Lai Summit
                c.bezierCurveTo(w * 0.72, h * 0.28, w * 0.82, h * 0.55, w * 0.70, h * 0.78); // Jade Forest / Krasarang
                c.bezierCurveTo(w * 0.52, h * 0.85, w * 0.32, h * 0.80, w * 0.22, h * 0.62); // Dread Wastes / Townlong
                c.bezierCurveTo(w * 0.20, h * 0.42, w * 0.32, h * 0.30, w * 0.45, h * 0.25);
                c.closePath();
            }
        ], '#384b37', '#7fa873');

        // Vale of Eternal Blossoms golden aura
        ctx.save();
        const valeAura = ctx.createRadialGradient(w * 0.50, h * 0.50, 5, w * 0.50, h * 0.50, 60);
        valeAura.addColorStop(0, 'rgba(255, 230, 120, 0.75)');
        valeAura.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = valeAura;
        ctx.beginPath();
        ctx.arc(w * 0.50, h * 0.50, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawDecorations(ctx, w, h, continentId) {
        // Draw ornate vintage compass rose in upper corner
        const compX = w - 110;
        const compY = 110;
        const radius = 55;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;

        // Outer ring
        ctx.strokeStyle = '#c89b3c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(compX, compY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#7c5a1e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(compX, compY, radius - 6, 0, Math.PI * 2);
        ctx.stroke();

        // 8 points star
        const points = 8;
        for (let i = 0; i < points; i++) {
            const angle = (i * Math.PI * 2) / points;
            const isCardinal = i % 2 === 0;
            const r = isCardinal ? radius - 4 : radius - 18;

            ctx.fillStyle = (i === 0 || i === 4) ? '#ffd100' : '#8c6b28';
            ctx.beginPath();
            ctx.moveTo(compX, compY);
            ctx.lineTo(compX + Math.cos(angle - 0.2) * (r * 0.3), compY + Math.sin(angle - 0.2) * (r * 0.3));
            ctx.lineTo(compX + Math.cos(angle) * r, compY + Math.sin(angle) * r);
            ctx.closePath();
            ctx.fill();
        }

        // Center jewel
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(compX, compY, 6, 0, Math.PI * 2);
        ctx.fill();

        // "N" letter
        ctx.fillStyle = '#ffd100';
        ctx.font = 'bold 18px "Cinzel", "Georgia", serif';
        ctx.textAlign = 'center';
        ctx.fillText('N', compX, compY - radius - 10);
        ctx.restore();

        // Map Title Cartouche (bottom-left)
        ctx.save();
        const boxW = 280;
        const boxH = 70;
        const boxX = 30;
        const boxY = h - boxH - 30;

        ctx.fillStyle = 'rgba(15, 20, 25, 0.88)';
        ctx.strokeStyle = '#c89b3c';
        ctx.lineWidth = 2;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Corner ornaments
        ctx.fillStyle = '#f8b700';
        [
            [boxX, boxY],
            [boxX + boxW, boxY],
            [boxX, boxY + boxH],
            [boxX + boxW, boxY + boxH]
        ].forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Title text
        const continentNames = {
            'azeroth': '艾泽拉斯全图 · AZEROTH',
            'kalimdor': '卡利姆多大陆 · KALIMDOR',
            'eastern-kingdoms': '东部王国 · EASTERN KINGDOMS',
            'northrend': '诺森德大陆 · NORTHREND',
            'outland': '外域异界 · OUTLAND',
            'pandaria': '潘达利亚迷雾 · PANDARIA'
        };

        ctx.fillStyle = '#ffd100';
        ctx.font = 'bold 16px "Cinzel", "Georgia", serif';
        ctx.textAlign = 'left';
        ctx.fillText(continentNames[continentId] || 'WORLD OF WARCRAFT', boxX + 18, boxY + 28);

        ctx.fillStyle = '#a09070';
        ctx.font = '12px sans-serif';
        ctx.fillText('World of Warcraft Cartography Series', boxX + 18, boxY + 52);
        ctx.restore();
    }
};

window.WOW_MAP_CANVAS = WOW_MAP_CANVAS;
