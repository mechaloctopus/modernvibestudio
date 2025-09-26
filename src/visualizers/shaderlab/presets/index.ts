import type { PresetModule } from "../core/types";
// Core set
import GridbreakPreset from "./Gridbreak";
import SquidPreset from "./Squid";
import MountainFogBeachPreset from "./MountainFogBeach";
import GrowingMountainsPreset from "./GrowingMountains";
import ColorMappingPortalPreset from "./ColorMappingPortal";
import InteractiveFogParticles from "./InteractiveFogParticles";
import ResonanceLens from "./ResonanceLens";
import OctaveStrata from "./OctaveStrata";

// Additional presets restored
import AudioAnalysisPreset from "./AudioAnalysis";
import BeatTunnelPreset from "./BeatTunnel";
import KaleidoBloomPreset from "./KaleidoBloom";
import LayeredOrbitalsPreset from "./LayeredOrbitals";
import MelodySpiralPreset from "./MelodySpiral";
import MusicCirclePreset from "./MusicCircle";
import PolarBarsPreset from "./PolarBars";
import ToroidalPreset from "./Toroidal";

export const PRESETS: PresetModule[] = [
  // Core
  GridbreakPreset,
  SquidPreset,
  MountainFogBeachPreset,
  GrowingMountainsPreset,
  ColorMappingPortalPreset,
  InteractiveFogParticles,
  ResonanceLens,
  OctaveStrata,
  // Restored
  AudioAnalysisPreset,
  BeatTunnelPreset,
  KaleidoBloomPreset,
  LayeredOrbitalsPreset,
  MelodySpiralPreset,
  MusicCirclePreset,
  PolarBarsPreset,
  ToroidalPreset,
];

export default PRESETS;
