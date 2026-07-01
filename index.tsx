import * as React from 'react';
import CrazyGLWrapper, {
	useContent,
	useHeroReady,
	type HeroComponentProps,
} from '@crazygl/core';
import metadata from './metadata.json';
import './style.css';

/* ─────────────────────────────────────────────────────────────────────────
   Chrome Mascot Logo — Y2K chrome object floating over a gradient sky
   with twinkling 4-pointed stars and slow anamorphic lens flares.

   Physics statement (chrome material)
     • F0-tinted PURE mirror per the skill's metal catalog. At
       `metallic = 1`, the base color IS F0 — reflection IS the surface,
       there's no separate diffuse term. We use MeshPhysicalMaterial
       with `metalness: 1.0`, `roughness: 0.08`, and optional clearcoat
       for the extra polish (clearcoat is a thin dielectric layer over
       the metal — adds a small specular highlight on top of the metal
       reflection).
     • Schlick Fresnel is built into MeshPhysicalMaterial's
       Cook-Torrance BRDF; we don't tint a gradient.
     • envMapIntensity defaults to 1.4 (boost beyond 1) — needed because
       the procedural HDRI's bright softboxes need to read as PUNCHY
       speculars on the chrome, not "smooth grey."

   Physics statement (procedural HDRI)
     • A Float32 equirectangular DataTexture (1024×512, linear RGB,
       NO sRGB tag) built procedurally in JS. Bright sun cores reach
       linear values 8-12; secondary key/fill softboxes reach 3-5;
       ambient sky stays 0.3-1.5. PMREM prefilters into a roughness
       mip chain that MeshPhysicalMaterial samples.
     • Layout: vertical 5-stop sky-to-floor gradient + ONE bright "sun"
       disc + ~10 discrete radial softboxes scattered at various
       lat/lon + warm/cool floor bounce blobs. NO horizontal continuous
       structure (skill rule — those stretch around the chrome's
       equator and look like a stretched stripe).
     • Three presets: Sunset (warm), Cyber (electric cyan/magenta),
       Cream (soft warm). All three use HDR cores.

   Other layers
     • Gradient backdrop: a canvas-spanning ShaderMaterial plane behind
       the logo with a custom Y2K three-stop diagonal gradient + radial
       vignette + sub-1% grain. Visible to the camera (not just
       reflected — the chrome reflects the HDRI, not this plane).
     • Stars: 4-pointed twinkle sprites rendered as Points with a custom
       shader + canvas-generated 4-pointed-star texture, additive blend.
       Per-star phase → sin-driven opacity + scale pulse + slow lissajous
       drift. Distinct from "dots" — the silhouette is a real 4-pointed
       star.
     • Lens flares: 3 anamorphic horizontal streaks (long thin Sprites
       with a horizontal radial-gradient texture, additive). Slow X
       drift across the canvas with a squared sine envelope so they
       feel rare, not constant.
     • Pointer: drives logo yaw ±15° and pitch ±10°. ~180ms time
       constant for the springy feel.
     • Auto-rotate: default speed 0 (skill rule: opt-in autonomous
       rotation). User can dial in continuous Y spin (0..0.3 rad/s).

   References
     - three.js MeshPhysicalMaterial source (Cook-Torrance BRDF).
     - Karis 2013 "Real Shading in Unreal Engine 4" — F0 + Schlick.
     - PMREMGenerator (three.js docs) — prefiltered roughness mip chain.
     - iq HDRI rules: discrete radial features only; no horizontal bands.

   Coordinate spaces
     fragCoord — pixel coords on the canvas [0..res.x] × [0..res.y]
     ndc       — three normalised device coords [-1..1]²
     world     — three scene units; logo near origin, camera at (0, 0, 5).
                 Gradient plane is a full-screen NDC quad with no depth.
     equirect  — HDRI canvas coords; U=longitude (0..1), V=latitude
                 (0=top, 1=bottom). PMREM remaps via reflect(viewDir, N).
     u_input   — runtime pointer 0..1 (top-left origin); mapped to
                 ±yaw / ±pitch on the group rotation.
   ───────────────────────────────────────────────────────────────────────── */

const ThreeStage = React.lazy(() => import('./ThreeStage'));

type LayoutMode = 'centered' | 'content-left' | 'content-right';
type EnvPreset = 'Sunset' | 'Cyber' | 'Cream';

function ChromeMascotLogoHero(props: HeroComponentProps) {
	const {
		size,
		input,
		reducedMotion,
		rootRef,
		layout = 'content-left' as LayoutMode,
		logo = 'https://crazygl.com/samples/logo-shape1.png',
		useGlbMaterials = false,
		bevelDepth = 0.25,
		logoColor = '#f6f8fc',
		logoMetalness = 0.92,
		logoRoughness = 0.125,
		clearcoatStrength = 1.0,
		envMapIntensity = 1.4,
		logoScale = 0.87,
		pointerStrength = 1.0,
		autoRotateSpeed = 0.045,
		envPreset = 'Sunset' as EnvPreset,
		bgStyle = 'sunset-chrome',
		bgMotion = 1.0,
		gradientTop = '#5beaff',
		gradientMiddle = '#ff5fb1',
		gradientBottom = '#ffc56b',
		starCount = 40,
		starColor = '#fff7e6',
		starDriftSpeed = 0.4,
		flareStrength = 0.6,
		flareColor = '#fff2c8',
	} = props as any;

	const content = useContent(props);
	useHeroReady(props);
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const contentAlign: React.CSSProperties =
		layout === 'content-left'
			? { justifyContent: 'flex-start', textAlign: 'left' }
			: layout === 'content-right'
				? { justifyContent: 'flex-end', textAlign: 'right' }
				: { justifyContent: 'center', textAlign: 'center' };

	return (
		<>
			<crazygl-stage
				style={
					{
						position: 'absolute',
						inset: 0,
						zIndex: 0,
						overflow: 'hidden',
						background: '#0a0612',
					} as React.CSSProperties
				}
			>
				{mounted ? (
					<React.Suspense fallback={null}>
						<ThreeStage
							rootRef={rootRef}
							size={size}
							input={input}
							reducedMotion={reducedMotion}
							layout={layout}
							logo={logo}
							useGlbMaterials={useGlbMaterials}
							bevelDepth={bevelDepth}
							logoColor={logoColor}
							logoMetalness={logoMetalness}
							logoRoughness={logoRoughness}
							clearcoatStrength={clearcoatStrength}
							envMapIntensity={envMapIntensity}
							logoScale={logoScale}
							pointerStrength={pointerStrength}
							autoRotateSpeed={autoRotateSpeed}
							envPreset={envPreset}
							bgStyle={bgStyle}
							bgMotion={bgMotion}
							gradientTop={gradientTop}
							gradientMiddle={gradientMiddle}
							gradientBottom={gradientBottom}
							starCount={starCount}
							starColor={starColor}
							starDriftSpeed={starDriftSpeed}
							flareStrength={flareStrength}
							flareColor={flareColor}
						/>
					</React.Suspense>
				) : null}
			</crazygl-stage>
			<crazygl-content
				style={
					{
						position: 'absolute',
						inset: 0,
						display: 'flex',
						alignItems: 'center',
						zIndex: 1,
						pointerEvents: 'none',
						...contentAlign,
					} as React.CSSProperties
				}
			>
				<div className="crazygl-cml-content">{content.node}</div>
			</crazygl-content>
		</>
	);
}

export { metadata };
export default function ChromeMascotLogo(props: any) {
	return <CrazyGLWrapper hero={ChromeMascotLogoHero} metadata={metadata as any} {...props} />;
}
