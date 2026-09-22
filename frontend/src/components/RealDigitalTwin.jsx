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
function CameraRig({ target, mobile }) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3(400, 380, 400));
  const look = useRef(new THREE.Vector3(0, 30, 0));
  const angle = useRef(mobile ? -Math.PI / 3.5 : Math.PI / 4);
  const prevTarget = useRef(null);

  useFrame((_, dt) => {
    // Detect target transition to invalidate old inertia
    const t = target ? `${target[0].toFixed(1)},${target[1].toFixed(1)},${target[2].toFixed(1)}` : null;
    const changed = t !== prevTarget.current;
    prevTarget.current = t;

    if (target) {
      const [x, y, z] = target;
      const groundDist = mobile ? 105 : 130;
      const elevRad = 32 * DEG;
      const camH = groundDist * Math.tan(elevRad);
      desired.current.set(x, y + camH, z + groundDist);
      look.current.set(x, y * 0.5 + 12, z - 25);
    } else {
      angle.current += dt * 0.05;
      const r = mobile ? 460 : 500;
      const camY = r * Math.tan(38 * DEG);
      desired.current.set(Math.cos(angle.current) * r, camY, Math.sin(angle.current) * r);
      look.current.set(0, 30, 0);
    }
    // Snap start on transition to make detail-view arrive quickly
    if (changed && target) {
      // start from a slightly retracted position to keep motion smooth (~0.6s)
      const [x, y, z] = target;
      camera.position.set(x + 30, y + 200, z + 240);
    }
    const alpha = target ? 0.14 : 0.05;
    camera.position.lerp(desired.current, alpha);
    camera.lookAt(look.current);
    window.__twinDebug = {
      cam: [+camera.position.x.toFixed(1), +camera.position.y.toFixed(1), +camera.position.z.toFixed(1)],
      target,
      desired: [+desired.current.x.toFixed(1), +desired.current.y.toFixed(1), +desired.current.z.toFixed(1)],
    };
  });
  return null;
}

function BodenseePlane({ mobile }) {
  // Nördlich vom Ufer (Z=−50 ist grobe Uferlinie im ENU). Wasser reicht bis −2500 m.
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, -1300]}>
      <planeGeometry args={[3400, 2500]} />
      <meshStandardMaterial
        color="#0d1e38"
        metalness={mobile ? 0.55 : 0.85}
        roughness={mobile ? 0.42 : 0.22}
        emissive="#0a1830"
        emissiveIntensity={0.28}
        transparent
        opacity={0.94}
      />
    </mesh>
  );
}

function ShoreLine() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-700, 0.5, -70, 700, 0.5, -70], 3));
    return g;
  }, []);
  return <line geometry={geo}><lineBasicMaterial color="#C9A96E" transparent opacity={0.35} /></line>;
}

// ---- Orthophoto Ground (SWISSIMAGE) ----
function OrthoGround({ meta, mobile }) {
  const info = meta?.ground?.[mobile ? "mobile" : "desktop"];
  const url = info?.file ? `/twin/${info.file}` : null;
  const tex = useLoader(THREE.TextureLoader, url || "/twin/ground-lite.webp");
  useEffect(() => {
    if (!tex) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
  }, [tex]);

  const dims = useMemo(() => {
    if (!info) return null;
    const { nw_lat, nw_lon, se_lat, se_lon } = info.bounds;
    const DEG = Math.PI / 180;
    const CENTER_LAT = meta.center.lat;
    const CENTER_LON = meta.center.lon;
    const to_enu = (lat, lon) => {
      const dLat = (lat - CENTER_LAT) * 111320;
      const dLon = (lon - CENTER_LON) * 111320 * Math.cos(CENTER_LAT * DEG);
      return [dLon, -dLat];
    };
    const [xW, zN] = to_enu(nw_lat, nw_lon);
    const [xE, zS] = to_enu(se_lat, se_lon);
    return { xW, xE, zN, zS };
  }, [info, meta]);

  if (!info || !dims) return null;
  const width = dims.xE - dims.xW;
  const depth = dims.zS - dims.zN;
  const cx = (dims.xE + dims.xW) / 2;
  const cz = (dims.zS + dims.zN) / 2;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.35, cz]} receiveShadow={!mobile}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.94}
        metalness={0.02}
        color="#8798b0"
      />
    </mesh>
  );
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

