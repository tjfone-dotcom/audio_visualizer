import type { PresetDefinition } from '../renderer/types';
import { createNeonParticleFlow } from './neonParticleFlow';
import { createInkFluidImpression } from './inkFluidImpression';
import { createGeometricWireWaveform } from './geometricWireWaveform';
import { createRetroCrtSpectrum } from './retroCrtSpectrum';
import { createAuroraGradientRibbons } from './auroraGradientRibbons';
import { createKaleidoscopeShards } from './kaleidoscopeShards';
import { createMilkdropFeedbackWarp } from './milkdropFeedbackWarp';
import { createHydraLiveMixer } from './hydraLiveMixer';
import { createShaderToyRaymarch } from './shaderToyRaymarch';
import { createInstancedSineGrid } from './instancedSineGrid';

export const PRESETS: PresetDefinition[] = [
  { id: 'neon-flow', name: 'Neon Particle Flowfield', type: '2d', create: createNeonParticleFlow },
  { id: 'ink-fluid', name: 'Ink Fluid Impression', type: '2d', create: createInkFluidImpression },
  { id: 'wire-wave', name: 'Geometric Wire Waveform', type: '2d', create: createGeometricWireWaveform },
  { id: 'retro-crt', name: 'Retro CRT Spectrum', type: '2d', create: createRetroCrtSpectrum },
  { id: 'aurora', name: 'Aurora Gradient Ribbons', type: '2d', create: createAuroraGradientRibbons },
  { id: 'kaleidoscope', name: 'Kaleidoscope Shards', type: 'webgl', create: createKaleidoscopeShards },
  { id: 'milkdrop', name: 'MilkDrop Feedback Warp', type: 'webgl', create: createMilkdropFeedbackWarp },
  { id: 'hydra', name: 'Hydra Live Mixer', type: 'webgl', create: createHydraLiveMixer },
  { id: 'raymarch', name: 'ShaderToy Raymarch', type: 'webgl', create: createShaderToyRaymarch },
  { id: 'instanced-grid', name: 'TD Instanced Sine Grid', type: 'webgl', create: createInstancedSineGrid }
];
