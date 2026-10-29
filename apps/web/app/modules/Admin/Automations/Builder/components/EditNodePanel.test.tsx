import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditNodePanel } from "./EditNodePanel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./EmailActionSettings", () => ({ EmailActionSettings: () => null }));
vi.mock("./ConditionSettings", () => ({ ConditionSettings: () => null }));
vi.mock("./AutomationRecipientPicker", () => ({
  AutomationRecipientPicker: ({
    type,
    value,
    disabled,
    onChange,
  }: {
    type: string;
    value: string;
    disabled: boolean;
    onChange: (id: string) => void;
  }) => (
    <button
      disabled={disabled}
      onClick={() => onChange("selected-group")}
      data-testid="group-picker"
    >
      {type}:{value}
    </button>
  ),
}));

describe("Group assignment trigger configuration", () => {
  it("saves a specific group on the trigger, not as the email audience", () => {
    const onSaveStep = vi.fn();
    const node = {
      id: "trigger",
      parentId: null,
      position: 0,
      type: "trigger" as const,
      config: { eventKind: "user_assigned_to_group" as const },
    };
    render(
      <EditNodePanel
        node={node}
        workflow={{ rootStepId: node.id, steps: [node] }}
        label="Group assignment"
        events={[]}
        templates={[]}
        loadingTemplates={false}
        readonly={false}
        onClose={vi.fn()}
        onConfigurationValidityChange={vi.fn()}
        onChangeTrigger={vi.fn()}
        onSaveStep={onSaveStep}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("group-picker"));
    expect(onSaveStep).toHaveBeenCalledWith({
      ...node,
      config: { ...node.config, groupId: "selected-group" },
    });
  });
});
