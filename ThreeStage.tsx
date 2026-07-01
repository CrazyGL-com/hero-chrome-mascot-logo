import * as React from 'react';
import * as THREE from 'three';
import { useHeroAnimationFrame, useHeroAssetGate } from '@crazygl/core';
import { loadLogo3D } from '@crazygl/core/three/loadLogo3D';

/* ─────────────────────────────────────────────────────────────────────────
   Chrome Mascot Logo — Three.js stage.

   See the physics statement in index.tsx for the full plan. Highlights:
     • F0-tinted PURE mirror MeshPhysicalMaterial (metalness 1, low
       roughness, optional clearcoat). The reflection IS the surface.
     • PMREM-prefiltered procedural HDRI built into a FLOAT32 equirect
       DataTexture so the bright softboxes are *real* HDR values
       (luminance 5–10x normal range) — required for chrome to read as
       chrome, not "smooth".
     • Vertical-only sky-to-floor gradient + many discrete radial
       softboxes scattered across lat/lon. No horizontal continuous
       structure (skill rule: those stretch around the equator).
     • Full-bleed gradient ShaderMaterial plane behind the subject.
     • 4-pointed twinkle stars rendered as Points with a custom shader
       (per-star size, opacity phase, color).
     • Anamorphic horizontal lens-flare streaks via Sprites, slow drift,
       opacity envelope.
     • Pointer drives ±15° yaw / ±10° pitch.
   ───────────────────────────────────────────────────────────────────────── */

type LayoutMode = 'centered' | 'content-left' | 'content-right';
type EnvPreset = 'Sunset' | 'Cyber' | 'Cream';
type BgStyle = 'sunset-chrome' | 'cyber-magenta' | 'cream-pearl';

interface StageProps {
	rootRef: React.RefObject<HTMLElement | null>;
	size: { width: number; height: number; dpr: number };
	input: { x: number; y: number; active: boolean };
	reducedMotion: boolean;
	layout: LayoutMode;
	logo: string;
	useGlbMaterials: boolean;
	bevelDepth: number;
	logoColor: string;
	logoMetalness: number;
	logoRoughness: number;
	clearcoatStrength: number;
	envMapIntensity: number;
	logoScale: number;
	pointerStrength: number;
	autoRotateSpeed: number;
	envPreset: EnvPreset;
	bgStyle: BgStyle;
	bgMotion: number;
	gradientTop: string;
	gradientMiddle: string;
	gradientBottom: string;
	starCount: number;
	starColor: string;
	starDriftSpeed: number;
	flareStrength: number;
	flareColor: string;
}

function hex(c: string): THREE.Color {
	return new THREE.Color(c);
}

/* ──────────────────────────────────────────────────────────────────────
   Procedural HDR equirectangular environment.

   Renders a Float32 RGB 1024×512 texture in *linear* light. Values can
   exceed 1.0 — that's the whole point. Bright sun cores reach 8-12,
   secondary softboxes 2-4, ambient sky 0.3-0.8. After PMREM filtering
   this produces the punchy mirror highlights chrome needs.

   Layout (skill rule: NO horizontal continuous structure):
     • 5-stop vertical sky-to-floor gradient.
     • 1 bright "sun" disc with hot white core + tinted halo.
     • ~10 discrete radial softboxes scattered across lat/lon, varying
       in radius, intensity, color. Mix of large soft and small hot.
     • Warm/cool floor bounce blobs (radial, not bands).
   ────────────────────────────────────────────────────────────────────── */

type EnvPalette = {
	skyTop: [number, number, number];      // top gradient stop (linear RGB, intensity baked in)
	skyHigh: [number, number, number];     // upper-mid
	skyMid: [number, number, number];      // mid horizon-equivalent (vertically positioned, not a band)
	skyLow: [number, number, number];      // lower-mid
	floor: [number, number, number];       // bottom
	sunCore: [number, number, number];     // HDR core (will be > 1.0)
	sunHalo: [number, number, number];     // sun halo color
	keyCore: [number, number, number];
	keyHalo: [number, number, number];
	fillCore: [number, number, number];
	fillHalo: [number, number, number];
	accent: [number, number, number];
	floorWarm: [number, number, number];
	floorCool: [number, number, number];
};

// Linear-light intensities. Sun/key cores deliberately > 1.0 — they are
// the "HDR" punch. Sky stays in normal range so the chrome's dark
// reflections stay dark.
const ENV_PALETTES: Record<EnvPreset, EnvPalette> = {
	Sunset: {
		skyTop:    [0.50, 0.18, 0.40],   // deep magenta/purple top
		skyHigh:   [0.95, 0.32, 0.45],   // warm pink
		skyMid:    [1.25, 0.55, 0.40],   // hot pink/orange middle
		skyLow:    [1.45, 0.85, 0.55],   // cream/peach
		floor:     [1.20, 0.75, 0.35],   // soft gold floor bounce
		sunCore:   [10.0, 8.5, 6.5],     // HOT white-yellow core (HDR)
		sunHalo:   [3.5, 1.6, 1.0],      // orange/pink halo
		keyCore:   [5.5, 4.8, 3.5],      // warm white key
		keyHalo:   [2.2, 1.0, 1.3],      // pink halo
		fillCore:  [3.2, 3.8, 4.5],      // pale cyan fill
		fillHalo:  [1.1, 1.6, 2.2],
		accent:    [4.0, 1.2, 2.6],      // hot pink accent
		floorWarm: [0.9, 0.45, 0.18],
		floorCool: [0.35, 0.18, 0.42],
	},
	Cyber: {
		skyTop:    [0.18, 0.10, 0.55],   // deep violet
		skyHigh:   [0.30, 0.45, 1.10],   // electric blue
		skyMid:    [0.55, 0.30, 1.30],   // purple
		skyLow:    [1.00, 0.40, 1.30],   // magenta
		floor:     [0.30, 0.85, 1.20],   // cyan floor
		sunCore:   [9.0, 9.5, 11.0],     // hot white-cyan
		sunHalo:   [1.8, 2.8, 4.5],      // cyan halo
		keyCore:   [5.0, 3.5, 6.5],      // magenta-leaning key
		keyHalo:   [2.8, 1.0, 3.5],
		fillCore:  [3.5, 5.0, 5.0],      // mint
		fillHalo:  [1.0, 2.2, 1.8],
		accent:    [6.5, 1.8, 4.5],      // hot pink/magenta
		floorWarm: [1.2, 0.4, 1.0],
		floorCool: [0.25, 0.55, 0.95],
	},
	Cream: {
		skyTop:    [0.85, 0.62, 0.45],   // warm peach top
		skyHigh:   [1.15, 0.85, 0.60],   // cream
		skyMid:    [1.35, 1.00, 0.70],   // bright cream
		skyLow:    [1.30, 0.95, 0.65],
		floor:     [0.85, 0.60, 0.35],   // golden floor
		sunCore:   [9.0, 8.0, 6.0],      // golden hot core
		sunHalo:   [3.0, 2.0, 1.0],
		keyCore:   [4.5, 4.0, 3.0],
		keyHalo:   [2.2, 1.6, 0.9],
		fillCore:  [3.5, 3.0, 2.4],      // peach fill
		fillHalo:  [1.5, 1.0, 0.6],
		accent:    [3.0, 2.2, 1.5],
		floorWarm: [0.95, 0.55, 0.25],
		floorCool: [0.55, 0.40, 0.28],
	},
};

