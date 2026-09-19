/**
 * High-performance 2D Canvas rendering for the NPC Steering AI Demo.
 * Renders simple box avatars, crate obstacles, healing shrines, health orbs,
 * and AI debug gizmos (whiskers, vectors, target lines, state badges).
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { DebugVisualSettings, NPC } from '../types';

interface GameCanvasProps {
  engine: GameEngine;
  debugSettings: DebugVisualSettings;
  selectedNpcId: string | null;
  onSelectNPC: (id: string | null) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  debugSettings,
  selectedNpcId,
  onSelectNPC,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resize canvas according to container
  const handleResize = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;

    engine.resize(clientWidth, clientHeight);
  }, [engine]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Handle canvas click to select NPC
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked an NPC
    let clickedNpc: NPC | null = null;
    let minD = 35; // selection radius

    for (const npc of engine.npcs) {
      const d = Math.hypot(npc.x - clickX, npc.y - clickY);
      if (d < minD) {
        minD = d;
        clickedNpc = npc;
      }
    }

    if (clickedNpc) {
      onSelectNPC(clickedNpc.id);
    } else {
      // If clicked empty space, don't deselect to keep inspection alive
    }
  };

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling on Space or Arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      engine.setKeyDown(e.key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engine.setKeyUp(e.key);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [engine]);

  // Main Render Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Step physics and AI
      engine.update(dt);

      // Draw frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.scale(dpr, dpr);

          drawScene(ctx, engine, debugSettings, selectedNpcId);

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine, debugSettings, selectedNpcId]);

  return (
    <div
      ref={containerRef}
      id="game-canvas-container"
      className="relative w-full h-full min-h-[480px] bg-slate-950 overflow-hidden select-none cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        id="main-simulation-canvas"
        onClick={handleCanvasClick}
        className="w-full h-full block"
      />
    </div>
  );
};

// Canvas Drawing Helper
function drawScene(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  debug: DebugVisualSettings,
  selectedId: string | null
) {
  const { width, height } = engine;

  // 1. Background Grid & Outer Boundary
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  // Subtle grid lines (every 40px)
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.beginPath();
  for (let x = 0; x <= width; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Arena perimeter border
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

  // 2. Healing Stations (Shrines)
  for (const shrine of engine.healStations) {
    // Fill with soft emerald gradient
    const grad = ctx.createRadialGradient(
      shrine.x + shrine.width / 2,
      shrine.y + shrine.height / 2,
      10,
      shrine.x + shrine.width / 2,
      shrine.y + shrine.height / 2,
      shrine.width * 0.75
    );
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.04)');

    ctx.fillStyle = grad;
    ctx.fillRect(shrine.x, shrine.y, shrine.width, shrine.height);

    // Border
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(shrine.x, shrine.y, shrine.width, shrine.height);
    ctx.setLineDash([]);

    // Sanctuary Cross / Icon
    const cx = shrine.x + shrine.width / 2;
    const cy = shrine.y + shrine.height / 2;
    ctx.fillStyle = 'rgba(52, 211, 153, 0.7)';
    ctx.fillRect(cx - 3, cy - 14, 6, 28);
    ctx.fillRect(cx - 14, cy - 3, 28, 6);

    // Label
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NPC HEAL ZONE', cx, shrine.y + shrine.height - 10);
  }

  // 3. Crates / Obstacle Boxes
  for (const crate of engine.crates) {
    // Crate body (industrial slate/zinc box)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(crate.x, crate.y, crate.width, crate.height);

    // Inner highlight / bevel
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x, crate.y, crate.width, crate.height);

    // Crate diagonal bracing lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(crate.x, crate.y);
    ctx.lineTo(crate.x + crate.width, crate.y + crate.height);
    ctx.moveTo(crate.x + crate.width, crate.y);
    ctx.lineTo(crate.x, crate.y + crate.height);
    ctx.stroke();

    // Crate corner rivets
    ctx.fillStyle = '#64748b';
    const rSize = 3;
    ctx.fillRect(crate.x + 3, crate.y + 3, rSize, rSize);
    ctx.fillRect(crate.x + crate.width - 6, crate.y + 3, rSize, rSize);
    ctx.fillRect(crate.x + 3, crate.y + crate.height - 6, rSize, rSize);
    ctx.fillRect(crate.x + crate.width - 6, crate.y + crate.height - 6, rSize, rSize);

    // Optional crate label
    if (crate.label && crate.width > 60 && crate.height > 40) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.font = '500 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(crate.label, crate.x + crate.width / 2, crate.y + crate.height / 2 + 3);
    }
  }

  // 4. Health Orbs (Player healing items)
  for (const orb of engine.healthOrbs) {
    const pulse = 1 + Math.sin(engine.survivalTime * 4 + orb.x) * 0.15;
    const r = orb.radius * pulse;

    // Glowing aura
    const aura = ctx.createRadialGradient(orb.x, orb.y, 2, orb.x, orb.y, r * 2.2);
    aura.addColorStop(0, 'rgba(52, 211, 153, 0.8)');
    aura.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Solid core
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Cross icon on orb
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(orb.x - 2, orb.y - 6, 4, 12);
    ctx.fillRect(orb.x - 6, orb.y - 2, 12, 4);
  }

  // 5. Pulse Shockwave Rings
  for (const wave of engine.pulseWaves) {
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${wave.alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow
    ctx.fillStyle = `rgba(56, 189, 248, ${wave.alpha * 0.12})`;
    ctx.fill();
    ctx.restore();
  }

  // 6. Particles
  for (const p of engine.particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // 7. AI Debug Gizmos (Target lines, Steering vectors, Sensors)
  for (const npc of engine.npcs) {
    const isSelected = npc.id === selectedId;

    // Target Line (dotted line to target)
    if (debug.showTargetLines && npc.debugData.targetPoint) {
      ctx.save();
      ctx.strokeStyle = npc.color;
      ctx.lineWidth = isSelected ? 1.8 : 1.0;
      ctx.globalAlpha = isSelected ? 0.7 : 0.25;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(npc.x, npc.y);
      ctx.lineTo(npc.debugData.targetPoint.x, npc.debugData.targetPoint.y);
      ctx.stroke();

      // Target point marker
      ctx.fillStyle = npc.color;
      ctx.beginPath();
      ctx.arc(npc.debugData.targetPoint.x, npc.debugData.targetPoint.y, isSelected ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Whisker Raycast Sensors
    if (debug.showRaycasts) {
      ctx.save();
      for (const sensor of npc.sensors) {
        const heading = npc.rotation + sensor.angleOffset;
        const dirX = Math.cos(heading);
        const dirY = Math.sin(heading);
        const endX = npc.x + dirX * sensor.hitDistance;
        const endY = npc.y + dirY * sensor.hitDistance;

        ctx.strokeStyle = sensor.isBlocked ? 'rgba(239, 68, 68, 0.75)' : 'rgba(34, 197, 94, 0.35)';
        ctx.lineWidth = isSelected ? 1.5 : 1.0;
        ctx.beginPath();
        ctx.moveTo(npc.x, npc.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Dot at hit point
        if (sensor.isBlocked) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(endX, endY, isSelected ? 3 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Steering Velocity Vectors
    if (debug.showSteeringVectors) {
      ctx.save();
      // Desired velocity vector (Yellow / White)
      const dv = npc.debugData.desiredVelocity;
      if (dv && (dv.x !== 0 || dv.y !== 0)) {
        const arrowLen = 35;
        const speed = Math.hypot(dv.x, dv.y);
        const nx = dv.x / (speed || 1);
        const ny = dv.y / (speed || 1);

        ctx.strokeStyle = '#facc15'; // yellow
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(npc.x, npc.y);
        ctx.lineTo(npc.x + nx * arrowLen, npc.y + ny * arrowLen);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 8. Draw Enemy NPCs (Simple Box Avatars as requested)
  for (const npc of engine.npcs) {
    const isSelected = npc.id === selectedId;
    const half = npc.size / 2;

    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.rotate(npc.rotation);

    // Selected NPC golden pulse reticle
    if (isSelected) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-half - 6, -half - 6, npc.size + 12, npc.size + 12);
      ctx.setLineDash([]);
    }

    // Healing aura if healing
    if (npc.isHealing) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
      ctx.fillRect(-half - 4, -half - 4, npc.size + 8, npc.size + 8);
    }

    // Box Body
    ctx.fillStyle = npc.color;
    ctx.fillRect(-half, -half, npc.size, npc.size);

    // Box Outline
    ctx.strokeStyle = isSelected ? '#ffffff' : npc.accentColor;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeRect(-half, -half, npc.size, npc.size);

    // Directional Nose / Heading pointer (on front of box)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half - 6, -5);
    ctx.lineTo(half - 6, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Health and Stamina Bars above NPC
    if (debug.showHealthBars) {
      const barW = npc.size + 8;
      const barH = 3;
      const barX = npc.x - barW / 2;
      const barY = npc.y - half - 14;

      // Health Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      // Health fill
      const hpRatio = Math.max(0, npc.health / npc.maxHealth);
      ctx.fillStyle = hpRatio < 0.35 ? '#ef4444' : hpRatio < 0.7 ? '#f59e0b' : '#10b981';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // Aggression Stamina Bar (Cyan / Amber sprint bar)
      const staminaY = barY + barH + 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(barX - 1, staminaY - 1, barW + 2, 2.5);

      const maxStam = npc.maxAggressionStamina ?? 4.0;
      const curStam = Math.max(0, npc.aggressionStamina ?? 4.0);
      const stamRatio = Math.min(1, curStam / maxStam);
      ctx.fillStyle = npc.isExhausted ? '#f97316' : '#06b6d4'; // Orange when exhausted, cyan when charging/sprinting
      ctx.fillRect(barX, staminaY, barW * stamRatio, 2);
    }

    // Overhead AI State Badge
    if (debug.showAIStateBadges) {
      const badgeText = npc.debugData.stateBadge || npc.name;
      ctx.font = '600 10px system-ui, sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const bgW = textMetrics.width + 10;
      const bgH = 16;
      const bgX = npc.x - bgW / 2;
      const bgY = npc.y - half - 28;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(bgX, bgY, bgW, bgH);

      ctx.strokeStyle = npc.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(bgX, bgY, bgW, bgH);

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, npc.x, bgY + 12);
    }
  }

  // 9. Draw Player (Simple Box Avatar)
  {
    const p = engine.player;
    const half = p.size / 2;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    // Damage flash red
    if (p.damageFlash > 0) {
      ctx.fillStyle = '#ef4444';
    } else {
      ctx.fillStyle = '#10b981'; // Emerald player box
    }

    ctx.fillRect(-half, -half, p.size, p.size);

    // Outline
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.strokeRect(-half, -half, p.size, p.size);

    // Player Directional Nose pointer
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half - 7, -6);
    ctx.lineTo(half - 7, 6);
    ctx.closePath();
    ctx.fill();

    // Pulse Ready Aura (cyan ring if pulse available)
    if (p.pulseCooldown <= 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(-half - 5, -half - 5, p.size + 10, p.size + 10);
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Player Health Bar
    const pBarW = p.size + 12;
    const pBarH = 5;
    const pBarX = p.x - pBarW / 2;
    const pBarY = p.y - half - 15;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(pBarX - 1, pBarY - 1, pBarW + 2, pBarH + 2);

    const pHpRatio = Math.max(0, p.health / p.maxHealth);
    ctx.fillStyle = pHpRatio < 0.3 ? '#ef4444' : '#10b981';
    ctx.fillRect(pBarX, pBarY, pBarW * pHpRatio, pBarH);

    // "YOU" Label
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU (PLAYER)', p.x, pBarY - 6);
  }

  // 10. Floating Damage Numbers
  for (const dn of engine.damageNumbers) {
    ctx.save();
    ctx.fillStyle = dn.color;
    ctx.globalAlpha = Math.max(0, dn.alpha);
    ctx.font = 'bold 12px system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dn.text, dn.x, dn.y);
    ctx.restore();
  }
}
