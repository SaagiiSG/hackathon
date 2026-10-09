"use client";

// three.js objects (camera, controls, meshes) are mutated inside useFrame on
// purpose: that is how React Three Fiber animates without re-rendering React.
/* eslint-disable react-hooks/immutability */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Html, Line, MapControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Plus } from "lucide-react";
import { FLOOR_H, FOOTPRINT, PLOT, STREET, type Building, type Lodge, type Plot, type Road, type TownLayout } from "@/lib/town/layout";
import { TOKENS, friendColor } from "@/lib/town/palette";
import { sound } from "@/lib/town/sound";

export type SceneCommand = { type: "focus"; key: string; n: number } | { type: "reset"; n: number };

export type ScenePhoto = { id: string; url: string; title: string };

type Props = {
  layout: TownLayout;
  selected: string | null;
  onSelect: (key: string) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  command: SceneCommand | null;
  reducedMotion: boolean;
  // Photos of the selected building or lodge; they pop out of its roof.
  selectedPhotos?: ScenePhoto[];
  // Desktop hover pill: "Add a memory to {month}".
  onAddTo?: (month: string) => void;
};

// Near-isometric view from the south-east, like a city-builder game. Never rotates.
const DIR = new THREE.Vector3(1, 1.05, 1).normalize();
const FOV = 24;
const MIN_D = 16;
const PAD_H = 0.12;
const PAD = PLOT - STREET;

// Tokens blended toward white, so the city reads bright and clean.
const WHITE = new THREE.Color(TOKENS.canvas);
const towardWhite = (hex: string, k: number) => `#${new THREE.Color(hex).lerp(WHITE, k).getHexString()}`;
const LAWN = towardWhite(TOKENS.cardTintMint, 0.35);
const ROAD = TOKENS.hairlineSoft;
const LEAF = towardWhite(TOKENS.brandTeal, 0.8);
const PARK_LEAF = towardWhite(TOKENS.brandGreen, 0.72);
const TRUNK = towardWhite(TOKENS.brandBrown, 0.72);

// Facade texture per floor: white window cells on a fine grid, a few lit warm
// yellow or pale grey, and a tiny tick in the author's color. Stable per memory.
const facades = new Map<string, THREE.CanvasTexture>();
function facadeFor(memoryId: string, author: string) {
  const cached = facades.get(memoryId);
  if (cached) return cached;
  const cols = 6;
  const cw = 16;
  const c = document.createElement("canvas");
  c.width = cols * cw;
  c.height = 20;
  const g = c.getContext("2d")!;
  g.fillStyle = TOKENS.hairline;
  g.fillRect(0, 0, c.width, c.height);
  let h = 0;
  for (let i = 0; i < memoryId.length; i++) h = (h * 31 + memoryId.charCodeAt(i)) >>> 0;
  for (let i = 0; i < cols; i++) {
    const r = (h >>> (i * 3)) & 7;
    g.fillStyle = r === 0 ? TOKENS.brandYellow : r === 1 ? TOKENS.surface : TOKENS.canvas;
    g.fillRect(i * cw + 1, 1, cw - 2, c.height - 2);
  }
  g.fillStyle = towardWhite(author, 0.35);
  g.fillRect(1, c.height - 4, 5, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  facades.set(memoryId, tex);
  return tex;
}

export default function TownScene(props: Props) {
  return (
    <Canvas
      flat
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ fov: FOV, near: 1, far: 4000, position: [60, 63, 60] }}
    >
      <color attach="background" args={[TOKENS.canvas]} />
      <fog attach="fog" args={[TOKENS.canvas, 200, 600]} />
      <Lights outer={props.layout.outer} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color={TOKENS.canvas} />
      </mesh>
      <Rig {...props} />
      <TownContent {...props} />
    </Canvas>
  );
}

function Lights({ outer }: { outer: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const cam = light.current?.shadow.camera;
    if (!cam) return;
    cam.left = -outer - 4;
    cam.right = outer + 4;
    cam.top = outer + 4;
    cam.bottom = -outer - 4;
    cam.far = outer * 6;
    cam.updateProjectionMatrix();
  }, [outer]);
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={[TOKENS.canvas, TOKENS.cardTintGray, 0.75]} />
      <directionalLight
        ref={light}
        position={[outer * 0.5, outer * 1.6, -outer * 0.35]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />
    </>
  );
}

// ---------- Camera: pan, zoom, glide ----------

type Goal = { target: THREE.Vector3; dist: number; fromSlider: boolean };

function fitDistance(radius: number, aspect: number) {
  const v = THREE.MathUtils.degToRad(FOV);
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  return radius / Math.sin(Math.min(v, h) / 2);
}

