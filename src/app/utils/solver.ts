// Loop detection, BFS chain finding, and closed-loop correction solver
// Pure functions -- no React dependency

import type { Node, Wall } from '../types';

/**
 * Detect an open loop: find exactly 2 endpoint nodes
 * (nodes with only 1 wall connection) that could be closed.
 */
export function detectOpenLoop(
  walls: Wall[],
  nodes: Node[]
): { nodeA: string; nodeB: string } | null {
  if (walls.length === 0) return null;
  const cnt = new Map<string, number>();
  nodes.forEach(n => cnt.set(n.id, 0));
  walls.forEach(w => {
    cnt.set(w.nodeA, (cnt.get(w.nodeA) ?? 0) + 1);
    cnt.set(w.nodeB, (cnt.get(w.nodeB) ?? 0) + 1);
  });
  const ends: string[] = [];
  cnt.forEach((c, id) => { if (c === 1) ends.push(id); });
  return ends.length === 2 ? { nodeA: ends[0], nodeB: ends[1] } : null;
}

/**
 * BFS chain finder: find a path of nodes and wall lengths
 * from nodeA to nodeB through the wall graph.
 */
export function findChain(
  nodeAId: string,
  nodeBId: string,
  walls: Wall[]
): { nodeIds: string[]; wallLengthsCm: number[] } | null {
  const visited = new Set<string>();
  type QItem = { nodeId: string; path: string[]; lengths: number[] };
  const queue: QItem[] = [{ nodeId: nodeAId, path: [nodeAId], lengths: [] }];
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.nodeId === nodeBId) return { nodeIds: item.path, wallLengthsCm: item.lengths };
    if (visited.has(item.nodeId)) continue;
    visited.add(item.nodeId);
    const connected = walls.filter(w => w.nodeA === item.nodeId || w.nodeB === item.nodeId);
    for (const wall of connected) {
      const nextId = wall.nodeA === item.nodeId ? wall.nodeB : wall.nodeA;
      if (!visited.has(nextId)) {
        queue.push({ nodeId: nextId, path: [...item.path, nextId], lengths: [...item.lengths, wall.length * 100] });
      }
    }
  }
  return null;
}

/**
 * Weighted angular correction solver for closed polygon loops.
 *
 * Represents the closed polygon as N wall-direction angles theta[i] (wall i goes
 * from node[i] to node[(i+1) % N]). Closure constraint:
 *   sum_i( L[i] * cos theta[i] ) = 0
 *   sum_i( L[i] * sin theta[i] ) = 0
 *
 * Finds the minimum-weighted-norm angle correction that satisfies the closure
 * constraint. Walls adjacent to UNCONSTRAINED nodes get high weight and absorb
 * most of the angular error; walls between CONSTRAINED nodes get low weight
 * and change as little as possible.
 *
 * After angular correction, applies Bowditch (compass-rule) correction to
 * distribute any residual positional error proportionally along the perimeter.
 */
