import { describe, it, expect } from "vitest";

import { computeTreePositions } from "../computeTreePositions";

import type { BuilderNode } from "../../automationBuilder.types";

function makeNode(overrides: Partial<BuilderNode> = {}): BuilderNode {
  return {
    id: "node-1",
    kind: "trigger",
    type: "user_invited",
    label: "User Invited",
    parentId: null,
    children: [],
    position: { x: 0, y: 0 },
    config: {},
    ...overrides,
  };
}

describe("computeTreePositions", () => {
  it("returns empty array for empty input", () => {
    expect(computeTreePositions([])).toEqual([]);
  });

  it("positions a single root node at center (x=0, y=0)", () => {
    const nodes = [makeNode({ id: "root" })];
    const result = computeTreePositions(nodes);

    expect(result).toHaveLength(1);
    expect(result[0].position).toEqual({ x: 0, y: 0 });
  });

  it("positions parent above child vertically (y offset = 150)", () => {
    const nodes: BuilderNode[] = [
      makeNode({ id: "parent", children: ["child"] }),
      makeNode({ id: "child", kind: "action", type: "send_email", parentId: "parent" }),
    ];

    const result = computeTreePositions(nodes);
    const parent = result.find((n) => n.id === "parent")!;
    const child = result.find((n) => n.id === "child")!;

    expect(parent.position.y).toBe(0);
    expect(child.position.y).toBe(150);
  });

  it("centers a single child directly below its parent", () => {
    const nodes: BuilderNode[] = [
      makeNode({ id: "parent", children: ["child"] }),
      makeNode({ id: "child", kind: "action", type: "send_email", parentId: "parent" }),
    ];

    const result = computeTreePositions(nodes);
    const parent = result.find((n) => n.id === "parent")!;
    const child = result.find((n) => n.id === "child")!;

    expect(parent.position.x).toBe(child.position.x);
  });

  it("spaces siblings horizontally with gap", () => {
    const nodes: BuilderNode[] = [
      makeNode({ id: "root", children: ["left", "right"] }),
      makeNode({ id: "left", kind: "action", type: "send_email", parentId: "root" }),
      makeNode({ id: "right", kind: "action", type: "send_email", parentId: "root" }),
    ];

    const result = computeTreePositions(nodes);
    const left = result.find((n) => n.id === "left")!;
    const right = result.find((n) => n.id === "right")!;

    expect(left.position.x).toBeLessThan(right.position.x);
    // NODE_WIDTH = 224, HORIZONTAL_GAP = 40 → distance between centers = 264
    expect(right.position.x - left.position.x).toBe(264);
  });

  it("handles multiple root nodes side by side", () => {
    const nodes: BuilderNode[] = [
      makeNode({ id: "root-a" }),
      makeNode({ id: "root-b", kind: "action", type: "send_email" }),
    ];

    const result = computeTreePositions(nodes);
    const rootA = result.find((n) => n.id === "root-a")!;
    const rootB = result.find((n) => n.id === "root-b")!;

    expect(rootA.position.x).toBeLessThan(rootB.position.x);
    expect(rootA.position.y).toBe(0);
    expect(rootB.position.y).toBe(0);
  });

  it("preserves original node data except position", () => {
    const original = makeNode({ id: "test", config: { foo: "bar" }, label: "Custom Label" });
    const result = computeTreePositions([original]);

    expect(result[0].id).toBe("test");
    expect(result[0].label).toBe("Custom Label");
    expect(result[0].config).toEqual({ foo: "bar" });
    expect(result[0].kind).toBe("trigger");
    expect(result[0].type).toBe("user_invited");
  });

  it("handles a three-level tree correctly", () => {
    const nodes: BuilderNode[] = [
      makeNode({ id: "level0", children: ["level1"] }),
      makeNode({
        id: "level1",
        kind: "action",
        type: "send_email",
        parentId: "level0",
        children: ["level2"],
      }),
      makeNode({ id: "level2", kind: "action", type: "send_email", parentId: "level1" }),
    ];

    const result = computeTreePositions(nodes);
    const l0 = result.find((n) => n.id === "level0")!;
    const l1 = result.find((n) => n.id === "level1")!;
    const l2 = result.find((n) => n.id === "level2")!;

    expect(l0.position.y).toBe(0);
    expect(l1.position.y).toBe(150);
    expect(l2.position.y).toBe(300);
    // All centered on same x since single-child chain
    expect(l0.position.x).toBe(l1.position.x);
    expect(l1.position.x).toBe(l2.position.x);
  });
});