function Rig({ layout, zoom, onZoom, command, reducedMotion }: Props) {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const goal = useRef<Goal | null>(null);
  const lastZoom = useRef(-1);
  const placed = useRef(false);

  const fit = fitDistance(layout.lodgeRing + PLOT * 0.4, size.width / Math.max(size.height, 1));
  const maxD = Math.max(fit * 1.35, MIN_D * 2);
  const range = useRef({ min: MIN_D, max: maxD, fit });
  useLayoutEffect(() => {
    range.current = { min: MIN_D, max: maxD, fit };
  });

  const toDist = (z: number) => maxD - z * (maxD - MIN_D);

  // First frame: frame the whole town.
  useLayoutEffect(() => {
    if (placed.current || !controls.current) return;
    placed.current = true;
    controls.current.target.set(0, 0, 0);
    camera.position.copy(DIR).multiplyScalar(fit);
    controls.current.update();
  });

  // Slider moved: glide to that distance.
  useEffect(() => {
    if (Math.abs(zoom - lastZoom.current) < 0.003 || !controls.current) return;
    lastZoom.current = zoom;
    goal.current = { target: controls.current.target.clone(), dist: toDist(zoom), fromSlider: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Focus a building/lodge, or reset to the whole town.
  useEffect(() => {
    if (!command || !controls.current) return;
    if (command.type === "reset") {
      goal.current = { target: new THREE.Vector3(), dist: range.current.fit, fromSlider: false };
      return;
    }
    const spot = spotFor(layout, command.key);
    if (!spot) return;
    const dist = THREE.MathUtils.clamp(Math.max(MIN_D * 2.2, spot.h * 3.4), MIN_D, range.current.max);
    // On phones the sheet covers the bottom 60%: aim below the place so it sits up top.
    const shift = size.width < 640 ? dist * 0.75 : 0;
    goal.current = {
      target: new THREE.Vector3(spot.x + shift, 0, spot.z + shift),
      dist,
      fromSlider: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const target = c.target;
    const g = goal.current;
    if (g) {
      const f = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
      target.lerp(g.target, f);
      const d = camera.position.distanceTo(target);
      const nd = d + (g.dist - d) * f;
      camera.position.copy(target).addScaledVector(DIR, nd);
      if (target.distanceTo(g.target) < 0.02 && Math.abs(nd - g.dist) < 0.02) goal.current = null;
      c.update();
    }

    // Keep the town on screen.
    const b = layout.outer;
    const cx = THREE.MathUtils.clamp(target.x, -b, b);
    const cz = THREE.MathUtils.clamp(target.z, -b, b);
    if (cx !== target.x || cz !== target.z) {
      camera.position.x += cx - target.x;
      camera.position.z += cz - target.z;
      target.x = cx;
      target.z = cz;
    }

    const d = camera.position.distanceTo(target);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = d + layout.outer * 0.35;
      scene.fog.far = d + layout.outer * 2.2;
    }
    if (!goal.current?.fromSlider) {
      const z = THREE.MathUtils.clamp((maxD - d) / (maxD - MIN_D), 0, 1);
      if (Math.abs(z - lastZoom.current) > 0.004) {
        lastZoom.current = z;
        onZoom(z);
      }
    }
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      minDistance={MIN_D}
      maxDistance={maxD}
      zoomSpeed={0.8}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}

function spotFor(layout: TownLayout, key: string) {
  const b = layout.buildings.find((x) => x.key === key);
  if (b) return { x: b.plot.x * PLOT, z: b.plot.z * PLOT, h: b.floors.length * FLOOR_H };
  const l = layout.lodges.find((x) => x.key === key);
  if (l) return { x: l.x, z: l.z, h: 2 };
  return null;
}

// ---------- Growth animation ----------

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

// Grows an object from nothing. `initial` applies to things present when the
// town first loads (a staggered intro); `late` to things added afterwards.
function useGrow(
  ref: RefObject<THREE.Object3D | null>,
  delays: { initial: number; late: number },
  reducedMotion: boolean,
  mode: "y" | "pop" = "y",
  onStart?: () => void,
) {
  const start = useRef<number | null>(null);
  const done = useRef(reducedMotion);
  const late = useRef(false);
  const fired = useRef(false);
  useLayoutEffect(() => {
    if (!ref.current || done.current) return;
    if (mode === "y") ref.current.scale.set(1, 0.0001, 1);
    else ref.current.scale.setScalar(0.0001);
  }, [ref, mode]);
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    if (start.current === null) {
      late.current = now >= 1;
      start.current = now + (reducedMotion ? 0 : late.current ? delays.late : delays.initial);
    }
    // Sound on the same frame the growth starts; not for the intro.
    if (!fired.current && now >= start.current) {
      fired.current = true;
      if (late.current) onStart?.();
    }
    if (done.current || !ref.current) return;
    const t = (now - start.current) / 0.55;
    if (t < 0) return;
    const k = t >= 1 ? 1 : mode === "y" ? easeOut(t) : easeBack(t);
    if (mode === "y") ref.current.scale.set(1, Math.max(k, 0.0001), 1);
    else ref.current.scale.setScalar(Math.max(k, 0.0001));
    if (t >= 1) done.current = true;
  });
}

// ---------- Town ----------

function TownContent({ layout, selected, onSelect, zoom, reducedMotion, selectedPhotos, onAddTo }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const phone = useThree((s) => s.size.width < 640);
  // Phones: labels only when zoomed in, plus the hovered/selected one.
  const compact = phone && zoom < 0.55;

  // Hover pill beside a building; stays while the pointer crosses onto it.
  const [finePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const [tip, setTip] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const overTip = useRef(false);
  const showTip = (key: string) => {
    if (overTip.current) return;
    clearTimeout(tipTimer.current);
    setTip(key);
  };
  const hideTip = () => {
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      if (!overTip.current) setTip(null);
    }, 250);
  };
  useEffect(() => () => clearTimeout(tipTimer.current), []);
  // Touch has no hover: show the pill for the tapped building instead.
  const tipKey = finePointer ? (tip !== selected ? tip : null) : selected;
  const tipBuilding = onAddTo ? layout.buildings.find((b) => b.key === tipKey) : undefined;

  // Photo fans: the selected one is open; others sink back and then drop out.
  const [fans, setFans] = useState<{ key: string; photos: ScenePhoto[] }[]>([]);
  const photos = (selectedPhotos ?? []).slice(phone ? -4 : -6);
  const current = fans.find((f) => f.key === selected);
  if (selected && photos.length > 0 && current?.photos.map((p) => p.id).join() !== photos.map((p) => p.id).join()) {
    setFans([...fans.filter((f) => f.key !== selected), { key: selected, photos }]);
  }

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const hover = (key: string | null) =>
    setHovered((h) => (key === null ? null : key === h ? h : key));
  const pick = (key: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // that was a drag, not a click
    onSelect(key);
  };

  const empty = layout.buildings.length === 0;

  return (
    <group>
      {layout.streets && <Streets radius={layout.radius} />}
      <Roads roads={layout.roads} />
      {layout.emptyLots.map((p) => (
        <Pad key={`lot-${p.x}-${p.z}`} plot={p} />
      ))}
      {layout.plazas.map((p) => (
        <Plaza key={`plaza-${p.x}-${p.z}`} plot={p} />
      ))}
      {empty && <FirstPlot />}
      {layout.buildings.map((b, i) => (
        <BuildingMesh
          key={b.key}
          b={b}
          index={i}
          active={hovered === b.key || selected === b.key}
          onOver={() => {
            hover(b.key);
            showTip(b.key);
          }}
          onOut={() => {
            setHovered((h) => (h === b.key ? null : h));
            hideTip();
          }}
          onClick={pick(b.key)}
          reducedMotion={reducedMotion}
          showLabel={!compact}
        />
      ))}
      {layout.parks.map((p, i) => (
        <Park key={`park-${i}`} plot={p} reducedMotion={reducedMotion} />
      ))}
      {layout.landmark && <Landmark plot={layout.landmark} reducedMotion={reducedMotion} />}
      {layout.streets && <Streetlights radius={layout.radius} lit={layout.streetlights} />}
      {Array.from({ length: layout.carCount }, (_, i) => (
        <Car key={i} index={i} radius={layout.radius} reducedMotion={reducedMotion} />
      ))}
      <Woods trees={layout.trees} />
      {layout.lodges.map((l) => (
        <LodgeMesh
          key={l.key}
          lodge={l}
          active={hovered === l.key || selected === l.key}
          onOver={() => hover(l.key)}
          onOut={() => setHovered((h) => (h === l.key ? null : h))}
          onClick={pick(l.key)}
          reducedMotion={reducedMotion}
          showLabel={!compact}
        />
      ))}
      <Clouds outer={layout.outer} reducedMotion={reducedMotion} />
      {fans.map((f) => {
        const anchor = fanAnchor(layout, f.key);
        return anchor ? (
          <PhotoFan
            key={f.key}
            anchor={anchor}
            photos={f.photos}
            open={selected === f.key}
            reducedMotion={reducedMotion}
            compact={phone}
            onClosed={() => setFans((list) => list.filter((x) => x.key !== f.key))}
          />
        ) : null;
      })}
      {tipBuilding && onAddTo && (
        <AddPill
          key={tipBuilding.key}
          b={tipBuilding}
          compact={phone}
          reducedMotion={reducedMotion}
          onEnter={() => {
            overTip.current = true;
            clearTimeout(tipTimer.current);
          }}
          onLeave={() => {
            overTip.current = false;
            hideTip();
          }}
          onClick={() => {
            overTip.current = false;
            setTip(null);
            onAddTo(tipBuilding.month);
          }}
        />
      )}
    </group>
  );
}

// ---------- Hover pill and photo fan ----------

// Keeps DOM overlays from panning the map or hovering what's behind them.
const stopMap = (e: React.PointerEvent | React.WheelEvent) => e.stopPropagation();

function AddPill({
  b,
  compact,
  reducedMotion,
  onEnter,
  onLeave,
  onClick,
}: {
  b: Building;
  compact: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  // Anchored to the building's right-hand corner as seen from the camera.
  const h = b.floors.length * FLOOR_H;
  const portal = useHtmlPortal();
  return (
    <group
      position={
        compact
          ? [b.plot.x * PLOT + PAD / 2, 0, b.plot.z * PLOT + PAD / 2] // phones: centered under the building
          : [b.plot.x * PLOT + FOOTPRINT / 2, PAD_H + Math.min(h, 4) * 0.5, b.plot.z * PLOT - FOOTPRINT / 2]
      }
    >
      <Html portal={portal} zIndexRange={[12, 11]} style={{ pointerEvents: "none" }}>
        <button
          type="button"
          data-town-photo
          className={`glass-clear pointer-events-auto absolute top-0 left-0 flex ${compact ? "-translate-x-1/2 translate-y-2" : "-translate-y-1/2 translate-x-3"} items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-ink ${
            reducedMotion ? "animate-in fade-in" : "animate-in fade-in slide-in-from-left-2"
          } duration-150`}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          onPointerMove={stopMap}
          onPointerDown={stopMap}
          onWheel={stopMap}
          onClick={onClick}
        >
          <Plus className="size-3.5" aria-hidden />
          Add a memory to {b.longLabel}
        </button>
      </Html>
    </group>
  );
}

function fanAnchor(layout: TownLayout, key: string): [number, number, number] | null {
  const b = layout.buildings.find((x) => x.key === key);
  if (b) return [b.plot.x * PLOT, PAD_H + b.floors.length * FLOOR_H + (b.floors.length >= 8 ? 1.4 : 0.25), b.plot.z * PLOT];
  const l = layout.lodges.find((x) => x.key === key);
  if (l) return [l.x, 1.7, l.z];
  return null;
}

// Where card i of n settles: an arc above the roof, in screen pixels.
function fanTarget(i: number, n: number, compact: boolean) {
  const half = Math.min(55, 16 * (n - 1));
  const a = THREE.MathUtils.degToRad(n === 1 ? 0 : -half + (2 * half * i) / (n - 1));
  const r = compact ? 120 : 190;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r + (compact ? 20 : 40), r: THREE.MathUtils.radToDeg(a) * 0.35 };
}

// Small stable tilt per photo, -5..5 degrees.
function tiltOf(id: string) {
  let hsh = 0;
  for (let i = 0; i < id.length; i++) hsh = (hsh * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hsh) % 1000) / 1000) * 10 - 5;
}

