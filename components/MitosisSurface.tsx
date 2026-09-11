"use client";

import { useEffect, useRef } from "react";
import { canvas as canvasController } from "@/lib/canvas-controller";
import { loadMitosisImage } from "@/lib/mitosis-assets";
import { getPositions } from "@/lib/simulation";
import { SPLIT_TIMING } from "@/lib/split-formation";
import type { GraphNode } from "@/lib/types";
import type { SplitFormationState } from "@/store/ui";

const MAX_BUDS = 12;
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 4;
const ATLAS_CELL = 256;

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

#define MAX_BUDS ${MAX_BUDS}

uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_progress;
uniform int u_childCount;
uniform vec4 u_parent;
uniform vec4 u_children[MAX_BUDS];
uniform vec4 u_sourceRect;
uniform vec4 u_childRects[MAX_BUDS];
uniform sampler2D u_atlas;

out vec4 outColor;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float smoothMin(float a, float b, float radius) {
  float h = saturate(0.5 + 0.5 * (b - a) / radius);
  return mix(b, a, h) - radius * h * (1.0 - h);
}

float ellipseDistance(vec2 point, vec2 center, vec2 axis, vec2 radii) {
  vec2 delta = point - center;
  vec2 perpendicular = vec2(-axis.y, axis.x);
  vec2 local = vec2(dot(delta, axis), dot(delta, perpendicular));
  return (length(local / radii) - 1.0) * min(radii.x, radii.y);
}

vec4 atlasSample(vec4 rect, vec2 uv) {
  vec2 safeUv = clamp(uv, vec2(0.015), vec2(0.985));
  return texture(u_atlas, rect.xy + safeUv * rect.zw);
}

float combinedDistance(vec2 point) {
  float tension = sin(saturate(u_progress / 0.56) * 3.14159265);
  vec2 parentAxis = vec2(u_parent.w, 0.0);
  vec2 parentRadii = vec2(
    u_parent.z * (1.0 + tension * 0.105),
    u_parent.z * (1.0 - tension * 0.055)
  );
  float distance = ellipseDistance(point, u_parent.xy, parentAxis, parentRadii);
  float membraneBlend = mix(52.0, 7.0, smoothstep(0.48, 0.72, u_progress));
  float growth = smoothstep(0.055, 0.44, u_progress);

  for (int index = 0; index < MAX_BUDS; index += 1) {
    if (index >= u_childCount) break;
    vec4 child = u_children[index];
    vec2 direction = normalize(child.xy - u_parent.xy + vec2(0.0001));
    float stretch = (1.0 - smoothstep(0.52, 0.78, u_progress)) * growth;
    vec2 radii = vec2(
      child.z * growth * (1.0 + stretch * 0.42),
      child.z * growth * (1.0 - stretch * 0.24)
    );
    float childDistance = ellipseDistance(point, child.xy, direction, radii);
    distance = smoothMin(distance, childDistance, membraneBlend * growth);
  }
  return distance;
}

