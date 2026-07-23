import type { BuilderNode } from "../automationBuilder.types";

/**
 * Layout constants for the tree position calculation.
 * NODE_WIDTH and HORIZONTAL_GAP control the X spacing between sibling branches.
 * VERTICAL_GAP controls the Y spacing between parent and child rows.
 */
const NODE_WIDTH = 224; // matches the w-56 (14rem) card width
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 150;

interface PositionMap {
  [nodeId: string]: { x: number; y: number };
}

/**
 * Computes the width (in pixels) of a subtree rooted at `nodeId`.
 * A leaf node occupies NODE_WIDTH. A parent occupies the sum of its children's
 * widths plus gaps between them.
 */
function subtreeWidth(nodeId: string, nodesById: Map<string, BuilderNode>): number {
  const node = nodesById.get(nodeId);
  if (!node || node.children.length === 0) return NODE_WIDTH;

  return node.children.reduce((total, childId, index) => {
    const childWidth = subtreeWidth(childId, nodesById);
    return total + childWidth + (index > 0 ? HORIZONTAL_GAP : 0);
  }, 0);
}

/**
 * Recursively assigns positions to `nodeId` and its descendants.
 * `centerX` is the horizontal center of the available space for this subtree.
 * `topY` is the top of this node's row.
 */
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

  // Start placing children from left edge of the bounding box centered on centerX
  let currentX = centerX - totalChildrenWidth / 2;

  for (const childId of node.children) {
    const childW = subtreeWidth(childId, nodesById);
    const childCenterX = currentX + childW / 2;
    layoutSubtree(childId, childCenterX, childY, nodesById, positions);
    currentX += childW + HORIZONTAL_GAP;
  }
}

/**
 * Computes tree-layout positions for all nodes.
 * Returns a new array of BuilderNode with updated `position` fields.
 *
 * Multiple root nodes (parentId === null) are laid out side by side horizontally.
 */
export function computeTreePositions(nodes: BuilderNode[]): BuilderNode[] {
  if (nodes.length === 0) return nodes;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => n.parentId === null);

  const positions: PositionMap = {};

  // Calculate total width for all root trees
  const totalRootsWidth = roots.reduce((total, root, index) => {
    return total + subtreeWidth(root.id, nodesById) + (index > 0 ? HORIZONTAL_GAP : 0);
  }, 0);

  // Layout each root tree side by side
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
