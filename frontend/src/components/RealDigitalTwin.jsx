/**
 * RealDigitalTwin — echte swisstopo-Gebäude, statisches GLB-Bake.
 * Zielgebäude (obj_trischli16, obj_reitbahn39, obj_geren9) sind separate Nodes
 * → können individuell hervorgehoben werden.
 *
 * Cinematic-Refresh Feb 2026:
 *  - Schräge Kamera (Elevation ~32° Detail, ~40° Übersicht) mit Blick Richtung See.
 *  - Spotlight-Modus: bei Auswahl werden Hintergrundgebäude Richtung Navy abgedunkelt (Lerp).
 *  - Hemisphere-Light (Gold Sky / Navy Ground) + weiche Directional-Fills → sichtbares Volumen.
 *  - Extrudierte Katasterpolygon-Konturen (aus footprints.json) für alle drei Ziele als
 *    goldene Wireframe-Silhouette — konsistent, auch wenn Ziel-Mesh spärlich ist (Reitbahn39).
 *
 * Data © swisstopo · Open Data.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three-stdlib";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import StylizedDigitalTwin from "./DigitalTwin";
import React from "react";

const CENTER_LAT = 47.4775;
const CENTER_LON = 9.4880;
const DEG = Math.PI / 180;

function latLngToLocal(lat, lng) {
  const dLat = (lat - CENTER_LAT) * 111320;
  const dLon = (lng - CENTER_LON) * 111320 * Math.cos(CENTER_LAT * DEG);
  return [dLon, 0, -dLat];
}

// Map Adresse → GLB-Node-Name aus Bake-Skript
function targetNodeFor(listing) {
  if (!listing) return null;
  const a = (listing.address || "").toLowerCase();
  if (a.includes("trischlistrasse 16")) return "obj_trischli16";
  if (a.includes("reitbahnstrasse 39")) return "obj_reitbahn39";
  if (a.includes("gerenstrasse 9"))     return "obj_geren9";
  return null;
}

// ---- Buildings from baked GLB ----
function RorschachBuildings({ mobile, selectedNodeName, onReady }) {
  const url = mobile ? "/twin/rorschach-lite.glb" : "/twin/rorschach.glb";
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    draco.setDecoderConfig({ type: "wasm" });
    loader.setDRACOLoader(draco);
  });

  // Materials — Refs für Lerp auf color / emissive.
  // bg-Material: Custom shader-mod via onBeforeCompile für Roof/Wall + Höhen-Gradient.
  const materials = useRef(null);
  if (!materials.current) {
    const makeBgMat = () => {
      const m = new THREE.MeshStandardMaterial({
        color: "#e6ddd0", roughness: 0.85, metalness: 0.05,
      });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uYMin = { value: 0 };
        shader.uniforms.uYMax = { value: 40 };
        shader.uniforms.uRoofColor = { value: new THREE.Color("#f2ead9") };
        shader.uniforms.uWallColor = { value: new THREE.Color("#b0a898") };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>
            varying vec3 vWorldPosBG;
            varying vec3 vWorldNormalBG;`)
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            vWorldPosBG = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vWorldNormalBG = normalize(mat3(modelMatrix) * normal);`);
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>
            uniform float uYMin;
            uniform float uYMax;
            uniform vec3 uRoofColor;
            uniform vec3 uWallColor;
            varying vec3 vWorldPosBG;
            varying vec3 vWorldNormalBG;`)
          .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
            float roofness = smoothstep(0.55, 0.85, vWorldNormalBG.y);
            float hFrac = clamp((vWorldPosBG.y - uYMin) / max(1.0, uYMax - uYMin), 0.0, 1.0);
            vec3 base = mix(uWallColor, uRoofColor, roofness);
            base *= mix(0.72, 1.05, hFrac);
            vec4 diffuseColor = vec4(diffuse * base, opacity);`);
        m.userData.shader = shader;
      };
      return m;
    };
    materials.current = {
      bg: makeBgMat(),
      matte: new THREE.MeshStandardMaterial({ color: "#dfe3ec", roughness: 0.78, metalness: 0.08 }),
      goldOn: new THREE.MeshStandardMaterial({
        color: "#EBD4A8", roughness: 0.35, metalness: 0.45,
        emissive: "#C9A96E", emissiveIntensity: 1.15,
      }),
    };
  }
  // Zieltönungen: für Spotlight-Übergang
  const colorBgBase = useRef(new THREE.Color("#e6ddd0"));
  const colorBgDim  = useRef(new THREE.Color("#3b4a68"));

  const targetMeshes = useRef({});
  const edgeLines = useRef({});

  useEffect(() => {
    if (!gltf?.scene) return;
    const bgMat = materials.current.bg;
    const targets = ["obj_trischli16", "obj_reitbahn39", "obj_geren9"];
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const nm = obj.parent?.name || obj.name || "";
      if (targets.includes(nm)) {
        targetMeshes.current[nm] = obj;
        obj.material = materials.current.matte;
        const eg = new THREE.EdgesGeometry(obj.geometry, 30);
        const line = new THREE.LineSegments(
          eg,
          new THREE.LineBasicMaterial({ color: "#E6D3A8", transparent: true, opacity: 0 })
        );
        obj.add(line);
        edgeLines.current[nm] = line;
      } else {
        obj.material = bgMat;
      }
      obj.frustumCulled = true;
    });
    onReady?.({ scene: gltf.scene, targetMeshes: targetMeshes.current });
  }, [gltf, onReady]);

  // Spotlight-Übergang: bg-Farbe → dimmed bei Auswahl, weich per Lerp
  useFrame((_, dt) => {
    const wantDim = selectedNodeName != null;
    const target = wantDim ? colorBgDim.current : colorBgBase.current;
    const speed = Math.min(1, dt * 3); // ~0.8s halbwertszeit
    materials.current.bg.color.lerp(target, speed);
    materials.current.bg.emissiveIntensity = 0; // sicherstellen: kein flackern
    // Target-Materialien: nur der selektierte Node bekommt Gold + Edge-Glow
    const names = Object.keys(targetMeshes.current);
    for (const nm of names) {
      const m = targetMeshes.current[nm];
      const isSelected = nm === selectedNodeName;
      const desired = isSelected ? materials.current.goldOn : materials.current.matte;
      if (m.material !== desired) m.material = desired;
      const line = edgeLines.current[nm];
      if (line) {
        const targetOpacity = isSelected ? 0.9 : 0;
        line.material.opacity += (targetOpacity - line.material.opacity) * speed;
      }
    }
  });

  return gltf?.scene ? <primitive object={gltf.scene} /> : null;
}

// ---- Cadastral Footprint Extrusion (per target) ----
// Build a wireframe extrusion per polygon: bottom loop + top loop + vertical edges.
function FootprintContours({ selectedNodeName }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/twin/footprints.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const contours = useMemo(() => {
    if (!data?.targets) return [];
    return data.targets.map((t) => {
      const poly = t.polygon;
      const yLo = t.y_min;
      // Kontur soll VOLLE Gebäudehöhe zeigen; falls Mesh spärlich, mindestens 12 m
      const yHi = Math.max(t.y_max, yLo + 12);
      // Build line segments: bottom edges + top edges + vertical corner edges
      const verts = [];
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const [x0, z0] = poly[i];
        const [x1, z1] = poly[(i + 1) % n];
        // bottom edge
        verts.push(x0, yLo, z0,  x1, yLo, z1);
        // top edge
        verts.push(x0, yHi, z0,  x1, yHi, z1);
        // vertical edge at this vertex
        verts.push(x0, yLo, z0,  x0, yHi, z0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      return { name: t.name, geometry: geo };
    });
  }, [data]);

  const lineRefs = useRef({});
  useFrame((_, dt) => {
    const speed = Math.min(1, dt * 3);
    for (const c of contours) {
      const l = lineRefs.current[c.name];
      if (!l) continue;
      const isSelected = selectedNodeName === c.name;
      const targetOp = isSelected ? 1.0 : 0.6;
      l.material.opacity += (targetOp - l.material.opacity) * speed;
      const targetColor = new THREE.Color(isSelected ? "#F0D9A0" : "#C9A96E");
      l.material.color.lerp(targetColor, speed);
    }
  });

  return (
    <group>
      {contours.map((c) => (
        <lineSegments
          key={c.name}
          geometry={c.geometry}
          ref={(el) => { if (el) lineRefs.current[c.name] = el; }}
        >
          <lineBasicMaterial
            color="#C9A96E"
            transparent
            opacity={0.6}
            depthTest={true}
          />
        </lineSegments>
      ))}
    </group>
  );
}

function raycastYAt(scene, x, z) {
  if (!scene) return 0;
  const rc = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0), 0, 2000);
  const hits = rc.intersectObject(scene, true);
  return hits.length ? hits[0].point.y : 0;
}

// ---- Interactive Marker ----
function ObjectMarker({ position, index, highlight, onClick }) {
  const ringRef = useRef();
  const beamRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 1.8) * 0.06;
      ringRef.current.scale.set(s, 1, s);
      ringRef.current.material.opacity = 0.4 + Math.sin(t * 1.8) * 0.2;
    }
    if (beamRef.current) {
      beamRef.current.material.emissiveIntensity = highlight ? 2.0 : 1.3 + Math.sin(t * 2.4) * 0.4;
    }
  });
  const baseY = position[1] ?? 0;
  return (
    <group
      position={[position[0], 0, position[2]]}
      onClick={(e) => { e.stopPropagation(); onClick?.(index); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} ref={ringRef}>
        <ringGeometry args={[8, 12, 64]} />
        <meshBasicMaterial color={highlight ? "#E6D3A8" : "#C9A96E"} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[3.5, 5, 48]} />
        <meshBasicMaterial color="#C9A96E" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={beamRef} position={[0, baseY / 2 + 15, 0]}>
        <cylinderGeometry args={[0.6, 0.6, baseY + 30, 16]} />
        <meshStandardMaterial color="#E6D3A8" emissive="#C9A96E" emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, baseY + 32, 0]}>
        <sphereGeometry args={[1.8, 16, 16]} />
        <meshStandardMaterial color="#E6D3A8" emissive="#E6D3A8" emissiveIntensity={2.2} />
      </mesh>
    </group>
  );
}

function LimitedControls({ enabled, active }) {
  const { camera, gl } = useThree();
  const ref = useRef();
  useEffect(() => {
    if (!enabled) return;
    const c = new ThreeOrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minPolarAngle = Math.PI / 5;
    c.maxPolarAngle = Math.PI / 2.4;
    c.minDistance = 220;
    c.maxDistance = 900;
    c.target.set(0, 30, 0);
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl, enabled]);
  useEffect(() => {
    if (ref.current) ref.current.enabled = active;
  }, [active]);
  useFrame(() => {
    if (ref.current?.enabled) ref.current.update();
  });
  return null;
}

// ---- Cinematic Camera Rig ----
// Detail: schräg von SÜDEN (positives Z im Y-up-System = Süd), Elevation ~32°,
// Blick nach NORDEN (Richtung Bodensee), Zielgebäude ~22 % der Canvas-Höhe.
// Übersicht: orbitaler Sweep mit Elevation ~40°.
// ---- Auto-Orbit + Cinematic Fly-In Camera Rig ----
function CameraRig({ target, mobile, inView }) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3(400, 380, 400));
  const look = useRef(new THREE.Vector3(0, 30, 0));
  const angle = useRef(mobile ? -Math.PI / 3.5 : Math.PI / 4);
  const prevTarget = useRef(null);
  const flyInStart = useRef(null);
  const lastInteraction = useRef(0);
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Trigger fly-in when section first becomes visible
  useEffect(() => {
    if (inView && flyInStart.current === null && !reducedMotion) {
      flyInStart.current = performance.now();
    }
  }, [inView, reducedMotion]);

  // Track user interactions to pause orbit
  useEffect(() => {
    const bump = () => { lastInteraction.current = performance.now(); };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("wheel", bump, { passive: true });
    window.addEventListener("touchstart", bump, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("wheel", bump);
      window.removeEventListener("touchstart", bump);
    };
  }, []);

  useFrame((_, dt) => {
    const t = target ? `${target[0].toFixed(1)},${target[1].toFixed(1)},${target[2].toFixed(1)}` : null;
    const changed = t !== prevTarget.current;
    prevTarget.current = t;

    // Fly-in: 2.5 s ease-in-out-cubic from high-north over the lake to overview position
    let flyInProgress = null;
    if (flyInStart.current !== null && !target) {
      const elapsed = (performance.now() - flyInStart.current) / 1000;
      flyInProgress = elapsed < 2.5 ? Math.min(elapsed / 2.5, 1.0) : null;
    }

    if (target) {
      const [x, y, z] = target;
      const groundDist = mobile ? 105 : 130;
      const elevRad = 32 * DEG;
      const camH = groundDist * Math.tan(elevRad);
      desired.current.set(x, y + camH, z + groundDist);
      look.current.set(x, y * 0.5 + 12, z - 25);
    } else if (flyInProgress !== null) {
      // Fly-in: from (0, 1600, -1500) [hoch über Bodensee, Norden] → orbital-Startposition
      const start = new THREE.Vector3(0, 1600, -1500);
      // Overview orbital target position
      const r = mobile ? 460 : 500;
      const camY = r * Math.tan(38 * DEG);
      const end = new THREE.Vector3(Math.cos(angle.current) * r, camY, Math.sin(angle.current) * r);
      // easeInOutCubic
      const p = flyInProgress;
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      desired.current.lerpVectors(start, end, ease);
      look.current.set(0, 30, 0);
    } else {
      // Auto-orbit — only when no user interaction in last 8 s and not reduced-motion
      const idleMs = performance.now() - lastInteraction.current;
      const orbitActive = !reducedMotion && idleMs > 8000;
      if (orbitActive) {
        angle.current += dt * (1 * Math.PI / 180); // 1°/s
      }
      const r = mobile ? 460 : 500;
      const camY = r * Math.tan(38 * DEG);
      desired.current.set(Math.cos(angle.current) * r, camY, Math.sin(angle.current) * r);
      look.current.set(0, 30, 0);
    }

    // Snap start on target transition
    if (changed && target) {
      const [x, y, z] = target;
      camera.position.set(x + 30, y + 200, z + 240);
    }
    const alpha = target ? 0.14 : (flyInProgress !== null ? 0.35 : 0.05);
    camera.position.lerp(desired.current, alpha);
    camera.lookAt(look.current);
    window.__twinDebug = {
      cam: [+camera.position.x.toFixed(1), +camera.position.y.toFixed(1), +camera.position.z.toFixed(1)],
      target,
      desired: [+desired.current.x.toFixed(1), +desired.current.y.toFixed(1), +desired.current.z.toFixed(1)],
      flyIn: flyInProgress,
    };
  });
  return null;
}

// ---- Orthophoto Ground with Terrain, AO, Water (SWISSIMAGE + swissALTI3D) ----
function OrthoGround({ meta, mobile, dayMode, onDbg }) {
  const info = meta?.ground?.[mobile ? "mobile" : "desktop"];
  const waterInfo = meta?.water_mask?.[mobile ? "mobile" : "desktop"];
  const aoInfo = meta?.ao?.[mobile ? "mobile" : "desktop"];
  const terrainInfo = meta?.terrain?.[mobile ? "mobile" : "desktop"];
  const tex = useLoader(THREE.TextureLoader, info?.file ? `/twin/${info.file}` : "/twin/ground-lite.webp");
  const maskTex = useLoader(THREE.TextureLoader, waterInfo?.file ? `/twin/${waterInfo.file}` : `/twin/${info?.file || "ground-lite.webp"}`);
  const aoTex = useLoader(THREE.TextureLoader, aoInfo?.file ? `/twin/${aoInfo.file}` : "/twin/ground-lite.webp");
  const materialRef = useRef();
  const { camera } = useThree();

  // Terrain: Float32 DataTexture (WebGL2 RED_FLOAT)
  const [terrainTex, setTerrainTex] = useState(null);
  useEffect(() => {
    if (!terrainInfo?.file) return;
    let cancelled = false;
    fetch(`/twin/${terrainInfo.file}`)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        const N = terrainInfo.grid;
        const arr = new Float32Array(buf);
        if (arr.length !== N * N) {
          console.warn("[twin] terrain size mismatch", arr.length, "expected", N * N);
        }
        const dt = new THREE.DataTexture(arr, N, N, THREE.RedFormat, THREE.FloatType);
        dt.wrapS = dt.wrapT = THREE.ClampToEdgeWrapping;
        dt.minFilter = THREE.LinearFilter;
        dt.magFilter = THREE.LinearFilter;
        dt.needsUpdate = true;
        setTerrainTex(dt);
      })
      .catch((e) => console.warn("[twin] terrain fetch failed", e));
    return () => { cancelled = true; };
  }, [terrainInfo?.file, terrainInfo?.grid]);

  useEffect(() => {
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    }
    if (maskTex) {
      maskTex.colorSpace = THREE.NoColorSpace;
      maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping;
      maskTex.minFilter = THREE.LinearFilter;
      maskTex.magFilter = THREE.LinearFilter;
      maskTex.needsUpdate = true;
    }
    if (aoTex) {
      aoTex.colorSpace = THREE.NoColorSpace;
      aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
      aoTex.minFilter = THREE.LinearFilter;
      aoTex.magFilter = THREE.LinearFilter;
      aoTex.needsUpdate = true;
    }
  }, [tex, maskTex, aoTex]);

  const dims = useMemo(() => {
    if (!info) return null;
    const { nw_lat, nw_lon, se_lat, se_lon } = info.bounds;
    const DEG_LOCAL = Math.PI / 180;
    const CLAT = meta.center.lat;
    const CLON = meta.center.lon;
    const to_enu = (lat, lon) => {
      const dLat = (lat - CLAT) * 111320;
      const dLon = (lon - CLON) * 111320 * Math.cos(CLAT * DEG_LOCAL);
      return [dLon, -dLat];
    };
    const [xW, zN] = to_enu(nw_lat, nw_lon);
    const [xE, zS] = to_enu(se_lat, se_lon);
    return { xW, xE, zN, zS };
  }, [info, meta]);

  const terrainOffset = meta?.terrain?.offset_m ?? 0;

  const uniforms = useMemo(() => ({
    uOrtho: { value: tex },
    uWaterMask: { value: maskTex },
    uAO: { value: aoTex },
    uTerrain: { value: terrainTex },
    uHasTerrain: { value: terrainTex ? 1.0 : 0.0 },
    uTerrainOffset: { value: terrainOffset },
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uOrthoTint: { value: new THREE.Color("#98a5b7") },
    uOrthoBrightness: { value: 0.75 },
    uWaterColorDeep: { value: new THREE.Color("#050e22") },
    uWaterColorSurface: { value: new THREE.Color("#0c1e3e") },
    uHorizonColor: { value: new THREE.Color("#c9a17a") },
    uDayMix: { value: 0.0 },
    fogColor: { value: new THREE.Color("#0d1a34") },
    fogNear: { value: 900 },
    fogFar: { value: 3400 },
  }), [tex, maskTex, aoTex, terrainTex, terrainOffset]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTerrain.value = terrainTex;
    materialRef.current.uniforms.uHasTerrain.value = terrainTex ? 1.0 : 0.0;
    materialRef.current.uniformsNeedUpdate = true;
    onDbg?.({ terrainLoaded: !!terrainTex });
  }, [terrainTex, onDbg]);

  useFrame((state, dt) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uTime.value += dt;
    u.uCameraPos.value.copy(camera.position);
    const target = dayMode ? 1.0 : 0.0;
    u.uDayMix.value += (target - u.uDayMix.value) * Math.min(1, dt * 2.0);
  });

  if (!info || !dims) return null;
  const width = dims.xE - dims.xW;
  const depth = dims.zS - dims.zN;
  const cx = (dims.xE + dims.xW) / 2;
  const cz = (dims.zS + dims.zN) / 2;
  const segs = terrainInfo?.grid
    ? (mobile ? Math.max(1, terrainInfo.grid - 1) : Math.max(1, (terrainInfo.grid - 1) * 2))
    : (mobile ? 47 : 191);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.15, cz]}>
      <planeGeometry args={[width, depth, segs, segs]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        fog={true}
        vertexShader={GROUND_VERT}
        fragmentShader={GROUND_FRAG}
      />
    </mesh>
  );
}

// GLSL for ortho + water shader (fog-aware) — vertex displacement from terrain heightmap
const GROUND_VERT = `
  uniform sampler2D uTerrain;
  uniform float uHasTerrain;
  uniform float uTerrainOffset;
  varying vec2 vUvG;
  varying vec3 vWorldPosG;
  varying float vTerrainH;
  #include <fog_pars_vertex>
  void main() {
    vUvG = uv;
    vec3 pos = position;
    float h = 0.0;
    if (uHasTerrain > 0.5) {
      h = texture2D(uTerrain, uv).r + uTerrainOffset;
      pos.z += h;
    }
    vTerrainH = h;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPosG = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const GROUND_FRAG = `
  uniform sampler2D uOrtho;
  uniform sampler2D uWaterMask;
  uniform sampler2D uAO;
  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform vec3 uOrthoTint;
  uniform float uOrthoBrightness;
  uniform vec3 uWaterColorDeep;
  uniform vec3 uWaterColorSurface;
  uniform vec3 uHorizonColor;
  uniform float uDayMix;
  varying vec2 vUvG;
  varying vec3 vWorldPosG;
  varying float vTerrainH;
  #include <fog_pars_fragment>

  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float valueNoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Ortho sample
    vec3 orthoRaw = texture2D(uOrtho, vUvG).rgb;
    // Kontakt-AO (aus Baker): grey ≈ 1 unter freiem Himmel, dunkler unter Gebäuden
    float ao = texture2D(uAO, vUvG).r;
    vec3 orthoTinted = orthoRaw * uOrthoTint * uOrthoBrightness;
    vec3 orthoDay = orthoRaw * vec3(1.05, 1.02, 0.98) * 1.1;
    vec3 ortho = mix(orthoTinted, orthoDay, uDayMix);
    ortho *= ao;

    // Water mask (smoothed)
    float mask = texture2D(uWaterMask, vUvG).r;
    mask = smoothstep(0.35, 0.65, mask);

    // Water: two scrolling noise layers → animated ripples
    vec2 wp = vWorldPosG.xz;
    float n1 = valueNoise(wp * 0.08 + vec2(uTime * 0.12, uTime * 0.09));
    float n2 = valueNoise(wp * 0.05 - vec2(uTime * 0.07, uTime * 0.11));
    float ripple = (n1 + n2 - 1.0);

    // Fresnel toward camera
    vec3 toCam = normalize(uCameraPos - vWorldPosG);
    float fres = pow(1.0 - clamp(toCam.y, 0.0, 1.0), 3.0);

    vec3 waterCol = mix(uWaterColorDeep, uWaterColorSurface, 0.5 + ripple * 0.35);
    waterCol = mix(waterCol, uHorizonColor, fres * 0.42);
    vec3 waterDay = mix(vec3(0.06, 0.22, 0.36), vec3(0.14, 0.34, 0.48), 0.5 + ripple * 0.3);
    waterDay = mix(waterDay, vec3(0.85, 0.75, 0.55), fres * 0.30);
    waterCol = mix(waterCol, waterDay, uDayMix);

    vec3 color = mix(ortho, waterCol, mask);

    gl_FragColor = vec4(color, 1.0);
    #include <fog_fragment>
  }
`;

// Endloses Horizont-Wasser jenseits der Ortho-Plane (Norden)
function HorizonWater({ mobile, dayMode }) {
  const materialRef = useRef();
  const { camera } = useThree();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uWaterColorDeep: { value: new THREE.Color("#050e22") },
    uWaterColorSurface: { value: new THREE.Color("#0c1e3e") },
    uHorizonColor: { value: new THREE.Color("#c9a17a") },
    uDayMix: { value: 0.0 },
    fogColor: { value: new THREE.Color("#0d1a34") },
    fogNear: { value: 900 },
    fogFar: { value: 3400 },
  }), []);
  useFrame((_, dt) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uTime.value += dt;
    u.uCameraPos.value.copy(camera.position);
    const t = dayMode ? 1.0 : 0.0;
    u.uDayMix.value += (t - u.uDayMix.value) * Math.min(1, dt * 2.0);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, -2200]}>
      <planeGeometry args={[6000, 3000, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        fog={true}
        vertexShader={GROUND_VERT}
        fragmentShader={HORIZON_FRAG}
      />
    </mesh>
  );
}

const HORIZON_FRAG = `
  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform vec3 uWaterColorDeep;
  uniform vec3 uWaterColorSurface;
  uniform vec3 uHorizonColor;
  uniform float uDayMix;
  varying vec2 vUvG;
  varying vec3 vWorldPosG;
  #include <fog_pars_fragment>

  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float valueNoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 wp = vWorldPosG.xz;
    float n1 = valueNoise(wp * 0.03 + vec2(uTime * 0.06, uTime * 0.05));
    float n2 = valueNoise(wp * 0.015 - vec2(uTime * 0.03, uTime * 0.04));
    float ripple = (n1 + n2 - 1.0);
    vec3 toCam = normalize(uCameraPos - vWorldPosG);
    float fres = pow(1.0 - clamp(toCam.y, 0.0, 1.0), 3.0);
    vec3 waterCol = mix(uWaterColorDeep, uWaterColorSurface, 0.5 + ripple * 0.3);
    waterCol = mix(waterCol, uHorizonColor, fres * 0.4);
    vec3 waterDay = mix(vec3(0.06, 0.22, 0.36), vec3(0.14, 0.34, 0.48), 0.5 + ripple * 0.28);
    waterDay = mix(waterDay, vec3(0.85, 0.75, 0.55), fres * 0.30);
    waterCol = mix(waterCol, waterDay, uDayMix);
    gl_FragColor = vec4(waterCol, 1.0);
    #include <fog_fragment>
  }
`;

function ShoreLine() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-700, 0.5, -70, 700, 0.5, -70], 3));
    return g;
  }, []);
  return null; // Uferlinie kommt aus der Wassermaske selbst — kein zusätzlicher Marker mehr.
}

function Ground() {
  // Fallback-Boden hinter dem Ortho-Foto (falls Kamera darüber hinausschaut)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
      <planeGeometry args={[6000, 6000]} />
      <meshStandardMaterial color="#050b1a" roughness={1} metalness={0} />
    </mesh>
  );
}

function SkyDome({ dayMode }) {
  // Vertex-Color-Gradient: Abend Navy → Champagner, Tag Skyblau → weiss/heller
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(3000, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const colors = [];
    const pos = g.attributes.position;
    const nightTop = new THREE.Color("#050c1e");
    const nightMid = new THREE.Color("#1a2a4a");
    const nightHor = new THREE.Color("#c9a17a");
    const dayTop = new THREE.Color("#3b6ca0");
    const dayMid = new THREE.Color("#94b3d0");
    const dayHor = new THREE.Color("#e8dcc0");
    const isDay = !!dayMode;
    const topCol = isDay ? dayTop : nightTop;
    const midCol = isDay ? dayMid : nightMid;
    const horCol = isDay ? dayHor : nightHor;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 3000;
      let c;
      if (y > 0.55) c = topCol.clone();
      else if (y > 0.15) c = midCol.clone().lerp(topCol, (y - 0.15) / 0.4);
      else c = horCol.clone().lerp(midCol, y / 0.15);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [dayMode]);
  return (
    <mesh geometry={geo} rotation={[0, 0, 0]}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

// ---- Main ----
export default function RealDigitalTwin({ highlightIndex, selectedIndex, onSelect, onDeselect, listings = [], mobile = false }) {
  const [webglLost, setWebglLost] = useState(false);
  const [glbFailed, setGlbFailed] = useState(false);
  const [gltfState, setGltfState] = useState(null);
  const [meta, setMeta] = useState(null);
  const [dayMode, setDayMode] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch("/twin/twin-meta.json").then(r => r.json()).then(setMeta).catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.25 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const objects = useMemo(
    () =>
      listings
        .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
        .slice(0, 3),
    [listings]
  );

  const rawPositions = useMemo(() => objects.map((o) => latLngToLocal(o.lat, o.lng)), [objects]);
  const positions = useMemo(() => {
    if (!gltfState?.scene) return rawPositions;
    return rawPositions.map(([x, , z]) => [x, raycastYAt(gltfState.scene, x, z), z]);
  }, [rawPositions, gltfState]);

  const focusIdx = selectedIndex != null ? selectedIndex : highlightIndex;
  const target = focusIdx != null && positions[focusIdx] ? positions[focusIdx] : null;
  const selectedNode = targetNodeFor(objects[selectedIndex]);

  if (webglLost || glbFailed) {
    return <StylizedDigitalTwin highlightIndex={highlightIndex} listings={listings} mobile={mobile} />;
  }

  const selectedLabel = selectedIndex != null ? objects[selectedIndex] : null;

  return (
    <div className="relative w-full h-full" data-testid="real-digital-twin" data-selected-index={selectedIndex ?? ""} ref={containerRef}>
      <Canvas
        shadows={false}
        dpr={mobile ? [1, 1.25] : [1, 1.5]}
        camera={{ position: [400, 380, 400], fov: 42, near: 1, far: 6000 }}
        gl={{
          antialias: !mobile,
          powerPreference: mobile ? "low-power" : "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#050c1e", 1);
          gl.domElement.style.touchAction = mobile ? "pan-y" : "none";
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setWebglLost(true);
          });
        }}
        style={{ touchAction: mobile ? "pan-y" : "none" }}
      >
        <fog attach="fog" args={[dayMode ? "#a9c1d8" : "#0d1a34", 900, 3400]} />
        <ambientLight intensity={dayMode ? 0.7 : 0.48} />
        <directionalLight position={dayMode ? [200, 900, 100] : [-450, 260, 120]} intensity={dayMode ? 1.35 : 1.15} color={dayMode ? "#fffaf0" : "#f5c98a"} />
        <directionalLight position={[80, 320, -400]} intensity={dayMode ? 0.28 : 0.42} color={dayMode ? "#d0e0f0" : "#5e7ba8"} />

        <SkyDome dayMode={dayMode} />
        <Ground />
        <Suspense fallback={null}>
          {meta && <OrthoGround meta={meta} mobile={mobile} dayMode={dayMode} />}
        </Suspense>
        <HorizonWater mobile={mobile} dayMode={dayMode} />

        <Suspense fallback={null}>
          <ErrorBoundary onError={() => setGlbFailed(true)}>
            <RorschachBuildings mobile={mobile} selectedNodeName={selectedNode} onReady={setGltfState} />
            <FootprintContours selectedNodeName={selectedNode} />
          </ErrorBoundary>
        </Suspense>

        {positions.map((p, i) => (
          <ObjectMarker
            key={objects[i]?.id || i}
            position={p}
            index={i}
            highlight={focusIdx === i}
            onClick={onSelect}
          />
        ))}

        {/* Landmark-Labels — Glass-Pills via drei <Html> */}
        {meta?.landmarks && !selectedLabel && (
          <LandmarksInCanvas
            landmarks={meta.landmarks}
            mobile={mobile}
            gltfScene={gltfState?.scene}
          />
        )}

        {/* Objekt-Pills — Name + Status via drei <Html> */}
        {!selectedLabel && objects.map((o, i) => (
          <ObjectPillInCanvas
            key={o.id}
            position={positions[i]}
            object={o}
            onClick={() => onSelect?.(i)}
          />
        ))}

        <CameraRig target={target} mobile={mobile} inView={inView} />
        <LimitedControls enabled={!mobile} active={target == null} />

        <EffectComposer disableNormalPass>
          <Bloom
            intensity={mobile ? 0.4 : 0.7}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.28}
          />
        </EffectComposer>
      </Canvas>

      {/* Kompass */}
      <div className="absolute top-3 left-3 pointer-events-none select-none" data-testid="twin-compass">
        <svg width={mobile ? 36 : 44} height={mobile ? 36 : 44} viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="rgba(10,20,40,0.55)" stroke="rgba(201,169,110,0.4)" strokeWidth="1"/>
          <path d="M22 6 L26 22 L22 20 L18 22 Z" fill="#C9A96E"/>
          <path d="M22 38 L26 22 L22 24 L18 22 Z" fill="rgba(255,255,255,0.45)"/>
          <text x="22" y="12" fill="#E6D3A8" fontSize="7" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">N</text>
        </svg>
      </div>

      {/* Tag/Abend-Toggle */}
      {!selectedLabel && (
        <button
          onClick={() => setDayMode((v) => !v)}
          data-testid="twin-day-toggle"
          aria-label={dayMode ? "Abendmodus" : "Tagmodus"}
          className="absolute top-3 right-3 glass px-3 h-9 rounded-full flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gold-light pointer-events-auto"
        >
          <span className="text-gold">{dayMode ? "☀︎" : "☾"}</span>
          <span>{dayMode ? "Tag" : "Abend"}</span>
        </button>
      )}

      {/* Selection label + Übersicht-Button */}
      {selectedLabel && (
        <div
          className="absolute top-3 right-3 glass px-4 py-2.5 rounded-full text-[10px] uppercase tracking-[0.24em] text-gold-light pointer-events-auto flex items-center gap-3 min-h-[44px]"
          data-testid="twin-selection-label"
        >
          <span className="truncate max-w-[180px] text-white/90 normal-case tracking-tight">
            {selectedLabel.address}
          </span>
          <button
            onClick={onDeselect}
            data-testid="twin-deselect-btn"
            className="text-gold hover:text-gold-light uppercase tracking-[0.24em] min-h-[44px] min-w-[88px] px-2 flex items-center justify-center border border-gold/40 rounded-full"
            aria-label="Zurück zur Übersicht"
          >
            Übersicht
          </button>
        </div>
      )}

      <div
        className="absolute bottom-2 left-3 text-[10px] tracking-[0.16em] text-white/50 pointer-events-none select-none"
        data-testid="swisstopo-attribution"
      >
        {meta?.attribution || "Luftbild · Höhenmodell · Gebäude © swisstopo"}
      </div>
    </div>
  );
}