void main() {
  vec2 point = vec2(
    gl_FragCoord.x / u_dpr,
    u_resolution.y - gl_FragCoord.y / u_dpr
  );

  float distance = combinedDistance(point);
  float surface = 1.0 - smoothstep(-1.5, 2.0, distance);
  float glow = exp(-max(distance, 0.0) / 13.0) * 0.2;
  if (surface + glow < 0.002) discard;

  float tension = sin(saturate(u_progress / 0.56) * 3.14159265);
  vec2 parentAxis = vec2(u_parent.w, 0.0);
  vec2 parentRadii = vec2(
    u_parent.z * (1.0 + tension * 0.105),
    u_parent.z * (1.0 - tension * 0.055)
  );
  vec2 parentUv = (point - u_parent.xy) / (parentRadii * 2.0) + 0.5;
  float parentDistance = ellipseDistance(point, u_parent.xy, parentAxis, parentRadii);
  float parentWeight = exp(-max(parentDistance, 0.0) / 22.0) *
    exp(-length(parentUv - 0.5) * 1.55);
  vec3 accumulated = atlasSample(u_sourceRect, parentUv).rgb * parentWeight;
  float totalWeight = parentWeight;
  float growth = smoothstep(0.055, 0.44, u_progress);

  for (int index = 0; index < MAX_BUDS; index += 1) {
    if (index >= u_childCount) break;
    vec4 child = u_children[index];
    vec2 direction = normalize(child.xy - u_parent.xy + vec2(0.0001));
    float stretch = (1.0 - smoothstep(0.52, 0.78, u_progress)) * growth;
    vec2 radii = vec2(
      child.z * growth * (1.0 + stretch * 0.42),
      child.z * growth * (1.0 - stretch * 0.24)
    );
    vec2 uv = (point - child.xy) / max(vec2(child.z * growth * 2.0), vec2(0.001)) + 0.5;
    float childDistance = ellipseDistance(point, child.xy, direction, radii);
    float weight = growth * exp(-max(childDistance, 0.0) / 18.0) *
      exp(-length(uv - 0.5) * 1.4);
    float phase = float(index) / max(float(u_childCount - 1), 1.0);
    float reveal = smoothstep(0.39 + phase * 0.035, 0.7 + phase * 0.025, u_progress);
    float flow = (1.0 - reveal) * sin((uv.y + u_progress * 1.8) * 12.0) * 0.018;
    vec2 flowingUv = uv + vec2(flow * direction.x, flow * direction.y);
    vec3 inheritedImage = atlasSample(u_sourceRect, flowingUv).rgb;
    vec3 destinationImage = atlasSample(u_childRects[index], uv).rgb;
    vec3 lobeImage = mix(inheritedImage, destinationImage, reveal);
    accumulated += lobeImage * weight;
    totalWeight += weight;
  }

  vec3 color = accumulated / max(totalWeight, 0.0001);
  float edge = exp(-abs(distance) * 0.22);
  float innerDepth = smoothstep(-u_parent.z * 0.76, 0.0, distance);
  vec2 gradient = vec2(
    combinedDistance(point + vec2(1.5, 0.0)) - combinedDistance(point - vec2(1.5, 0.0)),
    combinedDistance(point + vec2(0.0, 1.5)) - combinedDistance(point - vec2(0.0, 1.5))
  );
  vec2 normal = normalize(gradient + vec2(0.0001));
  float lensLight = pow(saturate(dot(normal, normalize(vec2(-0.55, -0.84))) * 0.5 + 0.5), 3.0);
  color *= mix(0.84, 1.08, 1.0 - innerDepth);
  color += vec3(0.3) * lensLight * 0.34;
  color += vec3(0.25) * edge * 0.42;
  color += vec3(0.86) * edge * lensLight * 0.58;

  float handoff = 1.0 - smoothstep(0.76, 0.92, u_progress);
  float alpha = max(surface, glow) * handoff;
  outColor = vec4(color, alpha);
}
`;

interface MitosisSurfaceProps {
  formation: SplitFormationState;
  parent: GraphNode;
  buds: GraphNode[];
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create mitosis shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create mitosis program");
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link mitosis shader");
  }
  return program;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number
): void {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
}

async function createAtlas(sources: string[]): Promise<HTMLCanvasElement> {
  const atlas = document.createElement("canvas");
  atlas.width = ATLAS_COLUMNS * ATLAS_CELL;
  atlas.height = ATLAS_ROWS * ATLAS_CELL;
  const context = atlas.getContext("2d");
  if (!context) throw new Error("Unable to create mitosis image atlas");
  const images = await Promise.all(sources.map(loadMitosisImage));
  images.forEach((image, index) => {
    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    drawCover(context, image, column * ATLAS_CELL, row * ATLAS_CELL, ATLAS_CELL);
  });
  return atlas;
}

function atlasRect(index: number): [number, number, number, number] {
  return [
    (index % ATLAS_COLUMNS) / ATLAS_COLUMNS,
    Math.floor(index / ATLAS_COLUMNS) / ATLAS_ROWS,
    1 / ATLAS_COLUMNS,
    1 / ATLAS_ROWS,
  ];
}

export default function MitosisSurface({
  formation,
  parent,
  buds,
}: MitosisSurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const formationId = formation.id;
  const startedAt = formation.startedAt;
  const parentId = formation.parentId;
  const direction = formation.direction;

  useEffect(() => {
    const surface = ref.current;
    if (!surface) return;
    const root = surface.closest<HTMLElement>(".canvas-root");
    let animationFrame = 0;
    let cancelled = false;
    let gl: WebGL2RenderingContext | null = null;
    let program: WebGLProgram | null = null;

    void (async () => {
      try {
        const visibleChildren = buds.slice(0, MAX_BUDS);
        const atlas = await createAtlas([
          parent.picture,
          ...visibleChildren.map((child) => child.picture),
        ]);
        if (cancelled) return;

        gl = surface.getContext("webgl2", {
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
          powerPreference: "high-performance",
        });
        if (!gl) return;
        program = createProgram(gl);
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW
        );
        const positionLocation = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          atlas
        );

        const locations = {
          resolution: gl.getUniformLocation(program, "u_resolution"),
          dpr: gl.getUniformLocation(program, "u_dpr"),
          progress: gl.getUniformLocation(program, "u_progress"),
          childCount: gl.getUniformLocation(program, "u_childCount"),
          parent: gl.getUniformLocation(program, "u_parent"),
          children: gl.getUniformLocation(program, "u_children[0]"),
          sourceRect: gl.getUniformLocation(program, "u_sourceRect"),
          childRects: gl.getUniformLocation(program, "u_childRects[0]"),
          atlas: gl.getUniformLocation(program, "u_atlas"),
        };
        gl.uniform1i(locations.atlas, 0);
        gl.uniform4fv(locations.sourceRect, atlasRect(0));
        const childRects = new Float32Array(MAX_BUDS * 4);
        visibleChildren.forEach((_, index) => {
          childRects.set(atlasRect(index + 1), index * 4);
        });
        gl.uniform4fv(locations.childRects, childRects);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        if (root) {
          root.dataset.mitosisId = String(formationId);
          root.classList.add("is-mitosis-rendering");
        }

        const draw = (now: number) => {
          if (cancelled || !gl || !program) return;
          const width = surface.clientWidth;
          const height = surface.clientHeight;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const pixelWidth = Math.max(1, Math.round(width * dpr));
          const pixelHeight = Math.max(1, Math.round(height * dpr));
          if (surface.width !== pixelWidth || surface.height !== pixelHeight) {
            surface.width = pixelWidth;
            surface.height = pixelHeight;
          }
          gl.viewport(0, 0, pixelWidth, pixelHeight);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          const positions = getPositions();
          const parentPosition = positions.get(parentId);
          if (!parentPosition) {
            animationFrame = requestAnimationFrame(draw);
            return;
          }
          const transform = canvasController.getTransform();
          gl.uniform2f(locations.resolution, width, height);
          gl.uniform1f(locations.dpr, dpr);
          gl.uniform1f(
            locations.progress,
            Math.max(
              0,
              Math.min((now - startedAt) / SPLIT_TIMING.physicsHandoff, 1)
            )
          );
          gl.uniform1i(locations.childCount, visibleChildren.length);
          gl.uniform4f(
            locations.parent,
            parentPosition.x * transform.k + transform.x,
            parentPosition.y * transform.k + transform.y,
            parentPosition.r * transform.k,
            direction === "back" ? -1 : 1
          );

          const childData = new Float32Array(MAX_BUDS * 4);
          visibleChildren.forEach((child, index) => {
            const position = positions.get(child.id) ?? parentPosition;
            childData.set(
              [
                position.x * transform.k + transform.x,
                position.y * transform.k + transform.y,
                position.r * transform.k,
                0,
              ],
              index * 4
            );
          });
          gl.uniform4fv(locations.children, childData);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          animationFrame = requestAnimationFrame(draw);
        };
        animationFrame = requestAnimationFrame(draw);
      } catch (error) {
        console.warn("mitosis surface unavailable", error);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      if (root?.dataset.mitosisId === String(formationId)) {
        delete root.dataset.mitosisId;
        root.classList.remove("is-mitosis-rendering");
      }
      if (gl && program) gl.deleteProgram(program);
    };
  }, [buds, direction, formationId, parent, parentId, startedAt]);

  return <canvas ref={ref} className="mitosis-surface" aria-hidden="true" />;
}