// One discrete radial softbox (a true round footprint in equirect canvas
// — small footprint = no equator-stretch tell).
type Box = {
	u: number;         // longitude 0..1
	v: number;         // latitude 0..1 (0 = top, 1 = bottom)
	radiusPx: number;  // gaussian radius in equirect pixels
	core: [number, number, number];
	halo: [number, number, number];
	haloStop: number;  // 0..1 where halo color sits
};

function buildEnvBoxes(p: EnvPalette): Box[] {
	return [
		// PRIMARY SUN — bright disc near top-front (small radius, very hot core).
		{ u: 0.50, v: 0.18, radiusPx: 110, core: p.sunCore, halo: p.sunHalo, haloStop: 0.35 },
		// Big soft warm key, upper-left.
		{ u: 0.18, v: 0.28, radiusPx: 220, core: p.keyCore, halo: p.keyHalo, haloStop: 0.40 },
		// Cool fill, upper-right.
		{ u: 0.82, v: 0.30, radiusPx: 200, core: p.fillCore, halo: p.fillHalo, haloStop: 0.40 },
		// Small hot accents — these become the "tiny gleams" on the chrome.
		{ u: 0.32, v: 0.42, radiusPx: 55,  core: [5.5, 4.5, 4.0], halo: p.accent, haloStop: 0.30 },
		{ u: 0.68, v: 0.40, radiusPx: 55,  core: [5.5, 4.5, 4.0], halo: p.accent, haloStop: 0.30 },
		{ u: 0.42, v: 0.55, radiusPx: 40,  core: [4.5, 4.0, 4.2], halo: [1.5, 1.0, 1.8], haloStop: 0.35 },
		{ u: 0.60, v: 0.58, radiusPx: 40,  core: [4.5, 4.0, 4.2], halo: [1.5, 1.0, 1.8], haloStop: 0.35 },
		{ u: 0.10, v: 0.50, radiusPx: 70,  core: [3.5, 3.0, 3.5], halo: p.fillHalo, haloStop: 0.35 },
		{ u: 0.90, v: 0.52, radiusPx: 70,  core: [3.5, 3.0, 3.5], halo: p.fillHalo, haloStop: 0.35 },
		// Floor bounce — radial blobs, NOT a band.
		{ u: 0.28, v: 0.82, radiusPx: 180, core: p.floorWarm, halo: [0, 0, 0], haloStop: 0.5 },
		{ u: 0.72, v: 0.85, radiusPx: 180, core: p.floorCool, halo: [0, 0, 0], haloStop: 0.5 },
		{ u: 0.50, v: 0.92, radiusPx: 150, core: p.floor,     halo: [0, 0, 0], haloStop: 0.5 },
	];
}

// Smooth-step easing for the sky gradient stops.
function smoothMix(a: number, b: number, t: number) {
	const u = Math.max(0, Math.min(1, t));
	return a + (b - a) * (u * u * (3 - 2 * u));
}

function buildHDRTexture(preset: EnvPreset): THREE.DataTexture {
	// 1024×512 is plenty for an env map; PMREM downsamples anyway.
	const W = 1024;
	const H = 512;
	const data = new Float32Array(W * H * 4);
	const p = ENV_PALETTES[preset];
	const boxes = buildEnvBoxes(p);

	// 5-stop vertical gradient in linear light.
	const STOPS: Array<{ pos: number; rgb: [number, number, number] }> = [
		{ pos: 0.00, rgb: p.skyTop },
		{ pos: 0.25, rgb: p.skyHigh },
		{ pos: 0.50, rgb: p.skyMid },
		{ pos: 0.72, rgb: p.skyLow },
		{ pos: 1.00, rgb: p.floor },
	];

	const sampleSky = (v: number): [number, number, number] => {
		let lo = STOPS[0];
		let hi = STOPS[STOPS.length - 1];
		for (let i = 0; i < STOPS.length - 1; i++) {
			if (v >= STOPS[i].pos && v <= STOPS[i + 1].pos) {
				lo = STOPS[i];
				hi = STOPS[i + 1];
				break;
			}
		}
		const span = Math.max(1e-6, hi.pos - lo.pos);
		const t = (v - lo.pos) / span;
		return [
			smoothMix(lo.rgb[0], hi.rgb[0], t),
			smoothMix(lo.rgb[1], hi.rgb[1], t),
			smoothMix(lo.rgb[2], hi.rgb[2], t),
		];
	};

	// 1) Fill base sky gradient.
	for (let y = 0; y < H; y++) {
		const v = y / (H - 1);
		const [r, g, b] = sampleSky(v);
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4;
			data[i + 0] = r;
			data[i + 1] = g;
			data[i + 2] = b;
			data[i + 3] = 1.0;
		}
	}

	// 2) Additively splat each softbox as a Gaussian-falloff radial disc.
	//    Wrap horizontally so a softbox near the seam doesn't have a cut edge.
	for (const box of boxes) {
		const cx = box.u * W;
		const cy = box.v * H;
		const r = box.radiusPx;
		// Compute a tight bbox to avoid scanning the full canvas.
		const x0 = Math.floor(cx - r * 2.2);
		const x1 = Math.ceil(cx + r * 2.2);
		const y0 = Math.max(0, Math.floor(cy - r * 2.2));
		const y1 = Math.min(H - 1, Math.ceil(cy + r * 2.2));
		const inv2sigSq = 1.0 / (2.0 * (r * 0.55) * (r * 0.55));
		const coreR = box.core[0];
		const coreG = box.core[1];
		const coreB = box.core[2];
		const haloR = box.halo[0];
		const haloG = box.halo[1];
		const haloB = box.halo[2];
		const haloStop = box.haloStop;
		for (let y = y0; y <= y1; y++) {
			for (let xRaw = x0; xRaw <= x1; xRaw++) {
				const x = ((xRaw % W) + W) % W; // wrap horizontally
				const dx = xRaw - cx;
				const dy = y - cy;
				const d2 = dx * dx + dy * dy;
				if (d2 > r * r * 4.84) continue;
				// Falloff: piecewise — core within haloStop * r, then fade to halo, then to 0.
				const d = Math.sqrt(d2);
				const dN = d / r; // 0..2.2
				// Smooth gaussian-ish falloff.
				const fall = Math.exp(-d2 * inv2sigSq);
				let cr: number, cg: number, cb: number;
				if (dN < haloStop) {
					const t = dN / haloStop;
					const ts = t * t * (3 - 2 * t);
					cr = coreR + (haloR - coreR) * ts;
					cg = coreG + (haloG - coreG) * ts;
					cb = coreB + (haloB - coreB) * ts;
				} else {
					const t = Math.min(1, (dN - haloStop) / (1.4 - haloStop));
					const ts = t * t * (3 - 2 * t);
					cr = haloR * (1 - ts);
					cg = haloG * (1 - ts);
					cb = haloB * (1 - ts);
				}
				const i = (y * W + x) * 4;
				data[i + 0] += cr * fall;
				data[i + 1] += cg * fall;
				data[i + 2] += cb * fall;
			}
		}
	}

	const tex = new THREE.DataTexture(
		data,
		W,
		H,
		THREE.RGBAFormat,
		THREE.FloatType,
	);
	tex.mapping = THREE.EquirectangularReflectionMapping;
	// Float data textures are LINEAR — do NOT mark as sRGB; PMREM expects linear.
	tex.colorSpace = THREE.LinearSRGBColorSpace;
	tex.minFilter = THREE.LinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.needsUpdate = true;
	return tex;
}

