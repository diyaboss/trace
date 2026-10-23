import { useEffect, useRef } from 'react';
import styles from './FluidCursor.module.css';

/**
 * A cursor-driven ink simulation for the hero (after noth.in).
 *
 * Implements the classic "stable fluids" method on the GPU (WebGL2):
 * splat → curl → vorticity → divergence → pressure (Jacobi) → gradient
 * subtract → advect velocity and dye → display. No library.
 *
 * Purely decorative: aria-hidden, no pointer capture (clicks and scrolling
 * pass through), and it does not start under reduced motion or without
 * WebGL2 + float render targets. It pauses while off-screen or the tab is hidden.
 */

const SIM_RESOLUTION = 128;
const DYE_RESOLUTION = 640;
const PRESSURE_ITERATIONS = 20;
const VELOCITY_DISSIPATION = 0.6;
const DYE_DISSIPATION = 0.9;
const PRESSURE_DECAY = 0.8;
const CURL = 22;
const SPLAT_RADIUS = 0.0022;
const SPLAT_FORCE = 4200;

const VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 texelSize;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 fragColor;
`;

const SHADERS = {
  splat: `${HEADER}
uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
void main() {
  vec2 p = vUv - point; p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  fragColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
}`,
  advection: `${HEADER}
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 velTexelSize; uniform float dt; uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * velTexelSize;
  fragColor = texture(uSource, coord) / (1.0 + dissipation * dt);
}`,
  divergence: `${HEADER}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `${HEADER}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
  vorticity: `${HEADER}
uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
void main() {
  float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}`,
  pressure: `${HEADER}
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradientSubtract: `${HEADER}
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`,
  scale: `${HEADER}
uniform sampler2D uTexture; uniform float value;
void main() { fragColor = value * texture(uTexture, vUv); }`,
  display: `${HEADER}
uniform sampler2D uTexture;
void main() {
  vec3 c = texture(uTexture, vUv).rgb;
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  fragColor = vec4(min(c, vec3(a)), a); // premultiplied over the white hero
}`,
};

type ProgramName = keyof typeof SHADERS;

interface Target {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}
interface DoubleTarget {
  read: Target;
  write: Target;
  swap: () => void;
  width: number;
  height: number;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return ([
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6] as [number, number, number]);
}

