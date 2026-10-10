import * as THREE from "three";
import { buildCharacter, type HoodieColour } from "./character";
import { music, sfx, vibrate } from "./audio";

export interface RunnerStats {
  phase: "countdown" | "run" | "end";
  countdown: number;
  catches: number;
  hearts: number;
  seconds: number;
  combo: number;
  endedBy: "timer" | "hearts" | null;
}

export interface RunnerOptions {
  canvas: HTMLCanvasElement;
  hoodie: boolean;
  colour: HoodieColour;
  face?: string | null;
  seconds: number;
  hearts: number;
  fallRamp: number;
  reducedMotion: boolean;
  onStats(stats: RunnerStats): void;
  onHit(): void;
  onCatch(): void;
  onEnd(result: { endedBy: "timer" | "hearts"; catches: number; duration: number }): void;
}

export interface Runner {
  destroy(): void;
}

const ROAD_HALF = 2.3;
const PLAYER_LIMIT = 1.95;
const BASE_SPEED = 17;
const SPAWN_Z = -62;
const ROAD_TILE = 10;
const GRID_TILE = 8;
const COUNTDOWN = 3;

function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const radial = (inner: string, outer = "rgba(0,0,0,0)", size = 128) =>
  canvasTexture(size, size, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

interface Obj {
  kind: "coin" | "spike";
  group: THREE.Group;
  glow: THREE.Sprite;
  ring?: THREE.Mesh;
  x: number;
  z: number;
  seed: number;
  active: boolean;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
}

interface Floater {
  sprite: THREE.Sprite;
  life: number;
}

export function createRunner(opts: RunnerOptions): Runner {
  const { canvas } = opts;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T) => {
    disposables.push(d);
    return d;
  };

  const scene = new THREE.Scene();
  const horizon = new THREE.Color(0x10181b);
  scene.background = track(
    canvasTexture(8, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#04060a");
      grad.addColorStop(0.45, "#0b1317");
      grad.addColorStop(0.62, "#1b2b30");
      grad.addColorStop(1, "#10181b");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }),
  );
  scene.fog = new THREE.Fog(horizon, 18, 62);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
  let baseFov = 55;
  let camBaseY = 5;

  // lights
  scene.add(new THREE.HemisphereLight(0xa6bccd, 0x0b0d10, 0.95));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.7);
  key.position.set(4, 10, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5b4a, 0.9);
  rim.position.set(-5, 3, -8);
  scene.add(rim);

  // sun glow on the horizon
  const sunMat = track(
    new THREE.SpriteMaterial({
      map: track(radial("rgba(255,98,72,0.95)", "rgba(255,98,72,0)", 256)),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
      fog: false,
    }),
  );
  const sun = new THREE.Sprite(sunMat);
  sun.scale.set(70, 40, 1);
  sun.position.set(0, 9, -100);
  scene.add(sun);

  // road
  const roadTex = track(
    canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#14181c";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2200; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = "rgba(255,255,255,0.4)";
      for (const f of [1 / 3, 2 / 3]) g.fillRect(w * f - 3, h * 0.08, 6, h * 0.4);
      g.fillStyle = "#e5474a";
      g.fillRect(w * 0.012, 0, 9, h);
      g.fillRect(w * 0.988 - 9, 0, 9, h);
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.fillRect(w * 0.012 + 12, 0, 3, h);
      g.fillRect(w * 0.988 - 15, 0, 3, h);
    }),
  );
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 130 / ROAD_TILE);
  const road = new THREE.Mesh(
    track(new THREE.PlaneGeometry(ROAD_HALF * 2, 130)),
    track(new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05 })),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -55);
  scene.add(road);

  const gridTex = track(
    canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = "#090c0f";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(76,208,214,0.22)";
      g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo((i * w) / 4, 0);
        g.lineTo((i * w) / 4, h);
        g.stroke();
        g.beginPath();
        g.moveTo(0, (i * h) / 4);
        g.lineTo(w, (i * h) / 4);
        g.stroke();
      }
    }),
  );
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(60 / GRID_TILE, 140 / GRID_TILE);
  const ground = new THREE.Mesh(
    track(new THREE.PlaneGeometry(60, 140)),
    track(new THREE.MeshBasicMaterial({ map: gridTex })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.03, -60);
  scene.add(ground);

  // roadside towers with neon strips
  const towerGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const towerMat = track(new THREE.MeshStandardMaterial({ color: 0x151b21, roughness: 0.9 }));
  const redStrip = track(new THREE.MeshBasicMaterial({ color: 0xff4d47 }));
  const tealStrip = track(new THREE.MeshBasicMaterial({ color: 0x4cd0d6 }));
  interface Tower {
    group: THREE.Group;
    strip: THREE.Mesh;
    side: number;
  }
  const towers: Tower[] = [];
  const placeTower = (t: Tower, z: number) => {
    const h = 3 + Math.random() * 9;
    const w = 1.6 + Math.random() * 1.6;
    t.group.position.set(t.side * (ROAD_HALF + 1.6 + w / 2 + Math.random() * 3.5), h / 2, z);
    t.group.scale.set(w, h, 1.8 + Math.random() * 1.6);
    t.strip.position.set(-t.side * 0.505, (Math.random() - 0.5) * 0.7, 0);
    t.strip.scale.set(0.02, 0.04 + Math.random() * 0.05, 1.01);
  };
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const group = new THREE.Group();
    const body = new THREE.Mesh(towerGeo, towerMat);
    const strip = new THREE.Mesh(towerGeo, side < 0 ? redStrip : tealStrip);
    group.add(body, strip);
    scene.add(group);
    const tower = { group, strip, side };
    placeTower(tower, 8 - (i >> 1) * 8.5 - Math.random() * 3);
    towers.push(tower);
  }

  // blob shadow
  const shadowTex = track(radial("rgba(0,0,0,0.75)", "rgba(0,0,0,0)"));
  const shadowGeo = track(new THREE.PlaneGeometry(1, 1));
  const makeShadow = (size: number, opacity: number) => {
    const m = new THREE.Mesh(
      shadowGeo,
      track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false })),
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.set(size, size, 1);
    m.position.y = 0.025;
    return m;
  };

  // player
  const player = buildCharacter({ hoodie: opts.hoodie, colour: opts.colour, face: opts.face });
  disposables.push(player);
  player.group.scale.setScalar(0.92);
  scene.add(player.group);
  const playerShadow = makeShadow(2.1, 0.8);
  scene.add(playerShadow);

  // pooled coins
  const coinBodyGeo = track(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 28));
  coinBodyGeo.rotateX(Math.PI / 2);
  const coinRimGeo = track(new THREE.TorusGeometry(0.42, 0.05, 8, 28));
  const coinFaceGeo = track(new THREE.CircleGeometry(0.33, 28));
  const gold = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5b83d,
      metalness: 0.78,
      roughness: 0.28,
      emissive: 0x7a4a00,
      emissiveIntensity: 0.6,
    }),
  );
  const goldRim = track(
    new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 0.85, roughness: 0.22, emissive: 0x8a5a00, emissiveIntensity: 0.5 }),
  );
  const faceTex = track(
    canvasTexture(128, 128, (g, w, h) => {
      g.strokeStyle = "#8a5b00";
      g.lineWidth = 7;
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "#8a5b00";
      g.font = "800 72px 'Space Grotesk Variable', Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("C", w / 2, h / 2 + 4);
    }),
  );
  const faceMat = track(new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  const coinGlowTex = track(radial("rgba(255,205,90,0.85)", "rgba(255,205,90,0)"));
  const redGlowTex = track(radial("rgba(255,60,50,0.9)", "rgba(255,60,50,0)"));

  const pool: Obj[] = [];
  for (let i = 0; i < 40; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(coinBodyGeo, gold);
    const rimMesh = new THREE.Mesh(coinRimGeo, goldRim);
    const f1 = new THREE.Mesh(coinFaceGeo, faceMat);
    f1.position.z = 0.066;
    const f2 = new THREE.Mesh(coinFaceGeo, faceMat);
    f2.position.z = -0.066;
    f2.rotation.y = Math.PI;
    const glow = new THREE.Sprite(
      track(
        new THREE.SpriteMaterial({
          map: coinGlowTex,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );
    glow.scale.setScalar(1.9);
    group.add(body, rimMesh, f1, f2, glow);
    group.visible = false;
    scene.add(group);
    pool.push({ kind: "coin", group, glow, x: 0, z: 0, seed: Math.random() * 6, active: false });
  }

  const coneGeo = track(new THREE.ConeGeometry(0.25, 0.95, 6));
  const baseGeo = track(new THREE.CylinderGeometry(0.62, 0.72, 0.14, 6));
  const ringGeo = track(new THREE.RingGeometry(0.7, 0.92, 28));
  const coneMat = track(
    new THREE.MeshStandardMaterial({ color: 0x4a1212, emissive: 0xff2f2a, emissiveIntensity: 0.95, roughness: 0.4, metalness: 0.3 }),
  );
  const baseMat = track(new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.6, metalness: 0.5 }));
  for (let i = 0; i < 12; i++) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.07;
    const c1 = new THREE.Mesh(coneGeo, coneMat);
    c1.position.set(0, 0.6, 0);
    const c2 = new THREE.Mesh(coneGeo, coneMat);
    c2.position.set(-0.3, 0.45, 0.14);
    c2.scale.set(0.85, 0.75, 0.85);
    const c3 = new THREE.Mesh(coneGeo, coneMat);
    c3.position.set(0.3, 0.45, 0.14);
    c3.scale.set(0.85, 0.75, 0.85);
    const ring = new THREE.Mesh(
      ringGeo,
      track(new THREE.MeshBasicMaterial({ color: 0xff3b35, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const glow = new THREE.Sprite(
      track(new THREE.SpriteMaterial({ map: redGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })),
    );
    glow.scale.set(2.8, 2.2, 1);
    glow.position.y = 0.6;
    group.add(base, c1, c2, c3, ring, glow);
    group.visible = false;
    scene.add(group);
    pool.push({ kind: "spike", group, glow, ring, x: 0, z: 0, seed: Math.random() * 6, active: false });
  }

  // particles
  const partGeo = track(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  const particles: Particle[] = [];
  for (let i = 0; i < 90; i++) {
    const mesh = new THREE.Mesh(
      partGeo,
      track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })),
    );
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }
  let partCursor = 0;
  const burst = (x: number, y: number, z: number, color: number, n: number, speed: number) => {
    const count = opts.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const p = particles[partCursor++ % particles.length]!;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random();
      p.vx = Math.cos(a) * speed * (0.4 + Math.random());
      p.vz = Math.sin(a) * speed * (0.4 + Math.random()) * 0.6;
      p.vy = up * speed;
      p.life = p.max = 0.45 + Math.random() * 0.3;
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.9);
    }
  };

  // floating +5
  const plusTex = track(
    canvasTexture(128, 64, (g, w, h) => {
      g.font = "800 46px 'Space Grotesk Variable', Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 8;
      g.strokeStyle = "rgba(10,12,15,0.9)";
      g.strokeText("+5", w / 2, h / 2);
      g.fillStyle = "#ffd36b";
      g.fillText("+5", w / 2, h / 2);
    }),
  );
  const floaters: Floater[] = [];
  for (let i = 0; i < 8; i++) {
    const sprite = new THREE.Sprite(
      track(new THREE.SpriteMaterial({ map: plusTex, transparent: true, depthWrite: false, fog: false })),
    );
    sprite.scale.set(1.5, 0.75, 1);
    sprite.visible = false;
    scene.add(sprite);
    floaters.push({ sprite, life: 0 });
  }
  let floatCursor = 0;

  // size and camera fit
  const fit = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    baseFov = 55;
    camera.fov = baseFov;
    const need = (ROAD_HALF + 0.75) / (Math.tan((baseFov * Math.PI) / 360) * aspect);
    const dist = Math.min(Math.max(need, 8.5), 18);
    camBaseY = 2.1 + dist * 0.42;
    camera.position.set(0, camBaseY, dist * 0.93);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();

  // input
  let target = 0;
  let px = 0;
  const keys = new Set<string>();
  const toWorld = (clientX: number) => {
    const r = canvas.getBoundingClientRect();
    const u = (clientX - r.left) / Math.max(1, r.width);
    return Math.max(-PLAYER_LIMIT, Math.min(PLAYER_LIMIT, (u - 0.5) * 2 * (ROAD_HALF + 0.55)));
  };
  const onPointer = (e: PointerEvent) => {
    target = toWorld(e.clientX);
    if (e.type === "pointerdown") canvas.setPointerCapture(e.pointerId);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "a" || e.key === "d") {
      e.preventDefault();
      keys.add(e.key);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key);
  const onBlur = () => keys.clear();
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointermove", onPointer);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // game state
  let phase: RunnerStats["phase"] = "countdown";
  let countdown = COUNTDOWN;
  let lastCount = COUNTDOWN + 1;
  let runTime = 0;
  let endTimer = 0;
  let endedBy: "timer" | "hearts" | null = null;
  let endFired = false;
  let catches = 0;
  let hearts = opts.hearts;
  let combo = 0;
  let spawnTimer = 0.2;
  let streamX = 0;
  let speedFactor = 1;
  let shake = 0;
  let fovKick = 0;
  let lastSecond = -1;
  let t = 0;
  let last = 0;
  let frame = 0;
  let running = true;
  let lastEmit = "";

  const emit = () => {
    const seconds = Math.max(0, Math.ceil(opts.seconds - runTime));
    const cd = Math.max(0, Math.ceil(countdown));
    const sig = `${phase}|${cd}|${catches}|${hearts}|${seconds}|${combo}`;
    if (sig === lastEmit) return;
    lastEmit = sig;
    opts.onStats({ phase, countdown: cd, catches, hearts, seconds, combo, endedBy });
  };

  const spawn = () => {
    const wantSpike = Math.random() < 0.14;
    const obj = pool.find((o) => !o.active && o.kind === (wantSpike ? "spike" : "coin"));
    if (!obj) return;
    if (wantSpike) {
      obj.x = (Math.random() * 2 - 1) * PLAYER_LIMIT;
    } else {
      streamX += (Math.random() * 2 - 1) * 1.15;
      streamX = Math.max(-PLAYER_LIMIT + 0.1, Math.min(PLAYER_LIMIT - 0.1, streamX));
      obj.x = streamX;
    }
    obj.z = SPAWN_Z;
    obj.active = true;
    obj.group.visible = true;
  };

  const endRun = (by: "timer" | "hearts") => {
    if (phase === "end") return;
    phase = "end";
    endedBy = by;
    music.stop();
    sfx.end(by === "timer");
    if (by === "hearts") vibrate(60);
  };

  const loop = (now: number) => {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    t += dt;

    // phases
    if (phase === "countdown") {
      countdown -= dt;
      const whole = Math.ceil(countdown);
      if (whole !== lastCount && whole > 0) {
        lastCount = whole;
        sfx.beep(false);
      }
      if (countdown <= 0) {
        phase = "run";
        sfx.beep(true);
        music.start();
      }
    } else if (phase === "run") {
      runTime += dt;
      const remaining = Math.ceil(opts.seconds - runTime);
      if (remaining !== lastSecond) {
        lastSecond = remaining;
        if (remaining > 0 && remaining <= 5) sfx.tick();
      }
      if (hearts <= 0) endRun("hearts");
      else if (runTime >= opts.seconds) endRun("timer");
    } else {
      endTimer += dt;
      speedFactor += (0.15 - speedFactor) * Math.min(1, dt * 4);
      if (endTimer > 0.95 && !endFired && endedBy) {
        endFired = true;
        opts.onEnd({ endedBy, catches, duration: Math.min(runTime, opts.seconds) });
      }
    }

    const progress = Math.min(runTime / opts.seconds, 1);
    const speed = BASE_SPEED * (1 + opts.fallRamp * progress) * speedFactor;

    // input and player
    if (keys.has("ArrowLeft") || keys.has("a")) target -= 6.5 * dt;
    if (keys.has("ArrowRight") || keys.has("d")) target += 6.5 * dt;
    target = Math.max(-PLAYER_LIMIT, Math.min(PLAYER_LIMIT, target));
    const prev = px;
    px += (target - px) * Math.min(1, dt * 15);
    const lean = Math.max(-1, Math.min(1, (target - px) * 1.4 + (px - prev) * 18));
    player.group.position.x = px;
    player.update(t, phase === "end" ? 0.4 : 1, lean);
    playerShadow.position.x = px;

    // scrolling world
    roadTex.offset.y += (speed * dt) / ROAD_TILE;
    gridTex.offset.y += (speed * dt) / GRID_TILE;
    for (const tw of towers) {
      tw.group.position.z += speed * dt;
      if (tw.group.position.z > 14) placeTower(tw, tw.group.position.z - 112);
    }

    // spawning
    if (phase !== "end") {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = 0.42 + Math.random() * 0.28;
      }
    }

    // objects
    for (const o of pool) {
      if (!o.active) continue;
      o.z += speed * dt;
      o.group.position.set(o.x, o.kind === "coin" ? 1.0 + Math.sin(t * 3 + o.seed) * 0.08 : 0, o.z);
      if (o.kind === "coin") {
        o.group.rotation.y = t * 4.2 + o.seed;
      } else if (o.ring) {
        (o.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 8 + o.seed) * 0.25;
        o.group.rotation.y = Math.sin(t * 2 + o.seed) * 0.15;
      }
      if (phase === "run") {
        const dx = Math.abs(o.x - px);
        const dz = Math.abs(o.z);
        if (o.kind === "coin" && dx < 0.85 && dz < 0.9) {
          o.active = false;
          o.group.visible = false;
          catches++;
          combo++;
          sfx.coin(combo);
          vibrate(8);
          burst(o.x, 1.1, o.z, 0xffcf5a, 12, 3.4);
          const f = floaters[floatCursor++ % floaters.length]!;
          f.sprite.visible = true;
          f.sprite.position.set(o.x, 2.2, o.z);
          (f.sprite.material as THREE.SpriteMaterial).opacity = 1;
          f.life = 0.7;
          if (!opts.reducedMotion) fovKick = Math.min(fovKick + 1.6, 4);
          opts.onCatch();
          continue;
        }
        if (o.kind === "spike" && dx < 0.72 && dz < 0.85) {
          o.active = false;
          o.group.visible = false;
          hearts--;
          combo = 0;
          sfx.hit();
          vibrate(40);
          burst(o.x, 0.8, o.z, 0xff4a40, 22, 5);
          burst(o.x, 0.8, o.z, 0xffffff, 8, 4);
          if (!opts.reducedMotion) shake = 0.55;
          opts.onHit();
          continue;
        }
      }
      if (o.z > 3.2) {
        if (o.kind === "coin" && phase === "run") combo = 0;
        o.active = false;
        o.group.visible = false;
      }
    }

    // particles and floaters
    for (const p of particles) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 11 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += (p.vz + speed * 0.6) * dt;
      p.mesh.rotation.x += dt * 9;
      p.mesh.rotation.y += dt * 7;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (p.life / p.max) * 1.6);
    }
    for (const f of floaters) {
      if (!f.sprite.visible) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.sprite.visible = false;
        continue;
      }
      f.sprite.position.y += dt * 2.1;
      f.sprite.position.z += speed * dt * 0.5;
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, f.life / 0.35);
    }

    // camera
    shake = Math.max(0, shake - dt * 2.6);
    fovKick = Math.max(0, fovKick - dt * 9);
    const sx = (Math.random() - 0.5) * shake * 0.5;
    const sy = (Math.random() - 0.5) * shake * 0.5;
    camera.fov = baseFov + fovKick;
    camera.updateProjectionMatrix();
    camera.position.x = px * 0.42 + sx;
    camera.position.y = camBaseY + sy;
    camera.lookAt(px * 0.18, 0.95, -6.5);

    renderer.render(scene, camera);
    emit();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(frame);
      music.stop();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onPointer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
