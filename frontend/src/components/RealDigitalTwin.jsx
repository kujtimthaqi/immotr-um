/**
 * RealDigitalTwin — echte swisstopo-Gebäude, statisches GLB-Bake.
 * Zielgebäude (obj_trischli16, obj_reitbahn39, obj_geren9) sind separate Nodes
 * → können individuell hervorgehoben werden.
 *
 * Interaction:
 *  - selectedIndex Prop (extern gesetzt via Objekt-Karten oder Marker-Click)
 *  - onSelect Callback: Marker-Click meldet Auswahl nach oben
 *  - onDeselect Callback: „Übersicht"-Button
 *  - CameraRig fliegt gedämpft zum Target
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
    // WASM only — JS fallback removed for size (all target browsers support WASM).
    draco.setDecoderConfig({ type: "wasm" });
    loader.setDRACOLoader(draco);
  });

  const materials = useRef({
    bg: new THREE.MeshStandardMaterial({ color: "#e6e8ee", roughness: 0.85, metalness: 0.05 }),
    matte: new THREE.MeshStandardMaterial({ color: "#e6e8ee", roughness: 0.85, metalness: 0.05 }),
    goldOn: new THREE.MeshStandardMaterial({
      color: "#E6D3A8", roughness: 0.4, metalness: 0.4,
      emissive: "#C9A96E", emissiveIntensity: 1.1,
    }),
  });

  const targetMeshes = useRef({}); // name → mesh
  const edgeLines = useRef({}); // name → LineSegments

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
        // Add edge lines child for glow-outline
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
      obj.castShadow = false;
    });
    onReady?.({
      scene: gltf.scene,
      targetMeshes: targetMeshes.current,
    });
  }, [gltf, onReady]);

  // Switch materials on selection
  useEffect(() => {
    const names = Object.keys(targetMeshes.current);
    for (const nm of names) {
      const m = targetMeshes.current[nm];
      const isSelected = nm === selectedNodeName;
      m.material = isSelected ? materials.current.goldOn : materials.current.matte;
      const line = edgeLines.current[nm];
      if (line) line.material.opacity = isSelected ? 0.9 : 0;
    }
  }, [selectedNodeName]);

  return gltf?.scene ? <primitive object={gltf.scene} /> : null;
}

function raycastYAt(scene, x, z) {
  if (!scene) return 0;
  const rc = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0), 0, 2000);
  const hits = rc.intersectObject(scene, true);
  return hits.length ? hits[0].point.y : 0;
}

// ---- Interactive Marker with click ----
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
      onPointerOver={(e) => (document.body.style.cursor = "pointer")}
      onPointerOut={(e) => (document.body.style.cursor = "")}
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

function LimitedControls({ enabled }) {
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
    c.target.set(0, 40, 0);
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl, enabled]);
  useFrame(() => ref.current?.update());
  return null;
}

function CameraRig({ target, mobile }) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 40, 0));
  const angle = useRef(mobile ? -Math.PI / 3 : Math.PI / 4);
  useFrame((_, dt) => {
    if (target) {
      const [x, y, z] = target;
      desired.current.set(x + 100, Math.max(120, y + 70), z + 100);
      look.current.set(x, y * 0.5 + 20, z);
    } else {
      angle.current += dt * 0.06;
      const r = mobile ? 480 : 540;
      desired.current.set(Math.cos(angle.current) * r, mobile ? 360 : 320, Math.sin(angle.current) * r);
      look.current.set(0, 40, 0);
    }
    camera.position.lerp(desired.current, 0.05);
    camera.lookAt(look.current);
    // Debug hook for tests
    window.__twinDebug = {
      cam: [+camera.position.x.toFixed(1), +camera.position.y.toFixed(1), +camera.position.z.toFixed(1)],
      target,
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
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
      <planeGeometry args={[3000, 3000]} />
      <meshStandardMaterial color="#0f1b32" roughness={1} metalness={0} />
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

  // effective focus: selectedIndex overrides highlightIndex (hover)
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
        camera={{ position: [400, 320, 400], fov: 42, near: 1, far: 4000 }}
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
        <fog attach="fog" args={["#0A1428", 600, 2200]} />
        <ambientLight intensity={0.32} />
        <directionalLight position={[400, 800, 500]} intensity={1.4} color="#f7e6c2" />
        <directionalLight position={[-350, 300, -250]} intensity={0.32} color="#4b6ea8" />

        <Ground />
        <BodenseePlane />
        <ShoreLine />

        <Suspense fallback={null}>
          <ErrorBoundary onError={() => setGlbFailed(true)}>
            <RorschachBuildings mobile={mobile} selectedNodeName={selectedNode} onReady={setGltfState} />
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
        <LimitedControls enabled={!mobile} />

        <EffectComposer disableNormalPass>
          <Bloom intensity={mobile ? 0.4 : 0.7} luminanceThreshold={0.5} luminanceSmoothing={0.25} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {/* Selection label + Übersicht-Button */}
      {selectedLabel && (
        <div
          className="absolute top-3 right-3 glass px-3 py-2 rounded-full text-[10px] uppercase tracking-[0.24em] text-gold-light pointer-events-auto flex items-center gap-3"
          data-testid="twin-selection-label"
        >
          <span className="truncate max-w-[180px] text-white/90 normal-case tracking-tight">{selectedLabel.address}</span>
          <button
            onClick={onDeselect}
            data-testid="twin-deselect-btn"
            className="text-gold hover:text-gold-light underline underline-offset-2 uppercase tracking-[0.24em]"
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