/* ──────────────────────────────────────────────────────────────────────
   4-pointed twinkle star sprite — a canvas texture used as the
   PointsMaterial map. Drawn at 128×128 with a sharp central cross
   and a soft glow halo. Additive blending stacks for clean twinkles.
   ────────────────────────────────────────────────────────────────────── */
function makeStarTexture(): HTMLCanvasElement {
	const S = 128;
	const cv = document.createElement('canvas');
	cv.width = S;
	cv.height = S;
	const ctx = cv.getContext('2d')!;
	const cx = S / 2;
	const cy = S / 2;

	// Soft halo so the star reads at small sizes.
	const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.45);
	halo.addColorStop(0.0, 'rgba(255,255,255,0.55)');
	halo.addColorStop(0.4, 'rgba(255,255,255,0.10)');
	halo.addColorStop(1.0, 'rgba(255,255,255,0.0)');
	ctx.fillStyle = halo;
	ctx.fillRect(0, 0, S, S);

	// Four blades — long thin diamonds drawn additively.
	ctx.globalCompositeOperation = 'lighter';
	const drawBlade = (vertical: boolean) => {
		const grad = vertical
			? ctx.createLinearGradient(cx, 0, cx, S)
			: ctx.createLinearGradient(0, cy, S, cy);
		grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
		grad.addColorStop(0.5, 'rgba(255,255,255,1.0)');
		grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
		ctx.fillStyle = grad;
		if (vertical) {
			ctx.beginPath();
			ctx.moveTo(cx, 0);
			ctx.lineTo(cx + 3, cy);
			ctx.lineTo(cx, S);
			ctx.lineTo(cx - 3, cy);
			ctx.closePath();
			ctx.fill();
		} else {
			ctx.beginPath();
			ctx.moveTo(0, cy);
			ctx.lineTo(cx, cy + 3);
			ctx.lineTo(S, cy);
			ctx.lineTo(cx, cy - 3);
			ctx.closePath();
			ctx.fill();
		}
	};
	drawBlade(true);
	drawBlade(false);

	// Pinpoint core.
	const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
	core.addColorStop(0.0, 'rgba(255,255,255,1.0)');
	core.addColorStop(1.0, 'rgba(255,255,255,0.0)');
	ctx.fillStyle = core;
	ctx.beginPath();
	ctx.arc(cx, cy, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';

	return cv;
}

/* ──────────────────────────────────────────────────────────────────────
   Anamorphic lens-flare streak — a wide horizontal smear with a hot
   white core, fading to flareColor at the ends. Drawn into a 1024×128
   canvas so the sprite stays sharp when stretched across the viewport.
   ────────────────────────────────────────────────────────────────────── */
function makeFlareTexture(color: string): HTMLCanvasElement {
	const W = 1024;
	const H = 128;
	const cv = document.createElement('canvas');
	cv.width = W;
	cv.height = H;
	const ctx = cv.getContext('2d')!;

	// Horizontal taper — long lobes either side of a hot core.
	const hgrad = ctx.createLinearGradient(0, 0, W, 0);
	hgrad.addColorStop(0.0, 'rgba(0,0,0,0)');
	hgrad.addColorStop(0.35, color + '80');
	hgrad.addColorStop(0.5, '#ffffff');
	hgrad.addColorStop(0.65, color + '80');
	hgrad.addColorStop(1.0, 'rgba(0,0,0,0)');
	ctx.fillStyle = hgrad;
	ctx.fillRect(0, 0, W, H);

	// Vertical taper — squeeze to a thin bright line at the centre.
	const vgrad = ctx.createLinearGradient(0, 0, 0, H);
	vgrad.addColorStop(0.0, 'rgba(0,0,0,1)');
	vgrad.addColorStop(0.42, 'rgba(0,0,0,0.4)');
	vgrad.addColorStop(0.5, 'rgba(0,0,0,0)');
	vgrad.addColorStop(0.58, 'rgba(0,0,0,0.4)');
	vgrad.addColorStop(1.0, 'rgba(0,0,0,1)');
	ctx.globalCompositeOperation = 'destination-out';
	ctx.fillStyle = vgrad;
	ctx.fillRect(0, 0, W, H);
	ctx.globalCompositeOperation = 'source-over';

	return cv;
}

/* ──────────────────────────────────────────────────────────────────────
   Y2K dynamic backdrop shader — full-screen plane behind the subject.

   Layers (back → front):
     1. Three-stop diagonal gradient (top-left → middle → bottom-right)
        as the base — same colours as before.
     2. Top "sun-streak": a wide soft horizontal glow band near the top
        whose hue cycles slowly across the gradient stops (60s loop).
     3. Pulsing radial blobs — 3 large soft-additive blobs in the preset
        accent palette, drifting in slow lissajous orbits (40-55s loop)
        with low-frequency intensity pulse.
     4. Chrome-stripe bands — slow-sliding wide diagonal stripes that
        modulate the background brightness by ±8%. Think Windows XP /
        Y2K album-cover "polished metal" sheen. 50s sweep period.
     5. Radial vignette — anchors the brightest area centre.
     6. Multi-step hash grain — film-grain texture so the gradient
        never reads plastic. NOT fract(sin) (catalog rule).

   Three style presets multiplex the accent colours so the bg sells the
   intended mood without competing with the chrome subject in front:
     • sunset-chrome   — warm pink/peach/gold accents (default)
     • cyber-magenta   — electric magenta/cyan/violet accents
     • cream-pearl     — soft cream/peach/butter accents

   The chrome reflections still sample the procedural HDR DataTexture —
   this shader is the DIRECTLY-VISIBLE backdrop only. Animation is
   intentionally slow (40–60s macro cycles) so it doesn't compete with
   the chrome subject.
   ────────────────────────────────────────────────────────────────────── */