export function solveClosedLoop(
  chainNodeIds: string[],   // N nodes forming the open chain
  wallLengthsCm: number[],  // N-1 existing wall lengths (cm)
  closingLengthCm: number,  // closing wall length (cm)
  unconstrained: Set<string>, // unconstrained node IDs (absorb error first)
  nodes: Node[],            // current node positions
  sourceNodeId?: string     // optional: exclude this node from correction
): Node[] | null {
  const N = chainNodeIds.length; // number of nodes
  if (N < 3) return null;

  // All N wall lengths: walls 0..N-2 are existing, wall N-1 is the closing wall
  const L = [...wallLengthsCm, closingLengthCm];

  // Feasibility check: no single wall may exceed the sum of all others
  const total = L.reduce((a, b) => a + b, 0);
  if (L.some(l => l * 2 > total + 0.1)) return null;

  // Node weights: high = unconstrained (eats angular error first)
  const W_HI = 4000;
  const W_LO = 1;
  const nodeW = chainNodeIds.map(id => unconstrained.has(id) ? W_HI : W_LO);

  // Wall weight = average of endpoint node weights
  // Wall i goes from node[i] to node[(i+1) % N]
  const wallW = L.map((_, i) => (nodeW[i] + nodeW[(i + 1) % N]) / 2);

  // --- Initial wall angles from current node positions ---
  const pos0 = chainNodeIds.map(id => {
    const nd = nodes.find(n => n.id === id)!;
    return { x: nd.x, y: nd.y };
  });
  const theta: number[] = [];
  // Existing walls along the open chain
  for (let i = 0; i < N - 1; i++) {
    const from = pos0[i];
    const to = pos0[i + 1];
    theta.push(Math.atan2(to.y - from.y, to.x - from.x));
  }
  // Closing wall angle (initial guess from endpoints)
  const closeFrom = pos0[N - 1];
  const closeTo = pos0[0];
  theta.push(Math.atan2(closeTo.y - closeFrom.y, closeTo.x - closeFrom.x));

  // --- Force constrained existing corners to nearest right angle ---
  // Only snap interior nodes that already have two existing walls (i = 1..N-2).
  const TAU = Math.PI * 2;
  const normAngle = (a: number) => {
    let r = a % TAU;
    if (r <= -Math.PI) r += TAU;
    if (r > Math.PI) r -= TAU;
    return r;
  };
  const angleDiff = (a: number, b: number) => Math.abs(normAngle(a - b));
  const snapRightAngle = (incoming: number, outgoing: number) => {
    const candA = incoming + Math.PI / 2;
    const candB = incoming - Math.PI / 2;
    return angleDiff(candA, outgoing) <= angleDiff(candB, outgoing) ? candA : candB;
  };
  const applyRightAngleConstraints = () => {
    for (let i = 0; i < N; i++) {
      const nodeId = chainNodeIds[i];
      if (sourceNodeId && nodeId === sourceNodeId) continue;
      if (!unconstrained.has(nodeId)) {
        const incoming = theta[(i - 1 + N) % N];
        theta[i] = snapRightAngle(incoming, theta[i]);
      }
    }
  };
  const updateClosingAngleFromChain = () => {
    // Recompute closing wall direction from the corrected open chain.
    let Ex = 0, Ey = 0;
    for (let i = 0; i < N - 1; i++) {
      Ex += L[i] * Math.cos(theta[i]);
      Ey += L[i] * Math.sin(theta[i]);
    }
    theta[N - 1] = Math.atan2(-Ey, -Ex);
  };
  applyRightAngleConstraints();
  updateClosingAngleFromChain();

  const anchor0 = { x: pos0[0].x, y: pos0[0].y };

  // --- Iterative weighted angular correction ---
  // Derivation: minimise (1/2) * sum( (d_theta[i])^2 / wallW[i] )
  // subject to: sum( L[i] * d_theta[i] * perp[i] ) = -E
  // where E = sum( L[i] * dir[i] ) is the closure error.
  // Lagrange solution: d_theta[i] = -wallW[i] * L[i] * perp[i]^T * M^{-1} * E
  // M = sum( wallW[i] * L[i]^2 * perp[i] * perp[i]^T )  [2x2 matrix]
  // perp[i] = ( -sin theta[i], cos theta[i] )

  for (let iter = 0; iter < 400; iter++) {
    // Closure error
    let Ex = 0, Ey = 0;
    for (let i = 0; i < N; i++) {
      Ex += L[i] * Math.cos(theta[i]);
      Ey += L[i] * Math.sin(theta[i]);
    }
    if (Math.hypot(Ex, Ey) < 0.05) break;

    // Build M (symmetric 2x2)
    let M00 = 0, M01 = 0, M11 = 0;
    for (let i = 0; i < N; i++) {
      const s = Math.sin(theta[i]), c = Math.cos(theta[i]);
      const wl2 = wallW[i] * L[i] * L[i];
      M00 += wl2 * s * s;
      M01 -= wl2 * s * c;
      M11 += wl2 * c * c;
    }

    const det = M00 * M11 - M01 * M01;
    if (Math.abs(det) < 1e-12) break;

    // lambda = M^{-1} * E
    const lx = (M11 * Ex - M01 * Ey) / det;
    const ly = (-M01 * Ex + M00 * Ey) / det;

    // Apply correction to every wall angle simultaneously
    for (let i = 0; i < N; i++) {
      const s = Math.sin(theta[i]), c = Math.cos(theta[i]);
      // d_theta[i] = -wallW[i] * L[i] * perp[i]^T * lambda
      //            = -wallW[i] * L[i] * (-s * lx + c * ly)
      theta[i] -= wallW[i] * L[i] * (-s * lx + c * ly);
    }
  }

  // --- Reconstruct node positions from corrected angles ---
  const newPos: { x: number; y: number }[] = new Array(N);
  newPos[0] = { ...anchor0 };
  for (let i = 1; i < N; i++) {
    newPos[i] = {
      x: newPos[i - 1].x + L[i - 1] * Math.cos(theta[i - 1]),
      y: newPos[i - 1].y + L[i - 1] * Math.sin(theta[i - 1]),
    };
  }

  // Following the closing wall from node[N-1] should land back at node[0]
  const closeEnd = {
    x: newPos[N - 1].x + L[N - 1] * Math.cos(theta[N - 1]),
    y: newPos[N - 1].y + L[N - 1] * Math.sin(theta[N - 1]),
  };
  const residualErr = Math.hypot(closeEnd.x - anchor0.x, closeEnd.y - anchor0.y);
  if (residualErr > 2.0) return null;

  // --- Bowditch (compass-rule) correction ---
  // Distribute any residual positional closure error proportionally
  // along the perimeter so every corner shares it fairly.
  if (residualErr > 0.001) {
    const errX = closeEnd.x - anchor0.x;
    const errY = closeEnd.y - anchor0.y;

    // Cumulative distance along the chain for each node
    const cumDist: number[] = new Array(N);
    cumDist[0] = 0;
    for (let i = 1; i < N; i++) {
      cumDist[i] = cumDist[i - 1] + L[i - 1];
    }
    const totalPerimeter = cumDist[N - 1] + L[N - 1]; // includes closing wall

    // Correct each node proportionally (node[0] stays anchored)
    for (let i = 1; i < N; i++) {
      const fraction = cumDist[i] / totalPerimeter;
      newPos[i].x -= errX * fraction;
      newPos[i].y -= errY * fraction;
    }
  }

  return nodes.map(nd => {
    const idx = chainNodeIds.indexOf(nd.id);
    return idx < 0 ? nd : { ...nd, x: newPos[idx].x, y: newPos[idx].y };
  });
}

