import * as THREE from "three";
import { buildCharacter, CLOTH, type Character, type HoodieColour } from "./character";

export interface Viewer {
  setOutfit(hoodie: boolean, colour: HoodieColour): void;
  setFace(face?: string | null): void;
  destroy(): void;
}

function radialTexture(inner: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createViewer(
  canvas: HTMLCanvasElement,
  initial: { hoodie: boolean; colour: HoodieColour; reducedMotion: boolean; face?: string | null | undefined },
): Viewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.9, 9.2);
  camera.lookAt(0, 1.45, 0);

  scene.add(new THREE.HemisphereLight(0xb7c9d8, 0x0b0d10, 1.0));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.0);
  key.position.set(3, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5b4a, 1.3);
  rim.position.set(-4, 3, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x4cd0d6, 0.6);
  fill.position.set(5, 2, -4);
  scene.add(fill);

  // stage disc and glow
  const glowTex = radialTexture("rgba(255,90,70,0.55)");
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 6.2),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  scene.add(glow);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.6, 0.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.5, metalness: 0.6 }),
  );
  disc.position.y = -0.06;
  scene.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.025, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xff5b4a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0;
  scene.add(ring);

  const spin = new THREE.Group();
  scene.add(spin);
  let character: Character | null = null;
  let currentFace = initial.face;
  let currentHoodie = initial.hoodie;
  let currentColour = initial.colour;
  const mount = (hoodie: boolean, colour: HoodieColour) => {
    currentHoodie = hoodie; currentColour = colour;
    if (character) {
      spin.remove(character.group);
      character.dispose();
    }
    character = buildCharacter({ hoodie, colour, face: currentFace });
    character.group.scale.setScalar(0.95);
    spin.add(character.group);
    const c = CLOTH[colour];
    (ring.material as THREE.MeshBasicMaterial).color.setHex(c.light);
  };
  mount(initial.hoodie, initial.colour);
  spin.rotation.y = initial.face ? Math.PI : Math.PI * 0.82;

  const fit = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 36 : 30;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();

  let dragging = false;
  let lastX = 0;
  let velocity = 0;
  let idle = 0;
  const down = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    velocity = 0;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    velocity = dx * 0.012;
    spin.rotation.y += velocity;
  };
  const up = () => {
    dragging = false;
    idle = 0;
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  let running = true;
  let last = 0;
  let t = 0;
  let frame = 0;
  const loop = (now: number) => {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    t += dt;
    if (!dragging) {
      idle += dt;
      velocity *= Math.pow(0.04, dt);
      spin.rotation.y += velocity;
      if (!initial.reducedMotion && idle > 0.4) spin.rotation.y += dt * 0.7;
    }
    character?.update(t, 0, 0);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    setOutfit: mount,
    setFace(face) { currentFace = face; mount(currentHoodie, currentColour); spin.rotation.y = face ? Math.PI : Math.PI * 0.82; },
    destroy() {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      character?.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      glowTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
