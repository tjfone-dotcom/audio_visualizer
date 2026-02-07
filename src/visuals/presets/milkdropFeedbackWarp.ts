import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { createFramebuffer, createFullscreenQuad, createProgram, createTexture } from '../renderer/glUtils';

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

uniform sampler2D uBackbuffer;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;

vec3 palette(float t) {
  vec3 a = vec3(0.2, 0.2, 0.25);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.0, 0.2, 0.5);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = vUv;
  vec2 center = uv - 0.5;
  float radius = length(center);
  float angle = atan(center.y, center.x);
  float warp = sin(angle * 6.0 + uTime * 1.5 + radius * 12.0) * 0.01 * (1.0 + uBass * 3.0);
  vec2 warped = uv + normalize(center) * warp;
  vec3 back = texture(uBackbuffer, warped).rgb;
  float glow = smoothstep(0.6, 0.0, radius) * (0.4 + uTreble);
  vec3 color = palette(radius + uTime * 0.05 + uMid) * glow;
  outColor = vec4(mix(back * 0.98, color, 0.3), 1.0);
}
`;

export const createMilkdropFeedbackWarp = (): VisualPreset => {
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let width = 0;
  let height = 0;
  let pingTexture: WebGLTexture | null = null;
  let pongTexture: WebGLTexture | null = null;
  let pingFbo: WebGLFramebuffer | null = null;
  let pongFbo: WebGLFramebuffer | null = null;
  let flip = false;
  let audioState: AudioFeatures | null = null;
  let time = 0;

  const initBuffers = () => {
    if (!gl) return;
    pingTexture = createTexture(gl, width, height);
    pongTexture = createTexture(gl, width, height);
    pingFbo = createFramebuffer(gl, pingTexture);
    pongFbo = createFramebuffer(gl, pongTexture);
  };

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
        initBuffers();
      }
      if (!gl || !program || !vao || !pingFbo || !pongFbo || !pingTexture || !pongTexture) return;

      const writeFbo = flip ? pingFbo : pongFbo;
      const readTexture = flip ? pongTexture : pingTexture;

      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTexture);
      gl.uniform1i(gl.getUniformLocation(program, 'uBackbuffer'), 0);
      gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), width, height);
      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
      gl.uniform1f(gl.getUniformLocation(program, 'uBass'), audioState.bass);
      gl.uniform1f(gl.getUniformLocation(program, 'uMid'), audioState.mid);
      gl.uniform1f(gl.getUniformLocation(program, 'uTreble'), audioState.treble);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.bindTexture(gl.TEXTURE_2D, flip ? pingTexture : pongTexture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindVertexArray(null);
      flip = !flip;
    },
    resize: (nextWidth: number, nextHeight: number) => {
      width = nextWidth;
      height = nextHeight;
      if (gl) {
        if (pingTexture) gl.deleteTexture(pingTexture);
        if (pongTexture) gl.deleteTexture(pongTexture);
        if (pingFbo) gl.deleteFramebuffer(pingFbo);
        if (pongFbo) gl.deleteFramebuffer(pongFbo);
        initBuffers();
      }
    },
    dispose: () => {
      if (gl) {
        if (program) gl.deleteProgram(program);
        if (vao) gl.deleteVertexArray(vao);
        if (pingTexture) gl.deleteTexture(pingTexture);
        if (pongTexture) gl.deleteTexture(pongTexture);
        if (pingFbo) gl.deleteFramebuffer(pingFbo);
        if (pongFbo) gl.deleteFramebuffer(pongFbo);
      }
      gl = null;
      program = null;
      vao = null;
      pingTexture = null;
      pongTexture = null;
      pingFbo = null;
      pongFbo = null;
    }
  };
};