type CardSpring = { x: number; y: number; s: number; vx: number; vy: number; vs: number; out: boolean };

// Spring step (mass 1) from damping ratio and response, Apple-style.
function springStep(x: number, v: number, target: number, dt: number, damping: number, response: number) {
  const k = (2 * Math.PI / response) ** 2;
  const c = (4 * Math.PI * damping) / response;
  const nv = v + (-k * (x - target) - c * v) * dt;
  return [x + nv * dt, nv] as const;
}

// Polaroids spring out of the roof (staggered 60ms), float, and sink back the same way.
function PhotoFan({
  anchor,
  photos,
  open,
  reducedMotion,
  compact,
  onClosed,
}: {
  anchor: [number, number, number];
  photos: ScenePhoto[];
  open: boolean;
  reducedMotion: boolean;
  compact: boolean;
  onClosed: () => void;
}) {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const springs = useRef<CardSpring[]>([]);
  const since = useRef<number | null>(null);
  const wasOpen = useRef(false);
  const closedCalled = useRef(false);
  const portal = useHtmlPortal();

  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime;
    if (open !== wasOpen.current || since.current === null) {
      wasOpen.current = open;
      since.current = now;
      closedCalled.current = false;
    }
    const n = photos.length;
    let resting = true;
    photos.forEach((p, i) => {
      const st = (springs.current[i] ??= { x: 0, y: 0, s: 0, vx: 0, vy: 0, vs: 0, out: false });
      const el = cards.current[i];
      // Out in order, back in reverse order.
      const wait = open ? i * 0.06 : (n - 1 - i) * 0.04;
      const want = open ? now - since.current! >= wait : now - since.current! < wait && st.out;
      if (want && !st.out) sound.playPop(i);
      st.out = want;
      const t = fanTarget(i, n, compact);
      const tx = st.out ? t.x : 0;
      const ty = st.out ? t.y : 0;
      const ts = st.out ? 1 : 0;
      if (reducedMotion) {
        // No movement: cards sit in place and cross-fade.
        st.x = t.x;
        st.y = t.y;
        st.s = ts;
      } else {
        // Out: critically damped with a tiny settle. Back: no overshoot.
        const damping = st.out ? 0.86 : 1;
        let left = Math.min(delta, 1 / 20);
        while (left > 0) {
          const dt = Math.min(left, 1 / 120);
          [st.x, st.vx] = springStep(st.x, st.vx, tx, dt, damping, 0.42);
          [st.y, st.vy] = springStep(st.y, st.vy, ty, dt, damping, 0.42);
          [st.s, st.vs] = springStep(st.s, st.vs, ts, dt, damping, 0.42);
          left -= dt;
        }
      }
      if (st.out || Math.abs(st.s) > 0.01 || Math.abs(st.vs) > 0.01) resting = false;
      if (!el) return;
      const bob = reducedMotion || !st.out ? 0 : Math.sin(now * 2.4 + i * 1.7) * 2;
      const s = reducedMotion ? 1 : Math.max(st.s, 0);
      el.style.transform = `translate(-50%, -50%) translate(${st.x}px, ${st.y + bob}px) rotate(${(t.r + tiltOf(p.id)) * s}deg) scale(${s})`;
      el.style.opacity = reducedMotion ? (st.out ? "1" : "0") : s < 0.03 ? "0" : "1";
    });
    if (!open && resting && !closedCalled.current && now - since.current! > (reducedMotion ? 0.25 : 0.1)) {
      closedCalled.current = true;
      onClosed();
    }
  });

  return (
    <group position={anchor}>
      <Html portal={portal} zIndexRange={[12, 11]} style={{ pointerEvents: "none" }}>
        <div className="relative size-0">
          {photos.map((p, i) => (
            <div
              key={p.id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              data-town-photo
              className={`pointer-events-auto absolute top-0 left-0 ${compact ? "w-[72px]" : "w-24"} rounded-[4px] bg-white p-1.5 pb-1 shadow-[0_8px_24px_-6px_rgba(15,15,15,0.25),0_0_0_1px_rgba(15,15,15,0.04)] ${
                reducedMotion ? "transition-opacity duration-200" : ""
              }`}
              style={{ transform: "translate(-50%, -50%) scale(0)", opacity: 0 }}
              onPointerDown={stopMap}
              onPointerMove={stopMap}
              onWheel={stopMap}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs */}
              <img src={p.url} alt={p.title} className="aspect-square w-full rounded-[2px] object-cover" draggable={false} />
              <p className="truncate pt-1 text-center text-[10px] leading-tight font-medium text-charcoal">{p.title}</p>
            </div>
          ))}
        </div>
      </Html>
    </group>
  );
}

