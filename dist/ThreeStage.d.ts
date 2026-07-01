import * as React from 'react';
type LayoutMode = 'centered' | 'content-left' | 'content-right';
type EnvPreset = 'Sunset' | 'Cyber' | 'Cream';
type BgStyle = 'sunset-chrome' | 'cyber-magenta' | 'cream-pearl';
interface StageProps {
    rootRef: React.RefObject<HTMLElement | null>;
    size: {
        width: number;
        height: number;
        dpr: number;
    };
    input: {
        x: number;
        y: number;
        active: boolean;
    };
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
export default function ThreeStage(props: StageProps): import("react/jsx-runtime").JSX.Element;
export {};
