<sub>*Hero made by [@ybouane](https://x.com/ybouane).*</sub>
<p align="center">
  <img src="https://crazygl.com/heroes/hero-chrome-mascot-logo/banner-full.png" alt="Chrome Mascot Logo" width="640">
</p>

# @crazygl/hero-chrome-mascot-logo

Your logo or mascot reborn as a chunky Y2K chrome object floating over a sunset gradient with twinkling stars and slow anamorphic lens flares. Real PBR mirror metal lit by a procedural HDR environment.

## Demo
[Chrome Mascot Logo](https://crazygl.com/hero/chrome-mascot-logo)

## Install

```bash
npm install @crazygl/hero-chrome-mascot-logo
```

## Usage

```tsx
import ChromeMascotLogo from '@crazygl/hero-chrome-mascot-logo';

export default function Page() {
  return (
    <ChromeMascotLogo
      logo="https://crazygl.com/samples/logo-shape1.png"
      envPreset="Sunset"
      autoRotateSpeed={0.045}
    />
  );
}
```

Drop in an SVG or PNG and the silhouette is extruded into a thick bevelled shape; hand it a GLB/GLTF and your actual 3D model takes the stage (keep its materials or override every mesh with the chrome look).

## Customise

- **Logo** — SVG/PNG silhouette (extruded + bevelled) or GLB/GLTF model; `useGlbMaterials`, `bevelDepth`.
- **Chrome material** — `logoColor` (F0 tint), `logoMetalness`, `logoRoughness`, `clearcoatStrength`, `envMapIntensity`.
- **Reflections & background** — `envPreset` (Sunset / Cyber / Cream HDR env), `bgStyle`, `bgMotion`, and three gradient stops.
- **Layout & motion** — `layout`, `logoScale`, `pointerStrength`, `autoRotateSpeed`.
- **Stars** — `starCount`, `starColor`, `starDriftSpeed`.
- **Lens flares** — `flareStrength`, `flareColor`.

## Best for

- Creator tools and consumer apps launching a fresh identity
- Music, fashion, and retro-future brands chasing Y2K nostalgia
- Personal portfolios and product pages that want a logo to feel like a hero object



This hero is part of [CrazyGL](https://crazygl.com), a collection of production-ready WebGL, canvas, 3D, and typography effects. Every CrazyGL hero ships with an agent-ready `SKILL.md` file that helps developers and coding agents adapt the effect into custom landing pages and interactive experiences.
