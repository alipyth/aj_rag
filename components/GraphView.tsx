
import React, { useEffect, useRef, useState } from 'react';
import { KnowledgeGraph, GraphNode, GraphLink, RetrievalContext } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Share2, MousePointer2, GitBranch } from 'lucide-react';

interface GraphViewProps {
  graphData?: KnowledgeGraph; // Full Graph
  onNodeClick: (id: string, type: string) => void;
  // Roadmap Props
  focusQuery?: string;
  focusContext?: RetrievalContext[];
}

// Internal simulation types
interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  fixed?: boolean;
}

export const GraphView: React.FC<GraphViewProps> = ({ 
  graphData, 
  onNodeClick,
  focusQuery,
  focusContext
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Physics & State
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const animationRef = useRef<number>(0);
  const viewportRef = useRef({ x: 0, y: 0, scale: 0.6 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const hoverNode = useRef<SimNode | null>(null);

  // Initialize Data (Standard or Roadmap)
  useEffect(() => {
    let nodes: GraphNode[] = [];
    let links: GraphLink[] = [];

    // Mode 1: Inference Roadmap (If focusQuery is present)
    if (focusQuery && focusContext) {
        // 1. Query Node (Center)
        const queryId = 'query_root';
        nodes.push({ id: queryId, type: 'query', label: focusQuery, val: 30 });

        // 2. Add Chunk Nodes & Doc Nodes
        const addedDocs = new Set<string>();
        
        focusContext.forEach((ctx, idx) => {
            // Add Chunk
            const chunkNodeId = ctx.chunkId;
            if(!nodes.find(n => n.id === chunkNodeId)) {
                nodes.push({ id: chunkNodeId, type: 'chunk', label: `Result #${idx+1}`, val: 15, data: ctx });
                // Link Query -> Chunk (Strength based on score)
                links.push({ source: queryId, target: chunkNodeId, type: 'similar_to', weight: ctx.score });
            }

            // Add Document
            if (!addedDocs.has(ctx.docId)) {
                nodes.push({ id: ctx.docId, type: 'doc', label: ctx.docTitle, val: 25 });
                addedDocs.add(ctx.docId);
            }
            // Link Chunk -> Doc
            links.push({ source: chunkNodeId, target: ctx.docId, type: 'contains' });

            // Add Entities
            if (ctx.relatedEntities) {
                ctx.relatedEntities.forEach(ent => {
                    const entId = `ent_${ent}`;
                    if(!nodes.find(n => n.id === entId)) {
                        nodes.push({ id: entId, type: 'entity', label: ent, val: 8 });
                    }
                    // Link Chunk -> Entity
                    links.push({ source: chunkNodeId, target: entId, type: 'mentions' });
                });
            }
        });
        
        // Initial Layout for Roadmap
        // Set query at (0,0) fixed
        // Set others randomly around
        const newNodes: SimNode[] = nodes.map(n => ({
            ...n,
            x: n.type === 'query' ? 0 : (Math.random() - 0.5) * 600,
            y: n.type === 'query' ? -200 : (Math.random() - 0.5) * 600,
            vx: 0, vy: 0,
            radius: getNodeRadius(n.type, n.val),
            color: getNodeColor(n.type),
            fixed: n.type === 'query' // Fix root
        }));
        
        nodesRef.current = newNodes;
        linksRef.current = links;
        viewportRef.current = { x: 0, y: 150, scale: 0.8 }; // Adjust view to look at hierarchy

    } 
    // Mode 2: Full Knowledge Graph
    else if (graphData) {
        const existingMap = new Map<string, SimNode>();
        nodesRef.current.forEach(n => existingMap.set(n.id, n));
        
        const newNodes: SimNode[] = graphData.nodes.map(n => {
           const existing = existingMap.get(n.id);
           return {
              ...n,
              x: existing ? existing.x : (Math.random() - 0.5) * 800,
              y: existing ? existing.y : (Math.random() - 0.5) * 800,
              vx: existing ? existing.vx : 0,
              vy: existing ? existing.vy : 0,
              radius: getNodeRadius(n.type, n.val),
              color: getNodeColor(n.type)
           };
        });

        nodesRef.current = newNodes;
        linksRef.current = graphData.links;
    }

  }, [graphData, focusQuery, focusContext]);

  const getNodeColor = (type: string) => {
      switch(type) {
          case 'doc': return '#3b82f6'; // Blue
          case 'chunk': return '#f59e0b'; // Amber
          case 'entity': return '#10b981'; // Emerald
          case 'query': return '#ec4899'; // Pink/Red for Query
          default: return '#94a3b8';
      }
  };

  const getNodeRadius = (type: string, val: number = 10) => {
      switch(type) {
          case 'doc': return 25;
          case 'query': return 35;
          case 'chunk': return 12;
          case 'entity': return 8 + (Math.min(val, 10)); 
          default: return 10;
      }
  };

  // Physics Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const animate = () => {
          if (!containerRef.current) return;
          canvas.width = containerRef.current.clientWidth;
          canvas.height = containerRef.current.clientHeight;
          const { width, height } = canvas;
          const nodes = nodesRef.current;
          const links = linksRef.current;

          // Physics Parameters
          const REPULSION = focusQuery ? 1500 : 800; // Stronger spread for roadmap
          const SPRING = 0.03;
          const SPRING_LEN = focusQuery ? 120 : 80;
          const DAMPING = 0.90;
          const CENTER = 0.01;

          // Forces
          nodes.forEach(node => {
              if (node.fixed) return; // Don't move fixed nodes (like Query Root)

              let fx = 0, fy = 0;

              // Repulsion
              nodes.forEach(other => {
                  if (node === other) return;
                  const dx = node.x - other.x;
                  const dy = node.y - other.y;
                  let d = Math.sqrt(dx*dx + dy*dy);
                  if (d < 1) d = 1;
                  // Standard electrostatic
                  const fr = REPULSION / (d * 0.8); 
                  fx += (dx / d) * fr;
                  fy += (dy / d) * fr;
              });

              // Links
              links.forEach(link => {
                  const s = nodes.find(n => n.id === link.source);
                  const t = nodes.find(n => n.id === link.target);
                  if (s && t && (s === node || t === node)) {
                      const other = s === node ? t : s;
                      const dx = node.x - other.x;
                      const dy = node.y - other.y;
                      const d = Math.sqrt(dx*dx + dy*dy);
                      const f = (d - SPRING_LEN) * SPRING;
                      fx -= (dx / d) * f;
                      fy -= (dy / d) * f;
                  }
              });

              // Center Gravity (only if not roadmap)
              if (!focusQuery) {
                fx -= node.x * CENTER;
                fy -= node.y * CENTER;
              } else {
                 // In roadmap, gravity pulls slightly down to create tree-like feel
                 fy += 0.5; 
              }

              node.vx = (node.vx + fx) * DAMPING;
              node.vy = (node.vy + fy) * DAMPING;
          });

          // Move
          nodes.forEach(n => {
              if (!n.fixed) {
                  n.x += n.vx;
                  n.y += n.vy;
              }
          });

          // --- Draw ---
          const vp = viewportRef.current;
          
          // Background
          const grd = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
          grd.addColorStop(0, '#0f172a');
          grd.addColorStop(1, '#020617');
          ctx.fillStyle = grd;
          ctx.fillRect(0,0, width, height);

          ctx.save();
          ctx.translate(width/2 + vp.x, height/2 + vp.y);
          ctx.scale(vp.scale, vp.scale);

          // Draw Links
          links.forEach(link => {
             const s = nodes.find(n => n.id === link.source);
             const t = nodes.find(n => n.id === link.target);
             if (s && t) {
                 ctx.beginPath();
                 ctx.moveTo(s.x, s.y);
                 ctx.lineTo(t.x, t.y);
                 
                 // Gradient stroke for roadmap links
                 const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
                 grad.addColorStop(0, `${s.color}40`);
                 grad.addColorStop(1, `${t.color}40`);
                 ctx.strokeStyle = grad;
                 ctx.lineWidth = link.weight ? Math.max(1, link.weight * 5) : 1.5;
                 ctx.stroke();

                 // Directional arrows for roadmap
                 if (focusQuery) {
                    const midX = (s.x + t.x) / 2;
                    const midY = (s.y + t.y) / 2;
                    ctx.fillStyle = '#64748b';
                    ctx.beginPath();
                    ctx.arc(midX, midY, 2, 0, Math.PI * 2);
                    ctx.fill();
                 }
             }
          });

          // Draw Nodes
          nodes.forEach(node => {
              // Node Glow
              const glow = ctx.createRadialGradient(node.x, node.y, node.radius * 0.5, node.x, node.y, node.radius * 1.5);
              glow.addColorStop(0, node.color);
              glow.addColorStop(1, 'transparent');
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
              ctx.fill();

              // Solid Circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // Border
              ctx.strokeStyle = '#1e293b';
              ctx.lineWidth = 2;
              ctx.stroke();

              // Icon / Text
              if (node === hoverNode.current) {
                  ctx.lineWidth = 2;
                  ctx.strokeStyle = '#fff';
                  ctx.stroke();
              }

              // Labels
              ctx.font = node.type === 'query' ? 'bold 14px Vazirmatn' : '11px Vazirmatn';
              ctx.fillStyle = node.type === 'query' ? '#fff' : '#cbd5e1';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              if (node.type === 'query' || node.type === 'doc' || node === hoverNode.current) {
                   // Full label below
                   ctx.fillText(node.label, node.x, node.y + node.radius + 15);
              } else if (node.type === 'chunk') {
                   // Small ID inside
                   ctx.fillStyle = '#fff';
                   ctx.fillText('#', node.x, node.y);
              }
          });

          ctx.restore();
          animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
  }, [focusQuery]); // Re-bind anim loop when mode changes

  // Interactions
  const handleMouseDown = (e: React.MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (isDragging.current) {
          viewportRef.current.x += e.clientX - lastMouse.current.x;
          viewportRef.current.y += e.clientY - lastMouse.current.y;
          lastMouse.current = { x: e.clientX, y: e.clientY };
      } else {
          // Hover logic
          const mx = (e.clientX - rect.left - rect.width/2 - viewportRef.current.x) / viewportRef.current.scale;
          const my = (e.clientY - rect.top - rect.height/2 - viewportRef.current.y) / viewportRef.current.scale;
          
          hoverNode.current = nodesRef.current.find(n => {
              const d = Math.sqrt((n.x - mx)**2 + (n.y - my)**2);
              return d < n.radius + 2;
          }) || null;
          
          if (canvasRef.current) {
              canvasRef.current.style.cursor = hoverNode.current ? 'pointer' : (isDragging.current ? 'grabbing' : 'default');
          }
      }
  };

  const handleMouseUp = () => { isDragging.current = false; };
  
  const handleWheel = (e: React.WheelEvent) => {
      viewportRef.current.scale = Math.max(0.1, Math.min(5, viewportRef.current.scale - e.deltaY * 0.001));
  };

  const handleClick = () => {
      if (hoverNode.current) {
          onNodeClick(hoverNode.current.id, hoverNode.current.type);
      }
  };

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden" ref={containerRef}>
       <canvas 
         ref={canvasRef}
         className="block touch-none"
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onWheel={handleWheel}
         onClick={handleClick}
       />
       
       <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur p-3 rounded-xl border border-slate-800 text-right pointer-events-none">
          <div className="text-[10px] text-slate-400 space-y-2">
              <div className="flex items-center gap-2 justify-end">
                  <span>سوال کاربر (Query)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-slate-900 ring-1 ring-pink-500/50"></span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                  <span>سند (Document)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-slate-900 ring-1 ring-blue-500/50"></span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                  <span>قطعه متن (Chunk)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900 ring-1 ring-amber-500/50"></span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                  <span>موجودیت (Entity)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900 ring-1 ring-emerald-500/50"></span>
              </div>
          </div>
       </div>

       <div className="absolute bottom-6 left-6 flex flex-col gap-2">
           <button onClick={() => viewportRef.current.scale *= 1.1} className="p-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all">
               <ZoomIn className="w-5 h-5" />
           </button>
           <button onClick={() => viewportRef.current.scale *= 0.9} className="p-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all">
               <ZoomOut className="w-5 h-5" />
           </button>
           <button onClick={() => viewportRef.current = {x:0, y: focusQuery ? 150 : 0, scale: focusQuery ? 0.8 : 0.6}} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all">
               <RefreshCw className="w-5 h-5" />
           </button>
       </div>

       {focusQuery && (
           <div className="absolute top-4 left-4 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
               <GitBranch className="w-4 h-4 text-indigo-400" />
               <span className="text-xs text-indigo-200">حالت نمایش: Roadmap</span>
           </div>
       )}
    </div>
  );
};