function createSimulation(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const programs = {} as Record<ProgramName, { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }>;
  for (const name of Object.keys(SHADERS) as ProgramName[]) {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SHADERS[name]));
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i)!;
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    programs[name] = { program, uniforms };
  }

  // Full-screen quad.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const createTarget = (width: number, height: number): Target => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, fbo, width, height };
  };
  const createDouble = (width: number, height: number): DoubleTarget => {
    const pair = { read: createTarget(width, height), write: createTarget(width, height), width, height } as DoubleTarget;
    pair.swap = () => {
      const temp = pair.read;
      pair.read = pair.write;
      pair.write = temp;
    };
    return pair;
  };
  const deleteTarget = (t: Target) => {
    gl.deleteTexture(t.texture);
    gl.deleteFramebuffer(t.fbo);
  };

  const gridSize = (base: number) => {
    const aspect = gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight);
    return aspect >= 1
      ? { width: Math.round(base * aspect), height: base }
      : { width: base, height: Math.round(base / aspect) };
  };

  let velocity!: DoubleTarget, dye!: DoubleTarget, pressure!: DoubleTarget, divergence!: Target, curl!: Target;
  const allocate = () => {
    for (const d of [velocity, dye, pressure]) if (d) [d.read, d.write].forEach(deleteTarget);
    for (const t of [divergence, curl]) if (t) deleteTarget(t);
    const sim = gridSize(SIM_RESOLUTION);
    const dyeSize = gridSize(DYE_RESOLUTION);
    velocity = createDouble(sim.width, sim.height);
    pressure = createDouble(sim.width, sim.height);
    divergence = createTarget(sim.width, sim.height);
    curl = createTarget(sim.width, sim.height);
    dye = createDouble(dyeSize.width, dyeSize.height);
  };

  const use = (name: ProgramName, texel?: { width: number; height: number }) => {
    const p = programs[name];
    gl.useProgram(p.program);
    if (texel && p.uniforms.texelSize) gl.uniform2f(p.uniforms.texelSize, 1 / texel.width, 1 / texel.height);
    return p.uniforms;
  };
  let unit = 0;
  const bind = (location: WebGLUniformLocation | null, target: Target) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.uniform1i(location, unit);
    unit++;
  };
  const draw = (target: Target | null) => {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    unit = 0;
  };

  const splat = (x: number, y: number, dx: number, dy: number, color: [number, number, number]) => {
    const aspect = canvas.width / Math.max(1, canvas.height);
    let u = use('splat', velocity);
    bind(u.uTarget, velocity.read);
    gl.uniform1f(u.aspectRatio, aspect);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, dx, dy, 0);
    gl.uniform1f(u.radius, SPLAT_RADIUS * (aspect > 1 ? aspect : 1));
    draw(velocity.write);
    velocity.swap();

    u = use('splat', dye);
    bind(u.uTarget, dye.read);
    gl.uniform1f(u.aspectRatio, aspect);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, color[0], color[1], color[2]);
    gl.uniform1f(u.radius, SPLAT_RADIUS * (aspect > 1 ? aspect : 1));
    draw(dye.write);
    dye.swap();
  };

  const step = (dt: number) => {
    gl.disable(gl.BLEND);

    let u = use('curl', velocity);
    bind(u.uVelocity, velocity.read);
    draw(curl);

    u = use('vorticity', velocity);
    bind(u.uVelocity, velocity.read);
    bind(u.uCurl, curl);
    gl.uniform1f(u.curl, CURL);
    gl.uniform1f(u.dt, dt);
    draw(velocity.write);
    velocity.swap();

    u = use('divergence', velocity);
    bind(u.uVelocity, velocity.read);
    draw(divergence);

    u = use('scale', velocity);
    bind(u.uTexture, pressure.read);
    gl.uniform1f(u.value, PRESSURE_DECAY);
    draw(pressure.write);
    pressure.swap();

    u = use('pressure', velocity);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      bind(u.uDivergence, divergence);
      bind(u.uPressure, pressure.read);
      draw(pressure.write);
      pressure.swap();
    }

    u = use('gradientSubtract', velocity);
    bind(u.uPressure, pressure.read);
    bind(u.uVelocity, velocity.read);
    draw(velocity.write);
    velocity.swap();

    u = use('advection', velocity);
    bind(u.uVelocity, velocity.read);
    bind(u.uSource, velocity.read);
    gl.uniform2f(u.velTexelSize, 1 / velocity.width, 1 / velocity.height);
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, VELOCITY_DISSIPATION);
    draw(velocity.write);
    velocity.swap();

    u = use('advection', dye);
    bind(u.uVelocity, velocity.read);
    bind(u.uSource, dye.read);
    gl.uniform2f(u.velTexelSize, 1 / velocity.width, 1 / velocity.height);
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, DYE_DISSIPATION);
    draw(dye.write);
    dye.swap();
  };

  const render = () => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const u = use('display');
    bind(u.uTexture, dye.read);
    draw(null);
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width === width && canvas.height === height && velocity) return;
    canvas.width = width;
    canvas.height = height;
    allocate();
  };

  resize();
  return {
    splat,
    step,
    render,
    resize,
    destroy: () => gl.getExtension('WEBGL_lose_context')?.loseContext(),
  };
}

export function FluidCursor() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // A fresh canvas per mount: a WebGL context released on unmount can't be reused.
    const canvas = document.createElement('canvas');
    canvas.className = styles.canvas;
    host.appendChild(canvas);

    let sim: ReturnType<typeof createSimulation> = null;
    try {
      sim = createSimulation(canvas);
    } catch {
      sim = null;
    }
    if (!sim) {
      canvas.remove(); // No WebGL2/float targets: the hero simply stays static.
      return;
    }
    const simulation = sim;
    host.dataset.active = 'true';

    let frame = 0;
    let visible = true;
    let last = performance.now();
    let hue = 0.64;
    let pointer: { x: number; y: number } | null = null;
    const pending: { x: number; y: number; dx: number; dy: number }[] = [];

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right) {
        pointer = null;
        return;
      }
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      if (pointer) {
        const aspect = rect.width / Math.max(1, rect.height);
        const dx = (x - pointer.x) * (aspect < 1 ? aspect : 1);
        const dy = (y - pointer.y) / (aspect > 1 ? aspect : 1);
        if (Math.abs(dx) + Math.abs(dy) > 0) pending.push({ x, y, dx, dy });
      }
      pointer = { x, y };
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 1 / 60);
      last = now;
      if (!visible) return;
      simulation.resize();
      for (const p of pending.splice(0)) {
        // Electric blue → violet, like the foil accent on noth.in.
        hue = 0.6 + ((hue - 0.6 + 0.0025) % 0.16);
        const [r, g, b] = hsvToRgb(hue, 0.85, 1);
        const intensity = 0.22;
        simulation.splat(p.x, p.y, p.dx * SPLAT_FORCE, p.dy * SPLAT_FORCE, [r * intensity, g * intensity, b * intensity]);
      }
      simulation.step(dt);
      simulation.render();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === 'visible';
    });
    observer.observe(canvas);
    const onVisibility = () => {
      visible = document.visibilityState === 'visible';
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      simulation.destroy();
      canvas.remove();
      delete host.dataset.active;
    };
  }, []);

  return <div ref={hostRef} className={styles.host} aria-hidden="true" />;
}