const BG_VERT = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const BG_FRAG = /* glsl */ `
	precision highp float;
	// Coordinate spaces:
	//   vUv     — fragment UV [0..1]², origin bottom-left (per THREE convention)
	//   uv      — corrected to top-left origin (uv.y = 1 - vUv.y)
	//   diag    — projection of uv onto a 45° axis [0..1]
	//   c       — uv - 0.5 (centred at canvas centre, ±0.5)
	uniform vec3 u_top;
	uniform vec3 u_mid;
	uniform vec3 u_bot;
	uniform vec3 u_accentA;       // primary accent blob colour (preset)
	uniform vec3 u_accentB;       // secondary accent blob colour
	uniform vec3 u_accentC;       // tertiary accent / streak colour
	uniform float u_time;          // seconds since mount (eased by motion)
	uniform float u_stripeStrength;
	varying vec2 vUv;

	// Multi-step non-linear hash. NOT fract(sin) — that produces moire
	// bands at large angles (catalog rule).
	float hash(vec2 fc, float seed) {
		vec2 p = fract((fc + vec2(seed * 7919.0, seed * 1283.0)) * vec2(123.34, 456.21));
		p += dot(p, p + 45.32);
		return fract(p.x * p.y);
	}

	// Pulsing radial blob — soft Gaussian-ish falloff.
	float blob(vec2 p, vec2 centre, float radius) {
		float d = length(p - centre);
		return exp(-(d * d) / (radius * radius));
	}

	void main() {
		// uv: top-left origin so the "top" of the gradient really is at top.
		vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
		vec2 c = uv - 0.5;

		// ─── Layer 1: diagonal three-stop base gradient ──────────────
		float diag = clamp((uv.x + uv.y) * 0.5, 0.0, 1.0);
		vec3 col;
		if (diag < 0.5) {
			float t = diag * 2.0;
			t = t * t * (3.0 - 2.0 * t);
			col = mix(u_top, u_mid, t);
		} else {
			float t = (diag - 0.5) * 2.0;
			t = t * t * (3.0 - 2.0 * t);
			col = mix(u_mid, u_bot, t);
		}

		// ─── Layer 2: top sun-streak ─────────────────────────────────
		// Wide soft horizontal glow band near uv.y ~ 0.14.
		// Hue cycles slowly through the three accent colours (55s loop).
		float bandY = 0.14 + 0.06 * sin(u_time * (6.2831 / 55.0));
		float bandWidth = 0.22;
		float band = exp(-pow((uv.y - bandY) / bandWidth, 2.0));
		float hueCycle = u_time * (6.2831 / 55.0);
		vec3 streakHue =
			u_accentC * (0.55 + 0.45 * cos(hueCycle)) +
			u_accentA * (0.55 + 0.45 * cos(hueCycle + 2.094)) +
			u_accentB * (0.55 + 0.45 * cos(hueCycle + 4.188));
		streakHue *= 0.45;
		col += streakHue * band * 0.95;

		// ─── Layer 3: pulsing radial blobs ───────────────────────────
		// Three large soft blobs drifting in slow lissajous orbits.
		// 40-55s loops; intensity also pulses low-frequency.
		float tA = u_time * (6.2831 / 47.0);
		float tB = u_time * (6.2831 / 53.0);
		float tC = u_time * (6.2831 / 41.0);
		vec2 pA = vec2(0.5 + 0.32 * cos(tA), 0.55 + 0.22 * sin(tA * 0.83));
		vec2 pB = vec2(0.5 + 0.28 * cos(tB + 2.1), 0.45 + 0.26 * sin(tB * 0.71 + 1.3));
		vec2 pC = vec2(0.5 + 0.24 * cos(tC + 4.3), 0.6 + 0.20 * sin(tC * 0.91 + 2.7));
		float pulseA = 0.7 + 0.3 * sin(u_time * (6.2831 / 38.0));
		float pulseB = 0.7 + 0.3 * sin(u_time * (6.2831 / 44.0) + 1.8);
		float pulseC = 0.7 + 0.3 * sin(u_time * (6.2831 / 51.0) + 3.6);
		float bA = blob(uv, pA, 0.42);
		float bB = blob(uv, pB, 0.38);
		float bC = blob(uv, pC, 0.34);
		col += u_accentA * bA * pulseA * 0.42;
		col += u_accentB * bB * pulseB * 0.34;
		col += u_accentC * bC * pulseC * 0.28;

		// ─── Layer 4: chrome-stripe bands ────────────────────────────
		// Slow diagonal sliding stripes — modulate brightness ±12%.
		// Period 50s; ~3-4 wide bands sweep across the canvas.
		float stripePhase = (uv.x + uv.y) * 2.8 - u_time * (6.2831 / 50.0);
		float stripe = sin(stripePhase * 6.2831 / 2.8);
		// Sharper highs, soft lows — gives the polished-metal sheen.
		stripe = sign(stripe) * pow(abs(stripe), 1.4);
		col *= 1.0 + stripe * 0.13 * u_stripeStrength;

		// Secondary fine stripes for a layered chrome read (lower amp).
		float fineStripe = sin((uv.x - uv.y) * 12.0 - u_time * (6.2831 / 73.0) * 14.0);
		col *= 1.0 + fineStripe * 0.05 * u_stripeStrength;

		// ─── Layer 5: radial vignette ────────────────────────────────
		float r2 = dot(c, c);
		float vig = 1.0 - smoothstep(0.18, 0.95, r2) * 0.55;
		col *= vig;

		// ─── Layer 6: filmic grain ───────────────────────────────────
		// fast-wrapping per-frame seed (catalog pattern).
		float seed = fract(u_time * 71.41);
		float g = hash(gl_FragCoord.xy, seed) - 0.5;
		col += g * 0.015;

		gl_FragColor = vec4(col, 1.0);
	}
`;

// Accent palettes for the three bgStyle presets. RGB in linear-ish
// display range (the shader adds them to the gradient; no HDR needed
// since this plane is NOT the env map).
const BG_ACCENTS: Record<BgStyle, { a: [number, number, number]; b: [number, number, number]; c: [number, number, number] }> = {
	'sunset-chrome': {
		a: [1.00, 0.28, 0.55], // hot magenta-pink (stronger pop)
		b: [1.00, 0.75, 0.30], // gold
		c: [0.35, 0.80, 1.00], // cyan streak accent
	},
	'cyber-magenta': {
		a: [1.00, 0.20, 0.85], // electric magenta
		b: [0.30, 0.85, 1.00], // cyan
		c: [0.65, 0.45, 1.00], // violet
	},
	'cream-pearl': {
		a: [1.00, 0.88, 0.72], // cream
		b: [1.00, 0.72, 0.58], // peach
		c: [0.92, 0.82, 1.00], // butter-lilac
	},
};

