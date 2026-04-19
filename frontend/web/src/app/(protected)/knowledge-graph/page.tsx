"use client";

import { useEffect, useRef, useState } from "react";
import { knowledgeGraphApi } from "@/lib/api";
import { Network, Loader2, RefreshCw } from "lucide-react";

interface Node { id: string; type: string; label: string; subtype?: string; }
interface Edge { source: string; target: string; relation: string; }
interface Graph { nodes: Node[]; edges: Edge[]; nodeCount: number; edgeCount: number; byType: Record<string, number>; }

const TYPE_COLORS: Record<string, string> = {
  document: "#3b82f6",
  user: "#10b981",
  project: "#f59e0b",
  tag: "#8b5cf6",
  "entity:dates": "#ec4899",
  "entity:emails": "#06b6d4",
  "entity:vendors": "#ef4444",
  "entity:amounts": "#22c55e",
  "entity:taxIds": "#a855f7",
  "entity:invoiceNumbers": "#f97316",
  "entity:people": "#14b8a6",
};

function colorFor(type: string) {
  return TYPE_COLORS[type] || (type.startsWith("entity:") ? "#94a3b8" : "#64748b");
}

interface PositionedNode extends Node { x: number; y: number; vx: number; vy: number; }

export default function KnowledgeGraphPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxNodes, setMaxNodes] = useState(150);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Map<string, PositionedNode>>(new Map());
  const animRef = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await knowledgeGraphApi.graph({ maxNodes });
      const g: Graph = r.data?.data || r.data;
      setGraph(g);
      // initialize positions
      const W = 1100, H = 650;
      const newPos = new Map<string, PositionedNode>();
      g.nodes.forEach((n) => {
        const old = positionsRef.current.get(n.id);
        newPos.set(n.id, old ?? {
          ...n,
          x: W / 2 + (Math.random() - 0.5) * 400,
          y: H / 2 + (Math.random() - 0.5) * 400,
          vx: 0, vy: 0,
        });
      });
      positionsRef.current = newPos;
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load graph");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Force-directed simulation + render
  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    const tick = () => {
      const nodes = Array.from(positionsRef.current.values());
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.1;
          const f = 800 / d2;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      // Attraction (edges)
      graph.edges.forEach((e) => {
        const a = positionsRef.current.get(e.source);
        const b = positionsRef.current.get(e.target);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const f = (d - 90) * 0.02;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      });
      // Center pull + damping + apply
      nodes.forEach((n) => {
        n.vx += (W / 2 - n.x) * 0.001;
        n.vy += (H / 2 - n.y) * 0.001;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(20, Math.min(W - 20, n.x));
        n.y = Math.max(20, Math.min(H - 20, n.y));
      });

      // Draw
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.lineWidth = 1;
      graph.edges.forEach((e) => {
        const a = positionsRef.current.get(e.source);
        const b = positionsRef.current.get(e.target);
        if (!a || !b) return;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      nodes.forEach((n) => {
        const r = n.type === "document" ? 8 : n.type === "project" ? 10 : 6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = colorFor(n.type);
        ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
        if (n === hoveredNode || n.type === "project") {
          ctx.fillStyle = "#0f172a";
          ctx.font = "11px system-ui";
          ctx.fillText(n.label.slice(0, 28), n.x + r + 4, n.y + 4);
        }
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [graph, hoveredNode]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    let found: Node | null = null;
    for (const n of positionsRef.current.values()) {
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy < 100) { found = n; break; }
    }
    setHoveredNode(found);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Network className="w-6 h-6 text-blue-600" /> Knowledge Graph Insights
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Discover hidden connections across documents, people, projects, and extracted entities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={maxNodes}
            onChange={(e) => setMaxNodes(Number(e.target.value))}
            className="border rounded-md px-2 py-1 text-sm"
          >
            <option value={50}>50 nodes</option>
            <option value={150}>150 nodes</option>
            <option value={200}>200 nodes</option>
          </select>
          <button onClick={load} className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {graph && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(graph.byType).map(([type, count]) => (
            <span key={type} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-100">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorFor(type) }} />
              {type}: {count}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white border rounded-lg shadow-sm relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}
        {error && <div className="p-4 text-red-600 text-sm">{error}</div>}
        <canvas
          ref={canvasRef}
          width={1100}
          height={650}
          onMouseMove={onMove}
          className="w-full cursor-crosshair"
          style={{ aspectRatio: "1100/650" }}
        />
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 bg-slate-900 text-white text-xs px-3 py-2 rounded-md shadow-lg max-w-md">
            <div className="font-medium">{hoveredNode.label}</div>
            <div className="text-slate-300">{hoveredNode.type}{hoveredNode.subtype ? ` · ${hoveredNode.subtype}` : ""}</div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Each node is a real entity from your repository. Edges represent: authored, belongs_to (project), tagged, mentions (extracted entity).
      </p>
    </div>
  );
}