// ---- Landmark labels in canvas (drei <Html>) with collision resolve ----
function LandmarksInCanvas({ landmarks, mobile, gltfScene }) {
  const list = useMemo(() => {
    const p = { harbor: 1, landmark: 2, transport: 3, path: 4, city: 5 };
    const sorted = [...landmarks].sort((a, b) => (p[a.kind] ?? 9) - (p[b.kind] ?? 9));
    return (mobile ? sorted.slice(0, 4) : sorted.slice(0, 6)).map((l, i) => ({
      ...l, priority: p[l.kind] ?? 9, idx: i,
    }));
  }, [landmarks, mobile]);

  const wrapRefs = useRef({});
  const frameCount = useRef(0);
  const { camera, gl, size } = useThree();

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 10 !== 0) return; // alle 10 Frames
    // 2D-Screen-AABBs berechnen
    const boxes = [];
    const w = size.width;
    const h = size.height;
    for (const l of list) {
      const el = wrapRefs.current[l.name];
      if (!el) continue;
      // Reset visibility so hidden-then-becomes-visible cases work
      el.style.transition = "opacity 220ms ease-out";
      const r = el.getBoundingClientRect();
      const canvasRect = gl.domElement.getBoundingClientRect();
      const x0 = r.left - canvasRect.left;
      const y0 = r.top - canvasRect.top;
      const x1 = x0 + r.width;
      const y1 = y0 + r.height;
      // discard offscreen (behind cam or outside)
      if (r.width === 0 || r.height === 0 || x1 < 0 || y1 < 0 || x0 > w || y0 > h) {
        el.style.opacity = "0";
        continue;
      }
      boxes.push({ name: l.name, priority: l.priority, box: [x0, y0, x1, y1], el });
    }
    // sort by priority ascending (lower number = higher priority)
    boxes.sort((a, b) => a.priority - b.priority);
    const kept = [];
    for (const cur of boxes) {
      let overlap = false;
      for (const k of kept) {
        const [ax0, ay0, ax1, ay1] = cur.box;
        const [bx0, by0, bx1, by1] = k.box;
        // Pad 4 px
        if (ax0 < bx1 + 4 && ax1 > bx0 - 4 && ay0 < by1 + 4 && ay1 > by0 - 4) {
          overlap = true; break;
        }
      }
      if (overlap) {
        cur.el.style.opacity = "0";
      } else {
        cur.el.style.opacity = "1";
        kept.push(cur);
      }
    }
  });

  return (
    <group>
      {list.map((l) => {
        const y = gltfScene ? raycastYAt(gltfScene, l.x, l.z) : 5;
        return (
          <Html
            key={l.name}
            position={[l.x, Math.max(y, 3) + 8, l.z]}
            center
            distanceFactor={mobile ? 260 : 220}
            occlude
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className="landmark-pill"
              data-testid={`landmark-${l.idx}`}
              ref={(el) => { if (el) wrapRefs.current[l.name] = el; }}
              style={{ opacity: 1 }}
            >
              {l.name}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

function ObjectPillInCanvas({ position, object, onClick }) {
  if (!position || !object) return null;
  const price = object.price_chf
    ? `CHF ${object.price_chf.toLocaleString("de-CH")}`
    : object.rent_chf ? `CHF ${object.rent_chf.toLocaleString("de-CH")}/Mt.` : "";
  return (
    <Html
      position={[position[0], (position[1] || 0) + 18, position[2]]}
      center
      distanceFactor={200}
      occlude
      zIndexRange={[20, 10]}
      style={{ pointerEvents: "auto" }}
    >
      <button className="object-pill" data-testid={`object-pill-${object.id}`} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <span className="dot"/>
        <span className="label">
          <span className="title">{object.title}</span>
          {price && <span className="meta">{price}</span>}
        </span>
      </button>
    </Html>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { this.props.onError?.(err); }
  render() { return this.state.hasError ? null : this.props.children; }
}
