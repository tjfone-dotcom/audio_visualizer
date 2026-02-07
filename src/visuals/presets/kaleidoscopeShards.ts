import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { createFullscreenQuad, createProgram } from '../renderer/glUtils';

const vertexShader = `#version 300 es
layout(location=0) in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float slices = 6.0 + uMid * 8.0;
  float sector = 6.28318 / slices;
  angle = abs(mod(angle + uTime * (0.3 + uBass), sector) - sector * 0.5);
  vec2 coords = vec2(cos(angle), sin(angle)) * radius;
  float wave = sin(radius * 8.0 - uTime * (2.0 + uBass * 3.0));
  float glow = smoothstep(0.6, 0.2, abs(wave)) * (0.6 + uTreble);
  vec3 color = palette(radius + uTime * 0.1 + uTreble) * glow;
  outColor = vec4(color, 1.0);
}
`;

export const createKaleidoscopeShards = (): VisualPreset => {
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let width = 0;
  let height = 0;
  let audioState: AudioFeatures | null = null;
  let time = 0;

  return {
    init: (params: PresetInitParams) => {
      width = params.width;
      height = params.height;
    },
    update: (audio: AudioFeatures, dt: number) => {
      audioState = audio;
      time += dt * 0.001;
    },
    render: (context: PresetRenderContext) => {
      if (context.type !== 'webgl' || !audioState) return;
      if (!gl) {
        gl = context.gl;
        program = createProgram(gl, vertexShader, fragmentShader);
        vao = createFullscreenQuad(gl).vao;
      }
      if (!gl || !program || !vao) return;

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), width, height);
      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
      gl.uniform1f(gl.getUniformLocation(program, 'uBass'), audioState.bass);
      gl.uniform1f(gl.getUniformLocation(program, 'uMid'), audioState.mid);
      gl.uniform1f(gl.getUniformLocation(program, 'uTreble'), audioState.treble);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },
    resize: (nextWidth: number, nextHeight: number) => {
      width = nextWidth;
      height = nextHeight;
    },
    dispose: () => {
      if (gl && program) {
        gl.deleteProgram(program);
      }
      if (gl && vao) {
        gl.deleteVertexArray(vao);
      }
      gl = null;
      program = null;
      vao = null;
    }
  };
};
