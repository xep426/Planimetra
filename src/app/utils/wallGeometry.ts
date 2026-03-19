// Wall geometry helpers — angle calculations, direction labels, winding order
// Pure functions — no React dependency

import type { Node, Wall } from '../types';
import { snapAngle45 } from './geometry';

/** Get the angle of a wall at a specific node (direction away from that node) */
export function wallAngleAtNode(
  nodeId: string,
  walls: Wall[],
  nodes: Node[]
): number | null {
  const w = walls.find(w2 => w2.nodeA === nodeId || w2.nodeB === nodeId);
  if (!w) return null;
  const a = nodes.find(n => n.id === w.nodeA);
  const b = nodes.find(n => n.id === w.nodeB);
  if (!a || !b) return null;
  return w.nodeA === nodeId
    ? Math.atan2(b.y - a.y, b.x - a.x)
    : Math.atan2(a.y - b.y, a.x - b.x);
}

/** Snap the direction from one point to another, optionally relative to a reference wall angle */
export function snapDirection(
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  refId: string | undefined,
  walls: Wall[],
  nodes: Node[]
): { directionX: number; directionY: number } {
  const raw = Math.atan2(ty - fy, tx - fx);
  if (refId) {
    const base = wallAngleAtNode(refId, walls, nodes);
    if (base !== null) {
      const snapped = snapAngle45(raw - base) + base;
      return { directionX: Math.cos(snapped), directionY: Math.sin(snapped) };
    }
  }
  const s = snapAngle45(raw);
  return { directionX: Math.cos(s), directionY: Math.sin(s) };
}

/** Check if a closed loop exists (all nodes have exactly 2 connections) */
export function isLoopClosed(walls: Wall[]): boolean {
  if (walls.length < 3) return false;
  const cnt = new Map<string, number>();
  walls.forEach(w => {
    cnt.set(w.nodeA, (cnt.get(w.nodeA) ?? 0) + 1);
    cnt.set(w.nodeB, (cnt.get(w.nodeB) ?? 0) + 1);
  });
  for (const [_, count] of cnt) {
    if (count !== 2) return false;
  }
  return true;
}

/**
 * Calculate CW/CCW direction labels for a wall's nodes based on loop winding order.
 * Uses the shoelace formula to determine winding direction.
 */
export function calculateNodeLabels(
  wallId: string,
  walls: Wall[],
  nodes: Node[]
): { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' } {
  const wall = walls.find(w => w.id === wallId);
  if (!wall) return { nodeALabel: 'CW', nodeBLabel: 'CCW' };

  // If loop is not closed, we can't determine winding order
  if (!isLoopClosed(walls)) {
    return { nodeALabel: 'CW', nodeBLabel: 'CCW' };
  }

  // Build ordered loop by traversing walls
  const orderedNodeIds: string[] = [];
  const visitedWalls = new Set<string>();
  let currentNodeId = wall.nodeA;
  orderedNodeIds.push(currentNodeId);

  while (visitedWalls.size < walls.length) {
    const nextWall = walls.find(w =>
      !visitedWalls.has(w.id) && (w.nodeA === currentNodeId || w.nodeB === currentNodeId)
    );

    if (!nextWall) break;

    visitedWalls.add(nextWall.id);
    currentNodeId = nextWall.nodeA === currentNodeId ? nextWall.nodeB : nextWall.nodeA;

    if (currentNodeId === wall.nodeA) break; // Completed loop
    orderedNodeIds.push(currentNodeId);
  }

  // Calculate signed area using shoelace formula (trapezoid variant)
  // In screen coordinates (Y-down): negative result = visually CW, positive = visually CCW
  let signedArea = 0;
  for (let i = 0; i < orderedNodeIds.length; i++) {
    const curr = nodes.find(n => n.id === orderedNodeIds[i]);
    const next = nodes.find(n => n.id === orderedNodeIds[(i + 1) % orderedNodeIds.length]);
    if (curr && next) {
      signedArea += (next.x - curr.x) * (next.y + curr.y);
    }
  }

  const isLoopCW = signedArea < 0; // negative = CW in screen space (Y-down)

  // Find position of nodeA and nodeB in the ordered loop
  const nodeAIndex = orderedNodeIds.indexOf(wall.nodeA);
  const nodeBIndex = orderedNodeIds.indexOf(wall.nodeB);

  // Determine if nodeA->nodeB follows the traversal order
  let nodeAToNodeBFollowsTraversal: boolean;
  if (nodeAIndex !== -1 && nodeBIndex !== -1) {
    const nextIndex = (nodeAIndex + 1) % orderedNodeIds.length;
    nodeAToNodeBFollowsTraversal = nextIndex === nodeBIndex;
  } else {
    nodeAToNodeBFollowsTraversal = true;
  }

  // If A->B follows traversal and traversal is CW, then B is the CW node
  const nodeBIsCW = isLoopCW ? nodeAToNodeBFollowsTraversal : !nodeAToNodeBFollowsTraversal;

  return {
    nodeALabel: nodeBIsCW ? 'CCW' : 'CW',
    nodeBLabel: nodeBIsCW ? 'CW' : 'CCW'
  };
}
