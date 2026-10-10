import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { removeFace, setFace } from "@/lib/trial-face";
import { track } from "@/analytics";

export function FaceStep({ face, onChange, skippable = false }: { face: string | null; onChange: (v: string | null) => void; skippable?: boolean }) {
  const [error, setError] = useState("");
  const [source, setSource] = useState<{ image: HTMLImageElement; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  function onFile(file?: File) {
    setError("");
    if (!file) return;
    if (source) URL.revokeObjectURL(source.url);
    setSource(null);
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Choose an image under 8 MB."); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setSource({ image: img, url }); setOffset({ x: 0, y: 0 }); };
    img.onerror = () => { URL.revokeObjectURL(url); setError("This image could not be opened."); };
    img.src = url;
  }
  function save() {
    if (!source || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 256);
    ctx.save(); ctx.beginPath(); ctx.ellipse(128, 128, 124, 124, 0, 0, Math.PI * 2); ctx.clip();
    const scale = Math.max(256 / source.image.width, 256 / source.image.height) * zoom;
    const w = source.image.width * scale, h = source.image.height * scale;
    ctx.drawImage(source.image, (256 - w) / 2 + offset.x, (256 - h) / 2 + offset.y, w, h);
    ctx.restore();
    const value = canvas.toDataURL("image/jpeg", 0.8);
    setFace(value); onChange(value); track("face_added", { source: "camera_or_file" }); setSource(null);
  }
  function remove() { removeFace(); onChange(null); setSource(null); track("face_removed"); }
  return <section className="face-step">
    <h3>Add your face</h3>
    <p className="subcopy">Your photo stays on this device. It is never uploaded.</p>
    <p className="subcopy">Preview mockup. Real AI try-on is a future step.</p>
    <label className="face-upload" htmlFor="trial-face-upload">
      <span>{face ? "Change photo" : "Choose a photo"}</span>
      <small>Tap here to select an image from your device</small>
      <input id="trial-face-upload" className="sr-only" type="file" accept="image/*" capture="user" onChange={(e) => onFile(e.currentTarget.files?.[0])} />
    </label>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {source && <div>
      <p className="subcopy">Drag and zoom, then use this photo to update the hoodie preview.</p>
      <div className="face-crop" onPointerDown={(e) => { drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }}>
        <img src={source.url} alt="Crop preview" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} />
      </div>
      <label>Zoom <input type="range" min="1" max="2" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
      <Button type="button" onClick={save}>Use this photo</Button>
    </div>}
    <canvas ref={canvasRef} hidden />
    {face && <Button type="button" variant="outline" onClick={remove}>Remove my photo</Button>}
    {skippable && !face && <Button type="button" variant="ghost" onClick={() => onChange(null)}>Skip, use default face</Button>}
  </section>;
}
