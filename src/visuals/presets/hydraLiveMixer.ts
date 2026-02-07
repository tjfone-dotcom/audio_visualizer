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

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float osc = sin((uv.x + uTime * 0.2) * 8.0) * cos((uv.y + uTime * 0.1) * 6.0);
  float shape = smoothstep(0.2, 0.0, abs(length(uv - 0.5) - 0.3 - uBass * 0.2));
  float texture = noise(uv * (30.0 + uMid * 40.0) + uTime);
  float mixer = mix(osc, shape, 0.4 + uMid * 0.4);
  float post = mix(mixer, texture, uTreble);
  vec3 color = vec3(post * 0.4 + 0.1, post * 0.2 + 0.05, post * 0.6 + 0.2);
  outColor = vec4(color, 1.0);
}
`;

export const createHydraLiveMixer = (): VisualPreset => {
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
