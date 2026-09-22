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

  // Materials — Refs für Lerp auf color / emissive
  const materials = useRef({
    bg: new THREE.MeshStandardMaterial({ color: "#dfe3ec", roughness: 0.78, metalness: 0.08 }),
    matte: new THREE.MeshStandardMaterial({ color: "#dfe3ec", roughness: 0.78, metalness: 0.08 }),
    goldOn: new THREE.MeshStandardMaterial({
      color: "#EBD4A8", roughness: 0.35, metalness: 0.45,
      emissive: "#C9A96E", emissiveIntensity: 1.15,
    }),
  });
  // Zieltönungen: für Spotlight-Übergang
  const colorBgBase = useRef(new THREE.Color("#dfe3ec"));
  const colorBgDim  = useRef(new THREE.Color("#33445e"));

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

function BodenseePlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -500]}>
      <planeGeometry args={[3000, 900]} />
      <meshStandardMaterial color="#0a1a30" metalness={0.85} roughness={0.18} emissive="#0a1428" emissiveIntensity={0.25} />
    </mesh>
  );
}

function ShoreLine() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-600, 0.5, -50, 600, 0.5, -50], 3));
    return g;
  }, []);
  return <line geometry={geo}><lineBasicMaterial color="#C9A96E" transparent opacity={0.55} /></line>;
}

function Ground() {
  // Sehr dunkler Boden, damit Dächer im Vergleich hell wirken
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
      <planeGeometry args={[3000, 3000]} />
      <meshStandardMaterial color="#070f22" roughness={1} metalness={0} />
    </mesh>
  );
}

// ---- Main ----
export default function RealDigitalTwin({ highlightIndex, selectedIndex, onSelect, onDeselect, listings = [], mobile = false }) {
  const [webglLost, setWebglLost] = useState(false);
  const [glbFailed, setGlbFailed] = useState(false);
  const [gltfState, setGltfState] = useState(null);

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
        dpr={mobile ? [1, 1.5] : [1, 2]}
        camera={{ position: [400, 380, 400], fov: 42, near: 1, far: 4000 }}
        gl={{
          antialias: !mobile,
          powerPreference: mobile ? "low-power" : "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0A1428", 1);
          gl.domElement.style.touchAction = mobile ? "pan-y" : "none";
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setWebglLost(true);
          });
        }}
        style={{ touchAction: mobile ? "pan-y" : "none" }}
      >
        <fog attach="fog" args={["#0A1428", 800, 2800]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[350, 700, 200]} intensity={1.35} color="#f7e6c2" />
        <directionalLight position={[-300, 220, -320]} intensity={0.35} color="#3d5a86" />

        <Ground />
        <BodenseePlane />
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
        Gebäudedaten © swisstopo
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { this.props.onError?.(err); }
  render() { return this.state.hasError ? null : this.props.children; }
}
