/**
 * RealDigitalTwin — echte Gebäude aus swisstopo swissBUILDINGS3D,
 * einmalig serverseitig zu /twin/rorschach.glb (~800 KB) und
 * /twin/rorschach-lite.glb (~470 KB) gebacken (siehe scripts/build_twin.py).
 * Läuft flüssig auf Mobile & Desktop, 1 einziger Request pro Session.
 *
 * Data © swisstopo — Open Data.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three-stdlib";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import StylizedDigitalTwin from "./DigitalTwin";

// Rorschach-Zentrum (identisch zu build_twin.py — sonst wandern die Marker!)
const CENTER_LAT = 47.4775;
const CENTER_LON = 9.4880;
const DEG = Math.PI / 180;

// Lat/Lon → local ENU meters (Y-up, X=East, Z=South)
function latLngToLocal(lat, lng) {
  const dLat = (lat - CENTER_LAT) * 111320;
  const dLon = (lng - CENTER_LON) * 111320 * Math.cos(CENTER_LAT * DEG);
  return [dLon, 0, -dLat];
}

// ---- Shared Draco loader (self-hosted decoder — no external CDN) ----
function makeGLTFLoader() {
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);
  return gltfLoader;
}

// ---- Buildings from baked GLB ----
function RorschachBuildings({ mobile, onReady }) {
  const url = mobile ? "/twin/rorschach-lite.glb" : "/twin/rorschach.glb";
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    loader.setDRACOLoader(draco);
  });

  const meshRef = useRef();

  useEffect(() => {
    if (!gltf?.scene) return;
    // Uniform matte material for all buildings
    const buildingMat = new THREE.MeshStandardMaterial({
      color: "#e6e8ee",
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.FrontSide,
      flatShading: false,
    });
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = buildingMat;
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.geometry?.computeVertexNormals?.();
        obj.frustumCulled = true;
        meshRef.current = obj;
      }
    });
    onReady?.(meshRef.current);
  }, [gltf, onReady]);

  return gltf?.scene ? <primitive object={gltf.scene} /> : null;
}

// ---- Raycast helper: find y (top of buildings) at (x, z) ----
function raycastYAt(mesh, x, z) {
  if (!mesh) return 0;
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, 500, z),
    new THREE.Vector3(0, -1, 0),
    0,
    2000
  );
  const hits = raycaster.intersectObject(mesh, false);
  return hits.length ? hits[0].point.y : 0;
}

// ---- Gold-Marker column + pulsating ring at a building ----
function ObjectMarker({ position, highlight = false, label, sub }) {
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
      beamRef.current.material.emissiveIntensity = 1.3 + Math.sin(t * 2.4) * 0.4;
    }
  });
  const baseY = position[1] ?? 0;
  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Boden-Ring auf Höhe 0 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} ref={ringRef}>
        <ringGeometry args={[8, 12, 64]} />
        <meshBasicMaterial
          color={highlight ? "#E6D3A8" : "#C9A96E"}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[3.5, 5, 48]} />
        <meshBasicMaterial color="#C9A96E" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Beam von Boden bis knapp über Dach */}
      <mesh ref={beamRef} position={[0, baseY / 2 + 15, 0]}>
        <cylinderGeometry args={[0.5, 0.5, baseY + 30, 16]} />
        <meshStandardMaterial
          color="#E6D3A8"
          emissive="#C9A96E"
          emissiveIntensity={1.4}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Kugel oben */}
      <mesh position={[0, baseY + 32, 0]}>
        <sphereGeometry args={[1.6, 16, 16]} />
        <meshStandardMaterial color="#E6D3A8" emissive="#E6D3A8" emissiveIntensity={2.2} />
      </mesh>
    </group>
  );
}

// ---- Highlight outline of building "top" via raycast bounding box ----
function BuildingHighlight({ position }) {
  const groupRef = useRef();
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((c) => {
      if (c.material) c.material.opacity = 0.55 + Math.sin(t * 2) * 0.25;
    });
  });
  const [x, y, z] = position;
  const w = 10, h = Math.max(6, y - 2);
  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {/* Kanten-Box am Ort */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, w)]} attach="geometry" />
        <lineBasicMaterial color="#E6D3A8" transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

// ---- Camera control ----
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
    c.target.set(0, 20, 0);
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
      desired.current.set(x + 120, Math.max(140, y + 90), z + 120);
      look.current.set(x, y * 0.5 + 20, z);
    } else {
      angle.current += dt * 0.06;
      const r = mobile ? 480 : 540;
      desired.current.set(Math.cos(angle.current) * r, mobile ? 360 : 320, Math.sin(angle.current) * r);
      look.current.set(0, 40, 0);
    }
    camera.position.lerp(desired.current, 0.045);
    camera.lookAt(look.current);
  });
  return null;
}

// ---- Bodensee (north of Rorschach) ----
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
    const pts = [-600, 0.5, -50, 600, 0.5, -50];
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <line geometry={geo}>
      <lineBasicMaterial color="#C9A96E" transparent opacity={0.55} />
    </line>
  );
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
export default function RealDigitalTwin({ highlightIndex, listings = [], mobile = false }) {
  const [webglLost, setWebglLost] = useState(false);
  const [glbFailed, setGlbFailed] = useState(false);
  const [buildingsMesh, setBuildingsMesh] = useState(null);

  const objects = useMemo(
    () =>
      listings
        .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
        .slice(0, 3),
    [listings]
  );

  // ENU (x, 0, z) für jede Adresse
  const rawPositions = useMemo(
    () => objects.map((o) => latLngToLocal(o.lat, o.lng)),
    [objects]
  );

  // Nach GLB-Load: raycasten und y-Höhe (Dach) je Punkt bestimmen
  const positions = useMemo(() => {
    if (!buildingsMesh) return rawPositions;
    return rawPositions.map(([x, , z]) => [x, raycastYAt(buildingsMesh, x, z), z]);
  }, [rawPositions, buildingsMesh]);

  const target = highlightIndex != null && positions[highlightIndex] ? positions[highlightIndex] : null;

  if (webglLost || glbFailed) {
    return <StylizedDigitalTwin highlightIndex={highlightIndex} listings={listings} mobile={mobile} />;
  }

  return (
    <div className="relative w-full h-full" data-testid="real-digital-twin">
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
            <RorschachBuildings mobile={mobile} onReady={setBuildingsMesh} />
          </ErrorBoundary>
        </Suspense>

        {/* Object markers @ real swisstopo lat/lng, y raycasted */}
        {positions.map((p, i) => (
          <group key={objects[i]?.id || i}>
            {highlightIndex === i && <BuildingHighlight position={p} />}
            <ObjectMarker
              position={p}
              highlight={highlightIndex === i}
              label={objects[i]?.title}
              sub={objects[i]?.address}
            />
          </group>
        ))}

        <CameraRig target={target} mobile={mobile} />
        <LimitedControls enabled={!mobile} />

        <EffectComposer disableNormalPass>
          <Bloom intensity={mobile ? 0.4 : 0.7} luminanceThreshold={0.5} luminanceSmoothing={0.25} mipmapBlur />
        </EffectComposer>
      </Canvas>

      <div
        className="absolute bottom-2 left-3 text-[10px] tracking-[0.16em] text-white/50 pointer-events-none select-none"
        data-testid="swisstopo-attribution"
      >
        Gebäudedaten © swisstopo
      </div>
    </div>
  );
}

// ---- Simple ErrorBoundary for GLB load failures ----
import React from "react";
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { this.props.onError?.(err); }
  render() { return this.state.hasError ? null : this.props.children; }
}