/**
 * Debug helper: only snap existing constrained corners along an open chain,
 * without placing or solving the closing wall.
 */
export function snapOpenChainRightAngles(
  chainNodeIds: string[],
  wallLengthsCm: number[],
  unconstrained: Set<string>,
  nodes: Node[]
): Node[] | null {
  const N = chainNodeIds.length;
  if (N < 3) return null;
  if (wallLengthsCm.length !== N - 1) return null;

  const pos0 = chainNodeIds.map(id => {
    const nd = nodes.find(n => n.id === id)!;
    return { x: nd.x, y: nd.y };
  });

  const theta: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    const from = pos0[i];
    const to = pos0[i + 1];
    theta.push(Math.atan2(to.y - from.y, to.x - from.x));
  }

  const TAU = Math.PI * 2;
  const normAngle = (a: number) => {
    let r = a % TAU;
    if (r <= -Math.PI) r += TAU;
    if (r > Math.PI) r -= TAU;
    return r;
  };
  const angleDiff = (a: number, b: number) => Math.abs(normAngle(a - b));
  const snapRightAngle = (incoming: number, outgoing: number) => {
    const candA = incoming + Math.PI / 2;
    const candB = incoming - Math.PI / 2;
    return angleDiff(candA, outgoing) <= angleDiff(candB, outgoing) ? candA : candB;
  };

  // Only snap interior nodes (existing corners).
  for (let i = 1; i <= N - 2; i++) {
    if (!unconstrained.has(chainNodeIds[i])) {
      const incoming = theta[i - 1];
      theta[i] = snapRightAngle(incoming, theta[i]);
    }
  }

  const newPos: { x: number; y: number }[] = new Array(N);
  newPos[0] = { ...pos0[0] };
  for (let i = 1; i < N; i++) {
    newPos[i] = {
      x: newPos[i - 1].x + wallLengthsCm[i - 1] * Math.cos(theta[i - 1]),
      y: newPos[i - 1].y + wallLengthsCm[i - 1] * Math.sin(theta[i - 1]),
    };
  }

  return nodes.map(nd => {
    const idx = chainNodeIds.indexOf(nd.id);
    return idx < 0 ? nd : { ...nd, x: newPos[idx].x, y: newPos[idx].y };
  });
}
