import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three-stdlib";

extend({ ThreeOrbitControls });

// Seeded PRNG
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useBuildings(count) {
  return useMemo(() => {
    const rng = mulberry32(42);
    const out = [];
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * 30;
      const z = -3 + rng() * 14;
      const w = 0.6 + rng() * 1.6;
      const d = 0.6 + rng() * 1.6;
      const h = 0.6 + Math.pow(rng(), 1.4) * 3.4;
      out.push({ pos: [x, h / 2, z], size: [w, h, d] });
    }
    return out;
  }, [count]);
}

function BuildingEdges({ size, color = "#3d4b6b" }) {
  const geom = useMemo(() => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const edges = new THREE.EdgesGeometry(box, 15);
    box.dispose();
    return edges;
  }, [size]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={color === "#3d4b6b" ? 0.55 : 1} />
    </lineSegments>
  );
}

function Building({ pos, size, highlight = false }) {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (highlight && meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.material.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.25;
    }
  });
  return (
    <group position={pos}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={highlight ? "#E6D3A8" : "#e6e8ee"}
          emissive={highlight ? "#C9A96E" : "#000000"}
          emissiveIntensity={highlight ? 0.85 : 0}
          roughness={highlight ? 0.3 : 0.85}
          metalness={highlight ? 0.35 : 0.15}
        />
      </mesh>
      <BuildingEdges size={size} color={highlight ? "#E6D3A8" : "#3d4b6b"} />
    </group>
  );
}

function HighlightPolygon({ position }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 1.6) * 0.05;
      ref.current.scale.set(s, 1, s);
      ref.current.material.opacity = 0.35 + Math.sin(clock.getElapsedTime() * 1.6) * 0.15;
    }
  });
  return (
    <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]} ref={ref}>
      <ringGeometry args={[1.6, 2.1, 48]} />
      <meshBasicMaterial color="#C9A96E" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Lake() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -10]}>
      <planeGeometry args={[60, 14]} />
      <meshStandardMaterial color="#0a1a30" metalness={0.85} roughness={0.15} emissive="#0a1428" emissiveIntensity={0.15} />
    </mesh>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#0f1b32" roughness={1} metalness={0} />
    </mesh>
  );
}

function GridLines() {
  const lines = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const pts = [];
    for (let i = -14; i <= 14; i += 2) {
      pts.push(-14, 0.02, i, 14, 0.02, i);
      pts.push(i, 0.02, -14, i, 0.02, 14);
    }
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geom;
  }, []);
  return (
    <lineSegments geometry={lines}>
      <lineBasicMaterial color="#C9A96E" transparent opacity={0.06} />
    </lineSegments>
  );
}

function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef();
  useEffect(() => {
    const c = new ThreeOrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.minPolarAngle = Math.PI / 5;
    c.maxPolarAngle = Math.PI / 2.4;
    c.minDistance = 10;
    c.maxDistance = 26;
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useFrame(() => ref.current?.update());
  return null;
}

function CameraRig({ target }) {
  const { camera } = useThree();
  const targetVec = useRef(new THREE.Vector3(0, 6, 12));
  useFrame(() => {
    if (target) {
      const [x, , z] = target;
      targetVec.current.set(x + 4, 5, z + 6);
    } else {
      targetVec.current.set(0, 8, 14);
    }
    camera.position.lerp(targetVec.current, 0.03);
    camera.lookAt(target ? new THREE.Vector3(target[0], 1.2, target[2]) : new THREE.Vector3(0, 0, 0));
  });
  return null;
}

export default function DigitalTwin({ highlightIndex, listings = [], mobile = false }) {
  const buildings = useBuildings(mobile ? 28 : 62);
  const [dpr] = useState([1, 1.5]);

  const highlightPositions = useMemo(() => {
    return listings.slice(0, 3).map((l, i) => buildings[i * 7 + 3]?.pos || [i * 3 - 3, 1.2, 2]);
  }, [buildings, listings]);

  const target = highlightIndex != null && highlightPositions[highlightIndex]
    ? highlightPositions[highlightIndex]
    : null;

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 10, 16], fov: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      onCreated={({ gl }) => { gl.setClearColor("#0A1428", 1); }}
    >
      <fog attach="fog" args={["#0A1428", 12, 45]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[10, 18, 10]}
        intensity={1.4}
        color="#f7e6c2"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 6, -5]} intensity={0.35} color="#4b6ea8" />

      <Ground />
      <Lake />
      <GridLines />

      <Suspense fallback={null}>
        {buildings.map((b, i) => {
          const isHighlight = highlightPositions.some((p) => p && p[0] === b.pos[0] && p[2] === b.pos[2]);
          return <Building key={i} pos={b.pos} size={b.size} highlight={isHighlight} />;
        })}
        {highlightPositions.map((p, i) => p && <HighlightPolygon key={`h-${i}`} position={p} />)}
      </Suspense>

      <Controls />
      <CameraRig target={target} />

      <EffectComposer disableNormalPass>
        <Bloom intensity={0.7} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