export default function ThreeStage(props: StageProps) {
	const {
		rootRef,
		size,
		input,
		reducedMotion,
		layout,
		logo,
		useGlbMaterials,
		bevelDepth,
		logoColor,
		logoMetalness,
		logoRoughness,
		clearcoatStrength,
		envMapIntensity,
		logoScale,
		pointerStrength,
		autoRotateSpeed,
		envPreset,
		bgStyle,
		bgMotion,
		gradientTop,
		gradientMiddle,
		gradientBottom,
		starCount,
		starColor,
		starDriftSpeed,
		flareStrength,
		flareColor,
	} = props;

	const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
	const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
	const sceneRef = React.useRef<THREE.Scene | null>(null);
	const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
	const groupRef = React.useRef<THREE.Group | null>(null);
	const meshRef = React.useRef<THREE.Object3D | null>(null);
	const materialRef = React.useRef<THREE.MeshPhysicalMaterial | null>(null);
	const pmremRef = React.useRef<THREE.PMREMGenerator | null>(null);
	const envRTRef = React.useRef<THREE.WebGLRenderTarget | null>(null);

	// Track which GLB meshes have been visited so we can boost their
	// envMapIntensity without overwriting the authored PBR params.
	const glbMatTrackedRef = React.useRef<Set<THREE.Material>>(new Set());

	const bgMeshRef = React.useRef<THREE.Mesh | null>(null);
	const bgMatRef = React.useRef<THREE.ShaderMaterial | null>(null);

	const starsRef = React.useRef<THREE.Points | null>(null);
	const starMatRef = React.useRef<THREE.ShaderMaterial | null>(null);
	const starDataRef = React.useRef<{
		positions: Float32Array;
		basePos: Float32Array;
		phases: Float32Array;
		periods: Float32Array;
		baseSizes: Float32Array;
		opacities: Float32Array;
		sizes: Float32Array;
	} | null>(null);
	const starTexRef = React.useRef<THREE.CanvasTexture | null>(null);

	const flareGroupRef = React.useRef<THREE.Group | null>(null);
	const flareSpritesRef = React.useRef<THREE.Sprite[]>([]);
	const flareTexRef = React.useRef<THREE.CanvasTexture | null>(null);
	const flareStateRef = React.useRef<
		Array<{ y: number; dir: number; phase: number; baseOpacity: number; speed: number }>
	>([]);

	const yawRef = React.useRef(0);
	const pitchRef = React.useRef(0);
	const autoYawRef = React.useRef(0);
	const logoAspectRef = React.useRef(1);
	const bgTimeRef = React.useRef(0);

	type CachedLoad =
		| { kind: 'shapes'; shapes: THREE.Shape[]; aspect: number; key: string }
		| { kind: 'object'; object: THREE.Object3D; aspect: number; bbox: THREE.Box3; key: string };
	const loadedRef = React.useRef<CachedLoad | null>(null);
	const [shapesVersion, setShapesVersion] = React.useState(0);

	// Hold the hero "not ready" until loadLogo3D settles (resolve OR error).
	// The logo geometry is fetched/parsed off-DOM and fed into a GL mesh, so
	// the readiness system can't see it — gate on the load's terminal paths.
	const [assetReady, setAssetReady] = React.useState(false);
	useHeroAssetGate(assetReady);

	// ───── Renderer + scene init ───────────────────────────────────────
	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			premultipliedAlpha: false,
			powerPreference: 'high-performance',
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.05;
		renderer.setClearColor(0x000000, 0);
		rendererRef.current = renderer;

		const scene = new THREE.Scene();
		// scene.background stays null — gradient plane handles backdrop.
		// (Skill anti-pattern: don't `scene.background = equirectTexture`.)
		scene.background = null;
		sceneRef.current = scene;

		const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
		camera.position.set(0, 0, 5);
		camera.lookAt(0, 0, 0);
		cameraRef.current = camera;

		const group = new THREE.Group();
		scene.add(group);
		groupRef.current = group;

		// Gradient backdrop plane — full-screen quad (NDC, depth disabled).
		const bgGeom = new THREE.PlaneGeometry(2, 2);
		const initialAccents = BG_ACCENTS[bgStyle] ?? BG_ACCENTS['sunset-chrome'];
		const bgMat = new THREE.ShaderMaterial({
			vertexShader: BG_VERT,
			fragmentShader: BG_FRAG,
			depthWrite: false,
			depthTest: false,
			uniforms: {
				u_top: { value: hex(gradientTop) },
				u_mid: { value: hex(gradientMiddle) },
				u_bot: { value: hex(gradientBottom) },
				u_accentA: { value: new THREE.Color(initialAccents.a[0], initialAccents.a[1], initialAccents.a[2]) },
				u_accentB: { value: new THREE.Color(initialAccents.b[0], initialAccents.b[1], initialAccents.b[2]) },
				u_accentC: { value: new THREE.Color(initialAccents.c[0], initialAccents.c[1], initialAccents.c[2]) },
				u_time: { value: 0 },
				u_stripeStrength: { value: 1.0 },
			},
		});
		const bgMesh = new THREE.Mesh(bgGeom, bgMat);
		bgMesh.frustumCulled = false;
		bgMesh.renderOrder = -10;
		scene.add(bgMesh);
		bgMeshRef.current = bgMesh;
		bgMatRef.current = bgMat;

		// Lens-flare sprite group — in front of the logo.
		const flareGroup = new THREE.Group();
		flareGroup.position.z = 2.5;
		scene.add(flareGroup);
		flareGroupRef.current = flareGroup;

		pmremRef.current = new THREE.PMREMGenerator(renderer);
		pmremRef.current.compileEquirectangularShader();

		return () => {
			renderer.dispose();
			pmremRef.current?.dispose();
			pmremRef.current = null;
			envRTRef.current?.dispose();
			envRTRef.current = null;
			if (meshRef.current) {
				meshRef.current.traverse?.((child: any) => {
					if (child.isMesh) {
						(child.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
					}
				});
			}
			materialRef.current?.dispose?.();
			materialRef.current = null;
			bgMatRef.current?.dispose();
			bgMeshRef.current?.geometry.dispose();
			starsRef.current?.geometry.dispose();
			(starsRef.current?.material as THREE.ShaderMaterial | undefined)?.dispose?.();
			starMatRef.current?.dispose();
			starTexRef.current?.dispose();
			for (const s of flareSpritesRef.current) {
				(s.material as THREE.SpriteMaterial).dispose();
			}
			flareTexRef.current?.dispose();
			rendererRef.current = null;
			sceneRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ───── Resize ─────────────────────────────────────────────────────
	React.useEffect(() => {
		const renderer = rendererRef.current;
		const camera = cameraRef.current;
		if (!renderer || !camera) return;
		const w = Math.max(1, Math.floor(size.width));
		const h = Math.max(1, Math.floor(size.height));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}, [size.width, size.height]);

	// ───── Background gradient colours (in-place mutation) ────────────
	React.useEffect(() => {
		const mat = bgMatRef.current;
		if (!mat) return;
		(mat.uniforms.u_top.value as THREE.Color).set(gradientTop);
		(mat.uniforms.u_mid.value as THREE.Color).set(gradientMiddle);
		(mat.uniforms.u_bot.value as THREE.Color).set(gradientBottom);
	}, [gradientTop, gradientMiddle, gradientBottom]);

	// ───── Background style (accent colours, mutated in place) ────────
	React.useEffect(() => {
		const mat = bgMatRef.current;
		if (!mat) return;
		const acc = BG_ACCENTS[bgStyle] ?? BG_ACCENTS['sunset-chrome'];
		(mat.uniforms.u_accentA.value as THREE.Color).setRGB(acc.a[0], acc.a[1], acc.a[2]);
		(mat.uniforms.u_accentB.value as THREE.Color).setRGB(acc.b[0], acc.b[1], acc.b[2]);
		(mat.uniforms.u_accentC.value as THREE.Color).setRGB(acc.c[0], acc.c[1], acc.c[2]);
	}, [bgStyle]);

	// ───── Environment (PMREM-prefiltered procedural HDR) ─────────────
	React.useEffect(() => {
		const renderer = rendererRef.current;
		const scene = sceneRef.current;
		const pmrem = pmremRef.current;
		if (!renderer || !scene || !pmrem) return;
		const eqTex = buildHDRTexture(envPreset);
		const rt = pmrem.fromEquirectangular(eqTex);
		eqTex.dispose();
		envRTRef.current?.dispose();
		envRTRef.current = rt;
		scene.environment = rt.texture;
	}, [envPreset]);

	// ───── Logo loading (shapes OR GLB) ───────────────────────────────
	React.useEffect(() => {
		const controller = new AbortController();
		loadLogo3D(logo, {
			signal: controller.signal,
			svgCurveResolution: 64,
			maxRasterGrid: 220,
		})
			.then((result) => {
				if (controller.signal.aborted) return;
				if (result.kind === 'shapes') {
					if (result.shapes.length === 0) {
						console.warn('[chrome-mascot-logo] no shapes parsed from', logo);
						// Terminal path — nothing to render, but the load settled.
						setAssetReady(true);
						return;
					}
					loadedRef.current = {
						kind: 'shapes',
						shapes: result.shapes,
						aspect: result.aspect,
						key: logo,
					};
				} else {
					loadedRef.current = {
						kind: 'object',
						object: result.object,
						aspect: result.aspect,
						bbox: result.bbox,
						key: logo,
					};
				}
				logoAspectRef.current = result.aspect;
				glbMatTrackedRef.current = new Set();
				setShapesVersion((v) => v + 1);
				setAssetReady(true);
			})
			.catch((err) => {
				if (controller.signal.aborted) return;
				console.warn('[chrome-mascot-logo] logo load failed:', err);
				// Error terminal path — open the gate so readiness can't hang.
				setAssetReady(true);
			});
		return () => controller.abort();
	}, [logo]);

	// Build / configure the chrome material. MeshPhysicalMaterial gives
	// us optional clearcoat for extra polish.
	const ensureChromeMaterial = React.useCallback((): THREE.MeshPhysicalMaterial => {
		let mat = materialRef.current;
		if (!mat) {
			mat = new THREE.MeshPhysicalMaterial({
				color: hex(logoColor),
				metalness: logoMetalness,
				roughness: logoRoughness,
				envMapIntensity,
				clearcoat: clearcoatStrength,
				clearcoatRoughness: 0.03,
			});
			materialRef.current = mat;
		}
		return mat;
	}, [logoColor, logoMetalness, logoRoughness, envMapIntensity, clearcoatStrength]);

	// ───── Build mesh from cached load + bevelDepth ───────────────────
	const buildGenRef = React.useRef(0);
	React.useEffect(() => {
		const scene = sceneRef.current;
		const group = groupRef.current;
		const cached = loadedRef.current;
		if (!scene || !group || !cached) return;

		const mat = ensureChromeMaterial();

		if (cached.kind === 'object') {
			if (meshRef.current) {
				const old = meshRef.current;
				group.remove(old);
				old.traverse?.((child: any) => {
					if (child.isMesh) {
						(child.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
					}
				});
				meshRef.current = null;
			}
			const root = cached.object;
			glbMatTrackedRef.current = new Set();
			if (!useGlbMaterials) {
				root.traverse((child: any) => {
					if (child.isMesh) child.material = mat;
				});
			} else {
				// Keep authored GLB materials, but BOOST their envMapIntensity
				// so the chrome reflections punch through. Some GLBs ship at
				// 1.0; we want 1.4 by default to match the chrome material.
				root.traverse((child: any) => {
					if (child.isMesh && child.material) {
						const mats = Array.isArray(child.material) ? child.material : [child.material];
						for (const m of mats) {
							if (m && 'envMapIntensity' in m) {
								(m as any).envMapIntensity = envMapIntensity;
								(m as any).needsUpdate = true;
								glbMatTrackedRef.current.add(m);
							}
						}
					}
				});
			}
			group.add(root);
			meshRef.current = root;
			return;
		}

		// Shapes path — extrude with a chunky bevel for the Y2K feel.
		const gen = ++buildGenRef.current;
		const handle = setTimeout(() => {
			if (buildGenRef.current !== gen) return;
			if (!groupRef.current || !sceneRef.current) return;
			const stillCached = loadedRef.current;
			if (!stillCached || stillCached.kind !== 'shapes') return;

			const depth = 0.18 + bevelDepth * 0.45;
			const bevelSize = 0.03 + bevelDepth * 0.085;
			const bevelThickness = 0.03 + bevelDepth * 0.10;
			const bevelSegments = Math.max(3, Math.round(5 + bevelDepth * 8));
			const curveSegments = Math.max(
				14,
				Math.round(30 / Math.sqrt(bevelSegments + 1)),
			);

			const geom = new THREE.ExtrudeGeometry(stillCached.shapes, {
				depth,
				bevelEnabled: true,
				bevelSize,
				bevelThickness,
				bevelSegments,
				curveSegments,
				steps: 1,
			});
			if (buildGenRef.current !== gen) {
				geom.dispose();
				return;
			}
			geom.translate(0, 0, -depth / 2);
			geom.computeVertexNormals();
			geom.computeBoundingBox();

			if (meshRef.current) {
				const old = meshRef.current;
				group.remove(old);
				old.traverse?.((child: any) => {
					if (child.isMesh) {
						(child.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
					}
				});
				meshRef.current = null;
			}
			const mesh = new THREE.Mesh(geom, mat);
			group.add(mesh);
			meshRef.current = mesh;
		}, 0);
		return () => clearTimeout(handle);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shapesVersion, bevelDepth, useGlbMaterials]);

	// ───── Chrome material updates (in-place) ─────────────────────────
	React.useEffect(() => {
		const mat = materialRef.current;
		if (mat) {
			mat.color.set(logoColor);
			mat.metalness = logoMetalness;
			mat.roughness = logoRoughness;
			mat.envMapIntensity = envMapIntensity;
			mat.clearcoat = clearcoatStrength;
			mat.needsUpdate = true;
		}
		// Also push envMapIntensity to any tracked GLB materials so the
		// slider works for both branches.
		for (const m of glbMatTrackedRef.current) {
			if (m && 'envMapIntensity' in m) {
				(m as any).envMapIntensity = envMapIntensity;
				(m as any).needsUpdate = true;
			}
		}
	}, [logoColor, logoMetalness, logoRoughness, envMapIntensity, clearcoatStrength]);

	// ───── Stars: build once at the resolved count, then mutate ───────
	React.useEffect(() => {
		const scene = sceneRef.current;
		if (!scene) return;
		const oldPoints = starsRef.current;
		if (oldPoints) {
			scene.remove(oldPoints);
			oldPoints.geometry.dispose();
			(oldPoints.material as THREE.ShaderMaterial).dispose();
			starsRef.current = null;
			starMatRef.current = null;
		}
		if (!starTexRef.current) {
			const tex = new THREE.CanvasTexture(makeStarTexture());
			tex.minFilter = THREE.LinearFilter;
			tex.magFilter = THREE.LinearFilter;
			tex.colorSpace = THREE.SRGBColorSpace;
			starTexRef.current = tex;
		}

		const n = Math.max(0, Math.min(100, Math.round(starCount)));
		if (n === 0) {
			starDataRef.current = null;
			return;
		}

		// Deterministic positions so SSR / first-render are stable.
		const seed = 0x9E37 ^ n;
		let s = seed >>> 0;
		const rng = () => {
			s = (s * 1664525 + 1013904223) >>> 0;
			return s / 0xffffffff;
		};

		const positions = new Float32Array(n * 3);
		const basePos = new Float32Array(n * 3);
		const phases = new Float32Array(n);
		const periods = new Float32Array(n);
		const baseSizes = new Float32Array(n);
		const opacities = new Float32Array(n);
		const sizes = new Float32Array(n);

		// Stars sit at z = -2 group, view frustum at that depth covers
		// roughly ±2.7 in X and ±1.6 in Y at 1440x900 / fov 34°. Spread
		// stars over a slightly wider area so they fill the canvas at
		// any aspect ratio, with rejection sampling to keep an empty
		// halo around the logo.
		for (let i = 0; i < n; i++) {
			let x = 0;
			let y = 0;
			for (let attempt = 0; attempt < 12; attempt++) {
				x = (rng() - 0.5) * 7.0;
				y = (rng() - 0.5) * 4.0;
				if (Math.sqrt(x * x + y * y) > 1.5) break;
			}
			const z = (rng() - 0.5) * 1.0;
			basePos[i * 3 + 0] = x;
			basePos[i * 3 + 1] = y;
			basePos[i * 3 + 2] = z;
			positions[i * 3 + 0] = x;
			positions[i * 3 + 1] = y;
			positions[i * 3 + 2] = z;
			phases[i] = rng() * Math.PI * 2;
			periods[i] = 1.5 + rng() * 4.0;
			baseSizes[i] = 0.12 + rng() * 0.32;
			opacities[i] = 1.0;
			sizes[i] = baseSizes[i];
		}

		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geom.setAttribute('a_size', new THREE.BufferAttribute(sizes, 1));
		geom.setAttribute('a_opacity', new THREE.BufferAttribute(opacities, 1));

		const starMat = new THREE.ShaderMaterial({
			uniforms: {
				u_map: { value: starTexRef.current },
				u_color: { value: hex(starColor) },
				u_pixelRatio: { value: rendererRef.current?.getPixelRatio() ?? 1 },
				u_resolutionY: { value: size.height || 720 },
			},
			vertexShader: /* glsl */ `
				attribute float a_size;
				attribute float a_opacity;
				varying float v_opacity;
				uniform float u_pixelRatio;
				uniform float u_resolutionY;
				void main() {
					v_opacity = a_opacity;
					vec4 mv = modelViewMatrix * vec4(position, 1.0);
					gl_Position = projectionMatrix * mv;
					float perspectiveScale = (u_resolutionY * 0.5) / max(0.1, -mv.z);
					gl_PointSize = clamp(a_size * perspectiveScale * 0.45, 4.0, 100.0) * u_pixelRatio;
				}
			`,
			fragmentShader: /* glsl */ `
				precision highp float;
				uniform sampler2D u_map;
				uniform vec3 u_color;
				varying float v_opacity;
				void main() {
					vec4 t = texture2D(u_map, gl_PointCoord);
					vec3 col = t.rgb * u_color;
					float a = t.a * v_opacity;
					gl_FragColor = vec4(col * a, a);
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});

		const pts = new THREE.Points(geom, starMat);
		pts.position.z = -2;
		pts.renderOrder = 1;
		pts.frustumCulled = false;
		scene.add(pts);
		starsRef.current = pts;
		starMatRef.current = starMat;
		starDataRef.current = {
			positions,
			basePos,
			phases,
			periods,
			baseSizes,
			opacities,
			sizes,
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [starCount]);

	React.useEffect(() => {
		const mat = starMatRef.current;
		if (!mat) return;
		(mat.uniforms.u_color.value as THREE.Color).set(starColor);
	}, [starColor]);

	React.useEffect(() => {
		const mat = starMatRef.current;
		if (!mat) return;
		mat.uniforms.u_resolutionY.value = Math.max(1, size.height);
		mat.uniforms.u_pixelRatio.value = rendererRef.current?.getPixelRatio() ?? 1;
	}, [size.height, size.width]);

	// ───── Lens flares — three anamorphic streak sprites ──────────────
	React.useEffect(() => {
		const scene = sceneRef.current;
		const group = flareGroupRef.current;
		if (!scene || !group) return;
		for (const s of flareSpritesRef.current) {
			group.remove(s);
			(s.material as THREE.SpriteMaterial).dispose();
		}
		flareSpritesRef.current = [];
		flareTexRef.current?.dispose();

		const tex = new THREE.CanvasTexture(makeFlareTexture(flareColor));
		tex.minFilter = THREE.LinearFilter;
		tex.magFilter = THREE.LinearFilter;
		tex.colorSpace = THREE.SRGBColorSpace;
		flareTexRef.current = tex;

		const N = 3;
		const states: Array<{
			y: number;
			dir: number;
			phase: number;
			baseOpacity: number;
			speed: number;
		}> = [];
		for (let i = 0; i < N; i++) {
			const baseY = (i - (N - 1) / 2) * 1.4 + (i % 2 ? 0.3 : -0.2);
			const dir = i % 2 ? 1 : -1;
			const phase = i * 2.3;
			const speed = 0.12 + (i % 2) * 0.05;
			const baseOpacity = 0.7 - i * 0.12;

			const mat = new THREE.SpriteMaterial({
				map: tex,
				color: 0xffffff,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				depthTest: false,
				opacity: 0.0,
			});
			const sprite = new THREE.Sprite(mat);
			sprite.scale.set(16.0, 0.95, 1.0);
			sprite.position.set(0, baseY, 0);
			sprite.renderOrder = 5;
			group.add(sprite);
			flareSpritesRef.current.push(sprite);

			states.push({ y: baseY, dir, phase, baseOpacity, speed });
		}
		flareStateRef.current = states;
	}, [flareColor]);

	// ───── Animation loop ──────────────────────────────────────────────
	useHeroAnimationFrame(rootRef, ({ delta, elapsed }) => {
		const renderer = rendererRef.current;
		const scene = sceneRef.current;
		const camera = cameraRef.current;
		const group = groupRef.current;
		if (!renderer || !scene || !camera || !group) return;

		if (bgMatRef.current) {
			// Accumulate motion-scaled time so the bgMotion slider can pause
			// (or accelerate) the backdrop without affecting any other layer.
			// Reduced motion → freeze ambient backdrop motion (skill rule).
			const motionScale = reducedMotion ? 0 : Math.max(0, bgMotion);
			bgTimeRef.current += delta * motionScale;
			bgMatRef.current.uniforms.u_time.value = bgTimeRef.current;
		}

		// Layout X — push the subject opposite to the content.
		const layoutX =
			layout === 'content-left' ? 0.9 : layout === 'content-right' ? -0.9 : 0.0;

		// Pointer parallax: ±15° yaw, ±10° pitch at strength 1.
		const px = (input?.x ?? 0.5) * 2 - 1;
		const py = (input?.y ?? 0.5) * 2 - 1;
		const yawMax = (15 * Math.PI) / 180;
		const pitchMax = (10 * Math.PI) / 180;
		const targetYaw = -px * yawMax * pointerStrength;
		const targetPitch = py * pitchMax * pointerStrength;
		// ~180ms time constant → ease coefficient ~5.5/s.
		const ease = 1 - Math.exp(-delta * 5.5);
		yawRef.current += (targetYaw - yawRef.current) * ease;
		pitchRef.current += (targetPitch - pitchRef.current) * ease;

		if (!reducedMotion && autoRotateSpeed > 0) {
			autoYawRef.current += delta * autoRotateSpeed;
		}

		const aspect = logoAspectRef.current || 1;
		const fitScale = aspect > 1 ? 1.7 / aspect : 1.7;
		const finalScale = logoScale * fitScale * 0.85;
		group.position.set(layoutX, 0, 0);
		group.scale.setScalar(finalScale);
		group.rotation.set(
			pitchRef.current,
			autoYawRef.current + yawRef.current,
			0,
		);

		// ─── Stars — twinkle + drift ──────────────────────────────────
		const stars = starsRef.current;
		const data = starDataRef.current;
		if (stars && data) {
			const geom = stars.geometry as THREE.BufferGeometry;
			const posAttr = geom.attributes.position as THREE.BufferAttribute;
			const sizeAttr = geom.attributes.a_size as THREE.BufferAttribute;
			const opAttr = geom.attributes.a_opacity as THREE.BufferAttribute;
			const t = elapsed;
			const drift = starDriftSpeed;
			for (let i = 0; i < data.phases.length; i++) {
				const phase = data.phases[i];
				const period = data.periods[i];
				const tw = 0.55 + 0.45 * Math.sin((t / period) * Math.PI * 2 + phase);
				const op = reducedMotion ? 0.7 : 0.18 + tw * 0.82;
				const sz = data.baseSizes[i] * (0.85 + tw * 0.35);
				opAttr.array[i] = op;
				sizeAttr.array[i] = sz;
				if (!reducedMotion && drift > 0) {
					const ax = data.basePos[i * 3 + 0];
					const ay = data.basePos[i * 3 + 1];
					const az = data.basePos[i * 3 + 2];
					const dx = Math.sin(t * 0.05 * drift + phase) * 0.20;
					const dy = Math.cos(t * 0.04 * drift + phase * 1.3) * 0.15;
					posAttr.array[i * 3 + 0] = ax + dx;
					posAttr.array[i * 3 + 1] = ay + dy;
					posAttr.array[i * 3 + 2] = az;
				}
			}
			posAttr.needsUpdate = true;
			sizeAttr.needsUpdate = true;
			opAttr.needsUpdate = true;
		}

		// ─── Lens flares — slow drift with envelope ───────────────────
		const flares = flareSpritesRef.current;
		const states = flareStateRef.current;
		if (flares.length && states.length) {
			for (let i = 0; i < flares.length; i++) {
				const st = states[i];
				const s = flares[i];
				// X drift in world units. Camera frustum at z=2.5 + camera
				// at z=5 means visible X ~ ±0.75 — so a drift range of 2
				// gives a flare that arcs from off-canvas left to right.
				const tx = Math.sin(elapsed * st.speed + st.phase) * 2.0 * st.dir;
				const ty = st.y + Math.sin(elapsed * 0.13 + st.phase) * 0.12;
				s.position.set(tx, ty, 0);
				s.material.rotation = Math.sin(elapsed * 0.09 + st.phase) * 0.05;

				const env = Math.max(
					0,
					0.5 + 0.5 * Math.sin(elapsed * 0.18 + st.phase * 1.7),
				);
				const op = reducedMotion
					? st.baseOpacity * 0.35 * flareStrength
					: env * env * st.baseOpacity * flareStrength;
				s.material.opacity = op;
			}
		}

		renderer.render(scene, camera);
	});

	return (
		<canvas
			ref={canvasRef}
			className="crazygl-cml-canvas"
			aria-hidden="true"
		/>
	);
}