// drei's Html re-mounts (and drops its content) when its default target switches
// to the events element after the first frame; pin it to the canvas wrapper.
function useHtmlPortal() {
  const gl = useThree((s) => s.gl);
  return useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
}

function Label({ y, title, count, show = true }: { y: number; title: string; count?: number; show?: boolean }) {
  const portal = useHtmlPortal();
  if (!show) return null;
  return (
    <Html portal={portal} position={[0, y, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-none font-medium whitespace-nowrap text-ink shadow-[0_2px_8px_-2px_rgba(15,15,15,0.12)] select-none">
        <span className="size-1.5 rounded-full bg-ink" aria-hidden />
        <span className="max-w-44 truncate">{title}</span>
        {count !== undefined && <span className="text-steel">{count}</span>}
      </span>
    </Html>
  );
}

function Pad({ plot, children }: { plot: Plot; children?: React.ReactNode }) {
  return (
    <group position={[plot.x * PLOT, 0, plot.z * PLOT]}>
      <mesh position={[0, PAD_H / 2, 0]} receiveShadow>
        <boxGeometry args={[PAD, PAD_H, PAD]} />
        <meshStandardMaterial color={TOKENS.canvas} />
        <Edges color={TOKENS.hairline} />
      </mesh>
      {children}
    </group>
  );
}

function FirstPlot() {
  const s = PAD / 2;
  return (
    <group>
      <Line
        points={[[-s, 0.03, -s], [s, 0.03, -s], [s, 0.03, s], [-s, 0.03, s], [-s, 0.03, -s]]}
        color={TOKENS.hairlineStrong}
        lineWidth={1.5}
        dashed
        dashSize={0.3}
        gapSize={0.2}
      />
      <Label y={0.8} title="Your first building" />
    </group>
  );
}

// Modern apartments; 8+ floors turns into a skyscraper with a crown.
function BuildingMesh({
  b,
  index,
  active,
  onOver,
  onOut,
  onClick,
  reducedMotion,
  showLabel,
}: {
  b: Building;
  index: number;
  active: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  reducedMotion: boolean;
  showLabel: boolean;
}) {
  const h = b.floors.length * FLOOR_H;
  const tall = b.floors.length >= 8;
  const slab = active ? TOKENS.cardTintLavender : TOKENS.canvas;
  return (
    <group
      position={[b.plot.x * PLOT, 0, b.plot.z * PLOT]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onOver();
      }}
      onPointerOut={onOut}
      onClick={onClick}
    >
      <mesh position={[0, PAD_H / 2, 0]} receiveShadow>
        <boxGeometry args={[PAD, PAD_H, PAD]} />
        <meshStandardMaterial color={TOKENS.canvas} />
        <Edges color={TOKENS.hairline} />
      </mesh>
      <group position={[0, PAD_H, 0]}>
        {b.floors.map((f, i) => (
          <FloorMesh
            key={f.memoryId}
            i={i}
            memoryId={f.memoryId}
            author={friendColor(f.colorIndex).hex}
            slab={slab}
            delays={{ initial: 0.2 + index * 0.12 + i * 0.05, late: 0.75 }}
            reducedMotion={reducedMotion}
            onGrow={() => sound.playBuild(b.floors.length === 1 ? "building" : "floor")}
          />
        ))}
        <Roof height={h} tall={tall} slab={slab} reducedMotion={reducedMotion} />
      </group>
      <Label y={PAD_H + h + (tall ? 2.4 : 1.1)} title={b.name ?? b.longLabel} count={b.count} show={showLabel || active} />
    </group>
  );
}

const SLAB = 0.1;
const POST = 0.12;

function FloorMesh({
  i,
  memoryId,
  author,
  slab,
  delays,
  reducedMotion,
  onGrow,
}: {
  i: number;
  memoryId: string;
  author: string;
  slab: string;
  delays: { initial: number; late: number };
  reducedMotion: boolean;
  onGrow: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  useGrow(ref, delays, reducedMotion, "y", onGrow);
  const glass = FLOOR_H - SLAB;
  const facade = useMemo(() => facadeFor(memoryId, author), [memoryId, author]);
  return (
    <group ref={ref} position={[0, i * FLOOR_H, 0]}>
      <mesh position={[0, SLAB / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[FOOTPRINT, SLAB, FOOTPRINT]} />
        <meshStandardMaterial color={slab} />
        <Edges color={TOKENS.hairline} />
      </mesh>
      <mesh position={[0, SLAB + glass / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[FOOTPRINT - 0.08, glass, FOOTPRINT - 0.08]} />
        <meshStandardMaterial map={facade} emissiveMap={facade} emissive={TOKENS.canvas} emissiveIntensity={0.12} />
      </mesh>
      {CORNERS.map(([cx, cz]) => (
        <mesh key={`${cx}${cz}`} position={[cx, SLAB + glass / 2, cz]} castShadow>
          <boxGeometry args={[POST, glass, POST]} />
          <meshStandardMaterial color={slab} />
        </mesh>
      ))}
    </group>
  );
}

const CORNERS = [-1, 1].flatMap((x) => [-1, 1].map((z) => [(x * (FOOTPRINT - POST)) / 2, (z * (FOOTPRINT - POST)) / 2] as const));

function Roof({ height, tall, slab, reducedMotion }: { height: number; tall: boolean; slab: string; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (ref.current && (reducedMotion || ref.current.position.y === 0)) ref.current.position.y = height;
  }, [height, reducedMotion]);
  useFrame((_, dt) => {
    if (!ref.current || reducedMotion) return;
    ref.current.position.y += (height - ref.current.position.y) * (1 - Math.exp(-dt * 7));
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[FOOTPRINT, 0.18, FOOTPRINT]} />
        <meshStandardMaterial color={slab} />
        <Edges color={TOKENS.hairlineStrong} />
      </mesh>
      {tall ? (
        <>
          <mesh position={[0, 0.18 + 0.6, 0]} castShadow>
            <boxGeometry args={[FOOTPRINT * 0.6, 1.2, FOOTPRINT * 0.6]} />
            <meshStandardMaterial color={slab} />
            <Edges color={TOKENS.hairlineStrong} />
          </mesh>
          <mesh position={[0, 0.18 + 1.2 + 0.6, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 1.2, 6]} />
            <meshStandardMaterial color={TOKENS.steel} />
          </mesh>
        </>
      ) : (
        <mesh position={[0.4, 0.18 + 0.17, -0.3]} castShadow>
          <boxGeometry args={[0.8, 0.34, 0.6]} />
          <meshStandardMaterial color={TOKENS.surface} />
          <Edges color={TOKENS.hairline} />
        </mesh>
      )}
    </group>
  );
}

// ---------- Streets ----------

function streetLines(radius: number) {
  const lines: number[] = [];
  for (let k = -radius; k <= radius + 1; k++) lines.push((k - 0.5) * PLOT);
  return lines;
}

// Lays out an instanced mesh of flat stripes: [x, z, width along x, length along z].
function useStripes(ref: RefObject<THREE.InstancedMesh | null>, stripes: [number, number, number, number][], y: number) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    stripes.forEach(([x, z, w, l], i) => {
      o.position.set(x, y, z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.scale.set(w, l, 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [ref, stripes, y]);
}

function Streets({ radius }: { radius: number }) {
  const lines = useMemo(() => streetLines(radius), [radius]);
  const len = (2 * radius + 1) * PLOT + STREET;
  const dashes = useRef<THREE.InstancedMesh>(null);
  const zebra = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (const p of lines) {
      for (let s = -len / 2 + 0.5; s < len / 2 - 0.3; s += 0.6) {
        // Skip dashes inside intersections and crosswalks.
        if (lines.some((q) => Math.abs(q - s) < STREET / 2 + 0.5)) continue;
        out.push([p, s, 0.06, 0.3], [s, p, 0.3, 0.06]);
      }
    }
    return out;
  }, [lines, len]);
  const crossings = useMemo(() => {
    const out: [number, number, number, number][] = [];
    const lo = lines[0];
    const hi = lines[lines.length - 1];
    const d = STREET / 2 + 0.18;
    for (const x of lines)
      for (const z of lines)
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          // Only on arms that lead to another intersection.
          if (x + ax > hi || x + ax < lo || z + az > hi || z + az < lo) continue;
          for (let k = -2; k <= 2; k++) {
            const off = k * 0.18;
            if (ax) out.push([x + ax * d, z + off, 0.3, 0.09]);
            else out.push([x + off, z + az * d, 0.09, 0.3]);
          }
        }
    return out;
  }, [lines]);
  useStripes(dashes, spots, 0.025);
  useStripes(zebra, crossings, 0.025);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} receiveShadow>
        <planeGeometry args={[len, len]} />
        <meshStandardMaterial color={ROAD} />
      </mesh>
      <instancedMesh key={`d${spots.length}`} ref={dashes} args={[undefined, undefined, spots.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={TOKENS.canvas} />
      </instancedMesh>
      <instancedMesh key={`z${crossings.length}`} ref={zebra} args={[undefined, undefined, crossings.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={TOKENS.canvas} />
      </instancedMesh>
    </group>
  );
}

function Roads({ roads }: { roads: Road[] }) {
  return (
    <group>
      {roads.map((r) => (
        <RoadStrip key={`${r.x1},${r.z1},${r.x2},${r.z2}`} road={r} />
      ))}
    </group>
  );
}

// A straight two-lane road with lane dashes, drawn along its own z axis.
function RoadStrip({ road }: { road: Road }) {
  const dx = road.x2 - road.x1;
  const dz = road.z2 - road.z1;
  const len = Math.hypot(dx, dz);
  const dashes = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let s = 1.2; s < len - 0.3; s += 0.6) out.push([0, s, 0.06, 0.3]);
    return out;
  }, [len]);
  useStripes(dashes, spots, 0.022);
  return (
    <group position={[road.x1, 0, road.z1]} rotation-y={Math.atan2(dx, dz)}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, len / 2]} receiveShadow>
        <planeGeometry args={[STREET, len]} />
        <meshStandardMaterial color={ROAD} />
      </mesh>
      <instancedMesh key={spots.length} ref={dashes} args={[undefined, undefined, spots.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={TOKENS.canvas} />
      </instancedMesh>
    </group>
  );
}

// Posts stand on every corner from the start; the 30-memory unlock turns the lamps on.
function Streetlights({ radius, lit }: { radius: number; lit: boolean }) {
  const lines = useMemo(() => streetLines(radius), [radius]);
  const posts = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(
    () => lines.flatMap((x) => lines.map((z) => [x + STREET / 2 + 0.14, z + STREET / 2 + 0.14] as const)),
    [lines],
  );
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0.55, z);
      o.updateMatrix();
      posts.current?.setMatrixAt(i, o.matrix);
      o.position.set(x, 1.12, z);
      o.updateMatrix();
      lamps.current?.setMatrixAt(i, o.matrix);
    });
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
    if (lamps.current) lamps.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <group>
      <instancedMesh key={`p${spots.length}`} ref={posts} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.1, 5]} />
        <meshStandardMaterial color={TOKENS.steel} />
      </instancedMesh>
      <instancedMesh key={`l${spots.length}`} ref={lamps} args={[undefined, undefined, spots.length]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial
          color={lit ? TOKENS.brandYellow : TOKENS.canvas}
          emissive={lit ? TOKENS.brandYellow : TOKENS.canvas}
          emissiveIntensity={lit ? 0.5 : 0.1}
        />
      </instancedMesh>
    </group>
  );
}