function SkyDome() {
  // Vertex-Color-Gradient von Navy oben zu Champagner am Horizont
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(3000, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const colors = [];
    const pos = g.attributes.position;
    const topCol = new THREE.Color("#050c1e");
    const midCol = new THREE.Color("#1a2a4a");
    const horCol = new THREE.Color("#c9a17a");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 3000; // 0..1 top
      let c;
      if (y > 0.55) c = topCol.clone();
      else if (y > 0.15) c = midCol.clone().lerp(topCol, (y - 0.15) / 0.4);
      else c = horCol.clone().lerp(midCol, y / 0.15);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, []);
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

  useEffect(() => {
    fetch("/twin/twin-meta.json").then(r => r.json()).then(setMeta).catch(() => setMeta(null));
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
    <div className="relative w-full h-full" data-testid="real-digital-twin" data-selected-index={selectedIndex ?? ""}>
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
        <fog attach="fog" args={["#0d1a34", 900, 3400]} />
        <ambientLight intensity={0.48} />
        {/* Warme Abendsonne aus Westen (tief) */}
        <directionalLight position={[-450, 260, 120]} intensity={1.15} color="#f5c98a" />
        {/* Kühles Fill von der See-Seite (Nord) */}
        <directionalLight position={[80, 320, -400]} intensity={0.42} color="#5e7ba8" />

        <SkyDome />
        <Ground />
        <Suspense fallback={null}>
          {meta && <OrthoGround meta={meta} mobile={mobile} />}
        </Suspense>
        <BodenseePlane mobile={mobile} />
        <ShoreLine />

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

        <CameraRig target={target} mobile={mobile} />
        <LimitedControls enabled={!mobile} active={target == null} />

        <EffectComposer disableNormalPass>
          <Bloom
            intensity={mobile ? 0.4 : 0.7}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.28}
          />
        </EffectComposer>
      </Canvas>

      {/* Landmark-Labels (HTML-Overlay) */}
      {meta?.landmarks && !selectedLabel && (
        <LandmarkLabels landmarks={meta.landmarks} gltfScene={gltfState?.scene} mobile={mobile} />
      )}

      {/* Kompass */}
      <div className="absolute top-3 left-3 pointer-events-none select-none" data-testid="twin-compass">
        <svg width={mobile ? 36 : 44} height={mobile ? 36 : 44} viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="rgba(10,20,40,0.55)" stroke="rgba(201,169,110,0.4)" strokeWidth="1"/>
          <path d="M22 6 L26 22 L22 20 L18 22 Z" fill="#C9A96E"/>
          <path d="M22 38 L26 22 L22 24 L18 22 Z" fill="rgba(255,255,255,0.45)"/>
          <text x="22" y="12" fill="#E6D3A8" fontSize="7" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">N</text>
        </svg>
      </div>

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
        Luftbild · Gebäude © swisstopo
      </div>
    </div>
  );
}

// ---- Landmark Labels (HTML overlay, projected via camera each frame) ----
function LandmarkLabels({ landmarks, gltfScene, mobile }) {
  const [screenPositions, setScreenPositions] = useState([]);
  const { camera, size } = useThree ? { camera: null, size: null } : { camera: null, size: null };
  // We need to hook useFrame in the Canvas context; render as a Canvas child instead.
  return null; // Simplification — labels are handled inside canvas via <Html> in a future pass.
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { this.props.onError?.(err); }
  render() { return this.state.hasError ? null : this.props.children; }
}
