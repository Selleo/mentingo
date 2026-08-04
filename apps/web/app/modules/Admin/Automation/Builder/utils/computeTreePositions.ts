import type { BuilderNode } from "../automationBuilder.types";

const NODE_WIDTH = 224;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 150;

interface PositionMap {
  [nodeId: string]: { x: number; y: number };
}

function subtreeWidth(nodeId: string, nodesById: Map<string, BuilderNode>): number {
  const node = nodesById.get(nodeId);
  if (!node || node.children.length === 0) return NODE_WIDTH;

  return node.children.reduce((total, childId, index) => {
    const childWidth = subtreeWidth(childId, nodesById);
    return total + childWidth + (index > 0 ? HORIZONTAL_GAP : 0);
  }, 0);
}

function layoutSubtree(
  nodeId: string,
  centerX: number,
  topY: number,
  nodesById: Map<string, BuilderNode>,
  positions: PositionMap,
): void {
  positions[nodeId] = { x: centerX, y: topY };

  const node = nodesById.get(nodeId);
  if (!node || node.children.length === 0) return;

  const childY = topY + VERTICAL_GAP;
  const totalChildrenWidth = node.children.reduce((total, childId, index) => {
    return total + subtreeWidth(childId, nodesById) + (index > 0 ? HORIZONTAL_GAP : 0);
  }, 0);

  let currentX = centerX - totalChildrenWidth / 2;

  for (const childId of node.children) {
    const childW = subtreeWidth(childId, nodesById);
    const childCenterX = currentX + childW / 2;
    layoutSubtree(childId, childCenterX, childY, nodesById, positions);
    currentX += childW + HORIZONTAL_GAP;
  }
}

export function computeTreePositions(nodes: BuilderNode[]): BuilderNode[] {
  if (nodes.length === 0) return nodes;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => n.parentId === null);

  const positions: PositionMap = {};

  const totalRootsWidth = roots.reduce((total, root, index) => {
    return total + subtreeWidth(root.id, nodesById) + (index > 0 ? HORIZONTAL_GAP : 0);
  }, 0);

  let currentX = -totalRootsWidth / 2;
  for (const root of roots) {
    const rootWidth = subtreeWidth(root.id, nodesById);
    const rootCenterX = currentX + rootWidth / 2;
    layoutSubtree(root.id, rootCenterX, 0, nodesById, positions);
    currentX += rootWidth + HORIZONTAL_GAP;
  }

  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
  }));
}