function Car({ index, radius, reducedMotion }: { index: number; radius: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useGrow(body, { initial: 1.2, late: 1.2 }, reducedMotion, "pop");
  // Outer loop first: it's the one you can see past the buildings.
  const ring = radius - (index % (radius + 1));
  const h = (ring + 0.5) * PLOT;
  const perimeter = 8 * h;
  const phase = ((index * 0.618) % 1) * perimeter;
  const dir = index % 2 === 0 ? 1 : -1;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const s = (((phase + dir * t * 2.2) % perimeter) + perimeter) % perimeter;
    let x: number, z: number, fx: number, fz: number;
    if (s < 2 * h) [x, z, fx, fz] = [h, -h + s, 0, 1];
    else if (s < 4 * h) [x, z, fx, fz] = [h - (s - 2 * h), h, -1, 0];
    else if (s < 6 * h) [x, z, fx, fz] = [-h, h - (s - 4 * h), 0, -1];
    else [x, z, fx, fz] = [-h + (s - 6 * h), -h, 1, 0];
    fx *= dir;
    fz *= dir;
    // Drive on the right.
    ref.current.position.set(x - fz * 0.26, 0.02, z + fx * 0.26);
    ref.current.rotation.y = Math.atan2(fx, fz);
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        <RoundedBox args={[0.34, 0.2, 0.68]} radius={0.06} position={[0, 0.16, 0]} castShadow>
          <meshStandardMaterial color={index % 2 ? TOKENS.surface : TOKENS.canvas} />
        </RoundedBox>
        <mesh position={[0, 0.31, -0.04]} castShadow>
          <boxGeometry args={[0.28, 0.14, 0.34]} />
          <meshStandardMaterial color={TOKENS.canvas} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Parks, trees, woods, clouds ----------

const PARK_TREES: [number, number, number][] = [
  [-0.8, -0.8, 1],
  [0.75, -0.75, 0.85],
  [-0.78, 0.78, 0.95],
  [-0.42, -0.42, 0.6],
  [0.42, -0.45, 0.6],
];

function Park({ plot, reducedMotion }: { plot: Plot; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useGrow(ref, { initial: 0.9, late: 1.1 }, reducedMotion, "pop");
  const lawn = PAD - 0.24;
  return (
    <group position={[plot.x * PLOT, 0, plot.z * PLOT]}>
      <group ref={ref}>
        <mesh position={[0, PAD_H / 2, 0]} receiveShadow>
          <boxGeometry args={[PAD, PAD_H, PAD]} />
          <meshStandardMaterial color={TOKENS.canvas} />
          <Edges color={TOKENS.hairline} />
        </mesh>
        <mesh position={[0, PAD_H + 0.02, 0]} receiveShadow>
          <boxGeometry args={[lawn, 0.04, lawn]} />
          <meshStandardMaterial color={LAWN} />
        </mesh>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} position={[0, PAD_H + 0.045, 0]} rotation-y={r} receiveShadow>
            <boxGeometry args={[lawn, 0.012, 0.28]} />
            <meshStandardMaterial color={TOKENS.surface} />
          </mesh>
        ))}
        <mesh position={[0.72, PAD_H + 0.05, 0.72]} receiveShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.02, 24]} />
          <meshStandardMaterial color={TOKENS.cardTintSky} roughness={0.15} />
        </mesh>
        {PARK_TREES.map(([x, z, s]) => (
          <Tree key={`${x}-${z}`} x={x} z={z} s={s} y={PAD_H + 0.04} color={PARK_LEAF} />
        ))}
      </group>
    </group>
  );
}

