import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type HoodieColour = "Crimson" | "Navy";

export const CLOTH: Record<HoodieColour, { main: number; light: number; dark: number }> = {
  Crimson: { main: 0xd23a3c, light: 0xea5550, dark: 0x8f1f23 },
  Navy: { main: 0x2f4a73, light: 0x46659a, dark: 0x1d3050 },
};

const SKIN = 0xe2a577;
const HAIR = 0x261d19;
const TEE = 0x8c939b;
const DENIM = 0x232f47;
const SHOE = 0xf1f3f6;

export interface Character {
  group: THREE.Group;
  /** t in seconds, run is 0..1 intensity of the run cycle, lean is -1..1 sideways lean */
  update(t: number, run: number, lean: number): void;
  dispose(): void;
}

function rbox(w: number, h: number, d: number, r: number) {
  return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}

function backLogoTexture(colour: HoodieColour) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 192);
  g.textAlign = "center";
  const fit = (text: string, weight: number, maxW: number, start: number) => {
    let size = start;
    for (; size > 10; size -= 2) {
      g.font = `${weight} ${size}px 'Space Grotesk Variable', 'Arial Black', sans-serif`;
      if (g.measureText(text).width <= maxW) break;
    }
  };
  g.fillStyle = "rgba(255,255,255,0.96)";
  fit("EVERYDAY", 800, 214, 46);
  g.fillText("EVERYDAY", 128, 74);
  fit("STREETWEAR", 800, 214, 46);
  g.fillText("STREETWEAR", 128, 122);
  g.fillStyle = "rgba(255,214,120,1)";
  g.fillRect(56, 136, 144, 5);
  g.fillStyle = "rgba(255,255,255,0.78)";
  fit("EST. 2026 / DEMO BRAND", 600, 200, 17);
  g.fillText("EST. 2026 / DEMO BRAND", 128, 168);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildCharacter(opts: { hoodie: boolean; colour: HoodieColour; face?: HTMLCanvasElement | string | null | undefined }): Character {
  const { hoodie, colour, face } = opts;
  const cloth = CLOTH[colour];
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const mat = (color: number, rough = 0.62, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    disposables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => {
    disposables.push(g);
    return g;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const x = new THREE.Mesh(g, m);
    return x;
  };

  const skin = mat(SKIN, 0.7);
  const hair = mat(HAIR, 0.85);
  const denim = mat(DENIM, 0.8);
  const shoe = mat(SHOE, 0.5);
  const sole = mat(0x1a1d22, 0.9);
  const top = mat(hoodie ? cloth.main : TEE, 0.78);
  const topDark = mat(hoodie ? cloth.dark : 0x6f767e, 0.8);
  const topLight = mat(hoodie ? cloth.light : 0x9fa6ae, 0.75);

  // legs, pivot at hip
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.22, 0.82, 0);
    const leg = mesh(geo(rbox(0.36, 0.82, 0.38, 0.1)), denim);
    leg.position.y = -0.41;
    const foot = mesh(geo(rbox(0.4, 0.22, 0.58, 0.09)), shoe);
    foot.position.set(0, -0.76, -0.08);
    const bottom = mesh(geo(rbox(0.41, 0.07, 0.6, 0.03)), sole);
    bottom.position.set(0, -0.86, -0.08);
    hip.add(leg, foot, bottom);
    group.add(hip);
    legs.push(hip);
  }

  // torso
  const torsoW = hoodie ? 1.02 : 0.94;
  const torsoD = hoodie ? 0.7 : 0.58;
  const torso = mesh(geo(rbox(torsoW, 1.0, torsoD, 0.2)), top);
  torso.position.y = 1.36;
  group.add(torso);

  const waist = mesh(geo(rbox(torsoW + 0.02, 0.14, torsoD + 0.02, 0.05)), topDark);
  waist.position.y = 0.92;
  group.add(waist);

  if (hoodie) {
    const pocket = mesh(geo(rbox(0.62, 0.3, 0.06, 0.05)), topLight);
    pocket.position.set(0, 1.06, -torsoD / 2 - 0.015);
    group.add(pocket);

    const logo = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(0.7, 0.525)),
      (() => {
        const tex = backLogoTexture(colour);
        disposables.push(tex);
        const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        disposables.push(m);
        return m;
      })(),
    );
    logo.position.set(0, 1.42, torsoD / 2 + 0.006);
    group.add(logo);

    // hood: collar ring plus the bunched hood behind the head
    const collar = mesh(geo(new THREE.TorusGeometry(0.36, 0.13, 10, 24)), topDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.88, 0.02);
    group.add(collar);
    const hoodBack = mesh(geo(new THREE.SphereGeometry(0.5, 20, 14)), top);
    hoodBack.scale.set(1.02, 0.84, 0.62);
    hoodBack.position.set(0, 1.98, 0.3);
    group.add(hoodBack);
    const hoodEdge = mesh(geo(new THREE.TorusGeometry(0.38, 0.06, 8, 24, Math.PI * 1.3)), topLight);
    hoodEdge.position.set(0, 2.0, 0.17);
    hoodEdge.rotation.set(0.05, 0, Math.PI * 0.85 - Math.PI * 0.15);
    group.add(hoodEdge);

    // drawstrings
    const string = mat(0xf3f3f1, 0.6);
    for (const side of [-1, 1]) {
      const s = mesh(geo(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 6)), string);
      s.position.set(side * 0.14, 1.62, -torsoD / 2 - 0.02);
      group.add(s);
      const tip = mesh(geo(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 8)), topDark);
      tip.position.set(side * 0.14, 1.36, -torsoD / 2 - 0.02);
      group.add(tip);
    }
  } else {
    const collar = mesh(geo(new THREE.TorusGeometry(0.2, 0.05, 8, 18)), topDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.84, -0.02);
    group.add(collar);
  }

  // arms, pivot at shoulder
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (torsoW / 2 + 0.14), 1.7, 0);
    const upper = mesh(geo(rbox(0.3, 0.56, 0.32, 0.1)), top);
    upper.position.y = -0.26;
    const lower = mesh(geo(rbox(0.27, 0.46, 0.29, 0.09)), hoodie ? top : skin);
    lower.position.y = -0.7;
    const cuff = hoodie ? mesh(geo(rbox(0.3, 0.1, 0.32, 0.04)), topDark) : null;
    if (cuff) cuff.position.y = -0.9;
    const hand = mesh(geo(new THREE.SphereGeometry(0.15, 12, 10)), skin);
    hand.position.y = -1.02;
    shoulder.add(upper, lower, hand);
    if (cuff) shoulder.add(cuff);
    group.add(shoulder);
    arms.push(shoulder);
  }

  // head
  const head = new THREE.Group();
  head.position.y = 2.28;
  const skull = mesh(geo(rbox(0.74, 0.74, 0.72, 0.24)), skin);
  const hairTop = mesh(geo(rbox(0.8, 0.3, 0.78, 0.13)), hair);
  hairTop.position.set(0, 0.3, 0.03);
  const hairBack = mesh(geo(rbox(0.8, 0.52, 0.22, 0.1)), hair);
  hairBack.position.set(0, 0.1, 0.3);
  const hairFront = mesh(geo(rbox(0.8, 0.14, 0.12, 0.05)), hair);
  hairFront.position.set(0, 0.34, -0.34);
  const eyeMat = mat(0x14161a, 0.4);
  const eyeL = mesh(geo(new THREE.SphereGeometry(0.058, 10, 8)), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.17, 0.02, -0.36);
  eyeR.position.set(0.17, 0.02, -0.36);
  const mouth = mesh(geo(rbox(0.16, 0.04, 0.03, 0.015)), mat(0x7a3b30, 0.6));
  mouth.position.set(0, -0.2, -0.36);
  const earL = mesh(geo(new THREE.SphereGeometry(0.09, 8, 8)), skin);
  const earR = earL.clone();
  earL.position.set(-0.38, -0.02, 0);
  earR.position.set(0.38, -0.02, 0);
  head.add(skull, hairTop, hairBack, hairFront, eyeL, eyeR, mouth, earL, earR);
  if (face) {
    eyeL.visible = eyeR.visible = mouth.visible = false;
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = faceCanvas.height = 256;
    const faceContext = faceCanvas.getContext("2d");
    const texture = new THREE.CanvasTexture(faceCanvas);
    if (typeof face === "string") {
      const image = new Image();
      image.onload = () => {
        faceContext?.drawImage(image, 0, 0, 256, 256);
        texture.needsUpdate = true;
      };
      image.src = face;
    } else faceContext?.drawImage(face, 0, 0, 256, 256);
    texture.colorSpace = THREE.SRGBColorSpace;
    disposables.push(texture);
    const faceMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    disposables.push(faceMat);
    const faceMesh = mesh(geo(new THREE.PlaneGeometry(0.62, 0.62)), faceMat);
    faceMesh.position.set(0, -0.01, -0.371);
    head.add(faceMesh);
  }
  group.add(head);

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.frustumCulled = true;
  });

  return {
    group,
    update(t, run, lean) {
      const swing = Math.sin(t * 11) * 0.95 * run;
      legs[0]!.rotation.x = swing;
      legs[1]!.rotation.x = -swing;
      arms[0]!.rotation.x = -swing * 0.9;
      arms[1]!.rotation.x = swing * 0.9;
      const idle = (1 - run) * Math.sin(t * 2) * 0.03;
      arms[0]!.rotation.z = 0.08 + idle;
      arms[1]!.rotation.z = -0.08 - idle;
      group.position.y = Math.abs(Math.sin(t * 11)) * 0.13 * run + (1 - run) * Math.sin(t * 2) * 0.012;
      group.rotation.z = -lean * 0.16;
      group.rotation.y = lean * 0.22;
      head.rotation.z = lean * 0.06;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
