import { useEffect, useRef, useState } from "react";
import type { Colour } from "@/config";
import type { Viewer } from "@/game3d/viewer";
import { Avatar } from "./art";

/**
 * Turntable of the character in the hoodie (or the plain tee). Drag to spin.
 * Falls back to the flat SVG avatar while three.js loads or if WebGL is missing.
 */
export function Viewer3D({
  colour,
  hoodie = true,
  className = "",
  face,
}: {
  colour: Colour;
  hoodie?: boolean;
  className?: string;
  face?: string | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const initial = useRef({ colour, hoodie, face });
  initial.current = { colour, hoodie, face };
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const node = canvas.current;
    if (!node) return;
    import("@/game3d/viewer")
      .then(({ createViewer }) => {
        if (cancelled) return;
        try {
          viewer.current = createViewer(node, {
            hoodie: initial.current.hoodie,
            colour: initial.current.colour,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            face: initial.current.face,
          });
          setState("ready");
        } catch {
          setState("failed");
        }
      })
      .catch(() => setState("failed"));
    return () => {
      cancelled = true;
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    viewer.current?.setOutfit(hoodie, colour);
  }, [colour, hoodie]);
  useEffect(() => { viewer.current?.setFace(face); }, [face]);

  return (
    <div className={`viewer3d ${className}`}>
      {state !== "ready" && (
        <div className="viewer3d-fallback">
          <Avatar colour={colour} hoodie={hoodie} />
        </div>
      )}
      <canvas
        ref={canvas}
        className="viewer3d-canvas"
        data-ready={state === "ready"}
        aria-label={`3D preview of the character wearing the ${colour} hoodie. Drag to rotate.`}
      />
      {state === "ready" && <span className="viewer3d-hint">Drag to rotate</span>}
    </div>
  );
}