// A paved square on downtown plots nobody has built on yet; every other one has a fountain.
function Plaza({ plot }: { plot: Plot }) {
  const fountain = (plot.x + plot.z) % 2 === 0;
  return (
    <Pad plot={plot}>
      <mesh position={[0, PAD_H + 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[1.05, 1.05, 0.012, 32]} />
        <meshStandardMaterial color={TOKENS.surface} />
      </mesh>
      {fountain ? (
        <>
          <mesh position={[0, PAD_H + 0.08, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.48, 0.16, 24]} />
            <meshStandardMaterial color={TOKENS.canvas} />
            <Edges color={TOKENS.hairline} />
          </mesh>
          <mesh position={[0, PAD_H + 0.165, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.01, 24]} />
            <meshStandardMaterial color={TOKENS.cardTintSky} roughness={0.15} />
          </mesh>
          <mesh position={[0, PAD_H + 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.3, 8]} />
            <meshStandardMaterial color={TOKENS.canvas} />
          </mesh>
        </>
      ) : (
        <Tree x={0} z={0} s={1.1} y={PAD_H} color={PARK_LEAF} />
      )}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => <Tree key={`${x}${z}`} x={x * 1.1} z={z * 1.1} s={0.55} y={PAD_H} color={PARK_LEAF} />),
      )}
    </Pad>
  );
}

