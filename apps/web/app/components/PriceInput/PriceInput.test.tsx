import { render, screen, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PriceInput } from "./PriceInput";

describe("PriceInput", () => {
  const defaultProps = {
    onChange: vi.fn(),
    "aria-label": "Price input",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders without crashing", () => {
    render(<PriceInput {...defaultProps} />);
    expect(screen.getByLabelText("Price input")).toBeInTheDocument();
  });

  it("displays initial value correctly", () => {
    render(<PriceInput {...defaultProps} value={1050} />);
    expect(screen.getByLabelText("Price input")).toHaveValue("10.5");
  });

  it("displays currency when provided", () => {
    render(<PriceInput {...defaultProps} currency="PLN" />);
    expect(screen.getByText("PLN")).toBeInTheDocument();
  });

  it("handles comma input correctly", async () => {
    const onChange = vi.fn();
    render(<PriceInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByLabelText("Price input");
    const user = userEvent.setup();

    await user.type(input, "10,50");
    expect(input).toHaveValue("10.50");
    expect(onChange).toHaveBeenLastCalledWith(1050);
  });

  it("handles dot input correctly", async () => {
    const onChange = vi.fn();
    render(<PriceInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByLabelText("Price input");
    const user = userEvent.setup();

    await user.type(input, "10.50");
    expect(input).toHaveValue("10.50");
    expect(onChange).toHaveBeenLastCalledWith(1050);
  });

  it("limits decimal places to 2", async () => {
    const onChange = vi.fn();
    render(<PriceInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByLabelText("Price input");
    const user = userEvent.setup();

    await user.type(input, "10.555");
    expect(input).toHaveValue("10.55");
    expect(onChange).toHaveBeenLastCalledWith(1055);
  });

  it("handles max value correctly", async () => {
    const onChange = vi.fn();
    render(<PriceInput {...defaultProps} onChange={onChange} max={100} />);

    const input = screen.getByLabelText("Price input");
    const user = userEvent.setup();

    await user.type(input, "150.00");
    expect(input).toHaveValue("100.00");
    expect(onChange).toHaveBeenLastCalledWith(10000);
  });

  it("handles empty input correctly", async () => {
    const onChange = vi.fn();
    render(<PriceInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByLabelText("Price input");
    const user = userEvent.setup();

    await user.type(input, "10");
    expect(onChange).toHaveBeenCalledWith(1000);

    await user.clear(input);
    fireEvent.change(input, { target: { value: "" } });

    expect(input).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("handles multiple dots/commas correctly", async () => {
    const onChange = vi.fn();
    render(<PriceInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByLabelText("Price input");
    const user = userEvent.setup();

    await user.type(input, "10..50");
    expect(input).toHaveValue("10.50");
    expect(onChange).toHaveBeenLastCalledWith(1050);
  });

  it("passes through additional HTML input props", () => {
    render(
      <PriceInput
        {...defaultProps}
        id="price-test"
        data-testid="price-input"
        placeholder="Enter price"
      />,
    );

    const input = screen.getByLabelText("Price input");
    expect(input).toHaveAttribute("id", "price-test");
    expect(input).toHaveAttribute("data-testid", "price-input");
    expect(input).toHaveAttribute("placeholder", "Enter price");
  });
});
