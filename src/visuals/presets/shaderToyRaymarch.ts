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

float sdTunnel(vec3 p) {
  return length(p.xy) - 0.6 - sin(p.z * 2.0 + uTime) * 0.1;
}

vec3 shade(vec3 p, float t) {
  float glow = exp(-t * 0.2) * (0.4 + uTreble);
  return vec3(0.2 + uMid * 0.4, 0.5 + glow, 0.8 - glow) * glow;
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  vec3 ro = vec3(0.0, 0.0, uTime * (1.2 + uBass * 2.0));
  vec3 rd = normalize(vec3(uv, 1.0));

  float t = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 48; i++) {
    vec3 p = ro + rd * t;
    float d = sdTunnel(p);
    if (d < 0.001) {
      col += shade(p, t);
      break;
    }
    t += d * 0.7;
    if (t > 20.0) break;
  }

  col += vec3(0.05, 0.06, 0.1) * (1.0 - uTreble * 0.6);
  outColor = vec4(col, 1.0);
}
`;

export const createShaderToyRaymarch = (): VisualPreset => {
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
      if (gl && program) gl.deleteProgram(program);
      if (gl && vao) gl.deleteVertexArray(vao);
      gl = null;
      program = null;
      vao = null;
    }
  };
};