function Tree({ x, z, s, y = 0, color = LEAF }: { x: number; z: number; s: number; y?: number; color?: string }) {
  return (
    <group position={[x, y, z]} scale={s}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.44, 5]} />
        <meshStandardMaterial color={TRUNK} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  );
}

function Woods({ trees }: { trees: TownLayout["trees"] }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const round = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const roundTrees = trees.filter((_, i) => i % 3 !== 0);
  const pineTrees = trees.filter((_, i) => i % 3 === 0);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const place = (mesh: THREE.InstancedMesh | null, list: typeof trees, y: (s: number) => number) => {
      if (!mesh) return;
      list.forEach((t, i) => {
        o.position.set(t.x, y(t.s), t.z);
        o.rotation.set(0, t.x * 13.7, 0);
        o.scale.setScalar(t.s);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(trunks.current, trees, (s) => 0.22 * s);
    place(round.current, roundTrees, (s) => 0.72 * s);
    place(pines.current, pineTrees, (s) => 0.85 * s);
  }, [trees, roundTrees, pineTrees]);

  return (
    <group>
      <instancedMesh key={`t${trees.length}`} ref={trunks} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.44, 5]} />
        <meshStandardMaterial color={TRUNK} />
      </instancedMesh>
      <instancedMesh key={`r${roundTrees.length}`} ref={round} args={[undefined, undefined, roundTrees.length]} castShadow>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={LEAF} flatShading />
      </instancedMesh>
      <instancedMesh key={`p${pineTrees.length}`} ref={pines} args={[undefined, undefined, pineTrees.length]} castShadow>
        <coneGeometry args={[0.38, 1.1, 6]} />
        <meshStandardMaterial color={LEAF} flatShading />
      </instancedMesh>
    </group>
  );
}

