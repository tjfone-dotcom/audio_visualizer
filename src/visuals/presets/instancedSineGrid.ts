import type { AudioFeatures, PresetInitParams, PresetRenderContext, VisualPreset } from '../renderer/types';
import { createProgram } from '../renderer/glUtils';

const vertexShader = `#version 300 es
layout(location=0) in vec2 position;
layout(location=1) in vec2 instanceOffset;

uniform float uBass;
uniform float uTreble;
uniform float uScale;
uniform float uFft[128];

void main() {
  int index = int(mod(instanceOffset.x * 128.0, 128.0));
  float fftValue = uFft[index];
  float height = fftValue * 0.6 + sin(instanceOffset.x * 10.0) * uBass * 0.4;
  float tremble = sin(instanceOffset.y * 12.0) * uTreble * 0.2;
  vec2 pos = position * uScale + instanceOffset;
  gl_Position = vec4(pos.x, pos.y + height + tremble, 0.0, 1.0);
  gl_PointSize = 3.0 + fftValue * 6.0;
}
`;

const fragmentShader = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  float dist = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.0, dist);
  outColor = vec4(0.4, 0.8, 1.0, alpha);
}
`;

export const createInstancedSineGrid = (): VisualPreset => {
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let vertexBuffer: WebGLBuffer | null = null;
  let instanceBuffer: WebGLBuffer | null = null;
  let audioState: AudioFeatures | null = null;
  let width = 0;
  let height = 0;
  let instanceCount = 0;

  const setup = () => {
    if (!gl) return;
    program = createProgram(gl, vertexShader, fragmentShader);
    vao = gl.createVertexArray();
    vertexBuffer = gl.createBuffer();
    instanceBuffer = gl.createBuffer();
    if (!vao || !vertexBuffer || !instanceBuffer || !program) return;

    gl.bindVertexArray(vao);
    const vertices = new Float32Array([
      -0.01,
      -0.01,
      0.01,
      -0.01,
      -0.01,
      0.01,
      0.01,
      0.01
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const grid = 64;
    const offsets = new Float32Array(grid * grid * 2);
    let ptr = 0;
    for (let y = 0; y < grid; y += 1) {
      for (let x = 0; x < grid; x += 1) {
        offsets[ptr++] = (x / (grid - 1)) * 2 - 1;
        offsets[ptr++] = (y / (grid - 1)) * 2 - 1;
      }
    }
    instanceCount = grid * grid;
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.bindVertexArray(null);
  };

  return {
    init: (params: PresetInitParams) => {
      width = params.width;
      height = params.height;
    },
    update: (audio: AudioFeatures) => {
      audioState = audio;
    },
    render: (context: PresetRenderContext) => {
      if (context.type !== 'webgl' || !audioState) return;
      if (!gl) {
        gl = context.gl;
        setup();
      }
      if (!gl || !program || !vao) return;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.02, 0.03, 0.06, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      const fft = new Float32Array(128);
      for (let i = 0; i < 128; i += 1) {
        fft[i] = audioState.fft[i] / 255;
      }
      gl.uniform1fv(gl.getUniformLocation(program, 'uFft[0]'), fft);
      gl.uniform1f(gl.getUniformLocation(program, 'uBass'), audioState.bass);
      gl.uniform1f(gl.getUniformLocation(program, 'uTreble'), audioState.treble);
      gl.uniform1f(gl.getUniformLocation(program, 'uScale'), 1.0 + audioState.bass * 0.2);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount);
      gl.bindVertexArray(null);
    },
    resize: (nextWidth: number, nextHeight: number) => {
      width = nextWidth;
      height = nextHeight;
    },
    dispose: () => {
      if (gl) {
        if (program) gl.deleteProgram(program);
        if (vao) gl.deleteVertexArray(vao);
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
      }
      gl = null;
      program = null;
      vao = null;
      vertexBuffer = null;
      instanceBuffer = null;
    }
  };
};
