import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_NODE_KINDS,
  AUTOMATION_STATUSES,
  AUTOMATION_TRIGGER_MAP,
  AUTOMATION_TRIGGER_TYPES,
  ACTION_DEFINITIONS,
  getStepDefinition,
  STEP_DEFINITIONS,
  TRIGGER_DEFINITIONS,
} from "@repo/shared";

describe("packages/shared automations constants", () => {
  describe("AUTOMATION_TRIGGER_TYPES", () => {
    it("contains expected number of trigger types", () => {
      expect(AUTOMATION_TRIGGER_TYPES.length).toBe(18);
    });

    it("includes core user triggers", () => {
      expect(AUTOMATION_TRIGGER_TYPES).toContain("user_invited");
      expect(AUTOMATION_TRIGGER_TYPES).toContain("user_welcome");
      expect(AUTOMATION_TRIGGER_TYPES).toContain("user_first_login");
      expect(AUTOMATION_TRIGGER_TYPES).toContain("user_registered");
    });

    it("includes certificate triggers", () => {
      expect(AUTOMATION_TRIGGER_TYPES).toContain("certificate_expiration_warning");
      expect(AUTOMATION_TRIGGER_TYPES).toContain("certificate_archived");
    });

    it("includes announcement and chat triggers", () => {
      expect(AUTOMATION_TRIGGER_TYPES).toContain("announcement_published");
      expect(AUTOMATION_TRIGGER_TYPES).toContain("course_chat_user_mentioned");
    });
  });

  describe("AUTOMATION_ACTION_TYPES", () => {
    it("contains send_email action", () => {
      expect(AUTOMATION_ACTION_TYPES).toContain("send_email");
    });

    it("has expected number of actions", () => {
      expect(AUTOMATION_ACTION_TYPES.length).toBe(1);
    });
  });

  describe("AUTOMATION_NODE_KINDS", () => {
    it("contains trigger and action", () => {
      expect(AUTOMATION_NODE_KINDS).toContain("trigger");
      expect(AUTOMATION_NODE_KINDS).toContain("action");
    });
  });

  describe("AUTOMATION_STATUSES", () => {
    it("contains all statuses", () => {
      expect(AUTOMATION_STATUSES).toContain("enabled");
      expect(AUTOMATION_STATUSES).toContain("disabled");
      expect(AUTOMATION_STATUSES).toContain("archived");
      expect(AUTOMATION_STATUSES).toContain("draft");
    });
  });

  describe("STEP_DEFINITIONS", () => {
    it("has definitions for all trigger types + action types", () => {
      const expectedCount = AUTOMATION_TRIGGER_TYPES.length + AUTOMATION_ACTION_TYPES.length;
      expect(STEP_DEFINITIONS.length).toBe(expectedCount);
    });

    it("every definition has required fields", () => {
      for (const def of STEP_DEFINITIONS) {
        expect(def.kind).toBeDefined();
        expect(def.type).toBeDefined();
        expect(def.labelKey).toBeDefined();
        expect(def.icon).toBeDefined();
        expect(def.color).toBeDefined();
        expect(typeof def.labelKey).toBe("string");
      }
    });

    it("every trigger definition has providedVariables", () => {
      const triggers = STEP_DEFINITIONS.filter((s) => s.kind === "trigger");
      for (const trigger of triggers) {
        expect(trigger.providedVariables).toBeDefined();
        expect(Array.isArray(trigger.providedVariables)).toBe(true);
        expect(trigger.providedVariables!.length).toBeGreaterThan(0);
      }
    });

    it("all definitions have unique type values", () => {
      const types = STEP_DEFINITIONS.map((d) => d.type);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    it("each providedVariable has key and labelKey", () => {
      for (const def of STEP_DEFINITIONS) {
        if (!def.providedVariables) continue;
        for (const variable of def.providedVariables) {
          expect(variable.key).toBeDefined();
          expect(typeof variable.key).toBe("string");
          expect(variable.labelKey).toBeDefined();
          expect(typeof variable.labelKey).toBe("string");
        }
      }
    });

    it("trigger colors are blue and action colors are emerald", () => {
      const triggers = STEP_DEFINITIONS.filter((s) => s.kind === "trigger");
      const actions = STEP_DEFINITIONS.filter((s) => s.kind === "action");

      for (const t of triggers) {
        expect(t.color).toBe("blue");
      }
      for (const a of actions) {
        expect(a.color).toBe("emerald");
      }
    });
  });

  describe("TRIGGER_DEFINITIONS", () => {
    it("only contains trigger definitions", () => {
      for (const def of TRIGGER_DEFINITIONS) {
        expect(def.kind).toBe("trigger");
      }
    });

    it("has same count as AUTOMATION_TRIGGER_TYPES", () => {
      expect(TRIGGER_DEFINITIONS.length).toBe(AUTOMATION_TRIGGER_TYPES.length);
    });
  });

  describe("ACTION_DEFINITIONS", () => {
    it("only contains action definitions", () => {
      for (const def of ACTION_DEFINITIONS) {
        expect(def.kind).toBe("action");
      }
    });

    it("has same count as AUTOMATION_ACTION_TYPES", () => {
      expect(ACTION_DEFINITIONS.length).toBe(AUTOMATION_ACTION_TYPES.length);
    });
  });

  describe("AUTOMATION_TRIGGER_MAP", () => {
    it("has an entry for every trigger type", () => {
      for (const triggerType of AUTOMATION_TRIGGER_TYPES) {
        expect(AUTOMATION_TRIGGER_MAP[triggerType]).toBeDefined();
      }
    });

    it("each entry matches the corresponding STEP_DEFINITION", () => {
      for (const triggerType of AUTOMATION_TRIGGER_TYPES) {
        const mapEntry = AUTOMATION_TRIGGER_MAP[triggerType];
        const defEntry = STEP_DEFINITIONS.find((s) => s.type === triggerType);
        expect(mapEntry).toEqual(defEntry);
      }
    });
  });

  describe("getStepDefinition", () => {
    it("returns definition for known trigger type", () => {
      const def = getStepDefinition("user_invited");
      expect(def).toBeDefined();
      expect(def!.kind).toBe("trigger");
      expect(def!.type).toBe("user_invited");
    });

    it("returns definition for known action type", () => {
      const def = getStepDefinition("send_email");
      expect(def).toBeDefined();
      expect(def!.kind).toBe("action");
      expect(def!.type).toBe("send_email");
    });

    it("returns undefined for unknown type", () => {
      const def = getStepDefinition("nonexistent" as any);
      expect(def).toBeUndefined();
    });
  });
});