function Clouds({ outer, reducedMotion }: { outer: number; reducedMotion: boolean }) {
  const clouds = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((i) => ({
        x: ((i * 0.37) % 1) * outer * 2 - outer,
        z: ((i * 0.61) % 1) * outer * 2 - outer,
        y: 9 + (i % 3) * 1.5,
        s: 1 + (i % 2) * 0.5,
        speed: 0.35 + (i % 3) * 0.12,
      })),
    [outer],
  );
  return (
    <group>
      {clouds.map((c, i) => (
        <Cloud key={i} {...c} span={outer * 1.3} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}

function Cloud({ x, z, y, s, speed, span, reducedMotion }: { x: number; z: number; y: number; s: number; speed: number; span: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = reducedMotion ? 0 : clock.elapsedTime * speed;
    ref.current.position.x = ((((x + t + span) % (2 * span)) + 2 * span) % (2 * span)) - span;
  });
  return (
    <group ref={ref} position={[x, y, z]} scale={s}>
      {[
        [0, 0, 0, 1],
        [0.9, -0.15, 0.2, 0.75],
        [-0.85, -0.2, -0.1, 0.7],
        [0.2, 0.35, -0.3, 0.65],
      ].map(([cx, cy, cz, r], i) => (
        <mesh key={i} position={[cx, cy, cz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={TOKENS.canvas} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Landmark({ plot, reducedMotion }: { plot: Plot; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useGrow(ref, { initial: 1, late: 1.1 }, reducedMotion);
  return (
    <Pad plot={plot}>
      <group ref={ref} position={[0, PAD_H, 0]}>
        <mesh position={[0, 5.5, 0]} castShadow>
          <boxGeometry args={[1.8, 11, 1.8]} />
          <meshStandardMaterial color={TOKENS.canvas} />
          <Edges color={TOKENS.hairlineStrong} />
        </mesh>
        <mesh position={[0, 11.8, 0]} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[1.25, 1.6, 4]} />
          <meshStandardMaterial color={TOKENS.brandYellow} flatShading />
        </mesh>
      </group>
    </Pad>
  );
}

// ---------- Lodges (solo memories) ----------

function LodgeMesh({
  lodge,
  active,
  onOver,
  onOut,
  onClick,
  reducedMotion,
  showLabel,
}: {
  lodge: Lodge;
  active: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  reducedMotion: boolean;
  showLabel: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useGrow(ref, { initial: 0.7, late: 0.75 }, reducedMotion, "pop", () => sound.playBuild("building"));
  const w = 1.5 + 0.22 * Math.min(lodge.count - 1, 4);
  const d = 1.25;
  const wallH = 0.85;
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-(w + 0.3) / 2, 0);
    s.lineTo((w + 0.3) / 2, 0);
    s.lineTo(0, 0.8);
    s.closePath();
    return s;
  }, [w]);
  const walls = active ? TOKENS.cardTintLavender : TOKENS.canvas;

  return (
    <group
      position={[lodge.x, 0, lodge.z]}
      rotation-y={Math.atan2(-lodge.x, -lodge.z)}
      onPointerOver={(e) => {
        e.stopPropagation();
        onOver();
      }}
      onPointerOut={onOut}
      onClick={onClick}
    >
      <group ref={ref}>
        <mesh position={[0, wallH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, wallH, d]} />
          <meshStandardMaterial color={walls} />
        </mesh>
        <mesh position={[0, wallH, -(d + 0.24) / 2]} castShadow>
          <extrudeGeometry args={[roof, { depth: d + 0.24, bevelEnabled: false }]} />
          <meshStandardMaterial color={towardWhite(friendColor(lodge.colorIndex).hex, 0.8)} flatShading />
        </mesh>
        <mesh position={[w / 2 - 0.35, wallH + 0.45, -0.2]} castShadow>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color={TOKENS.steel} />
        </mesh>
        {[-w / 4, w / 4].map((x) => (
          <mesh key={x} position={[x, 0.5, d / 2 + 0.01]}>
            <boxGeometry args={[0.28, 0.24, 0.02]} />
            <meshStandardMaterial color={TOKENS.brandYellow} emissive={TOKENS.brandYellow} emissiveIntensity={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.26, d / 2 + 0.01]}>
          <boxGeometry args={[0.3, 0.52, 0.02]} />
          <meshStandardMaterial color={TOKENS.cardTintCream} />
        </mesh>
        {lodge.count >= 3 && (
          <mesh position={[w / 2 + 0.45, 0.32, -0.1]} castShadow>
            <boxGeometry args={[0.9, 0.64, 0.9]} />
            <meshStandardMaterial color={walls} />
          </mesh>
        )}
      </group>
      <Label y={2.3} title={`${lodge.displayName}'s lodge`} count={lodge.count} show={showLabel || active} />
    </group>
  );
}
