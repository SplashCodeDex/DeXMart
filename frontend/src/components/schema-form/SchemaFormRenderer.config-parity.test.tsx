import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import schemaFixture from "../../../../test-fixtures/config-schema-small.json";
import { SchemaFormRenderer, type JsonSchema } from "./SchemaFormRenderer";

describe("SchemaFormRenderer - Config Parity", () => {
  const onSubmit = vi.fn();

  it("renders the full OpenClaw config schema without crashing", () => {
    render(<SchemaFormRenderer schema={schemaFixture.schema as any} onSubmit={onSubmit} />);

    // Check for some known top-level sections
    expect(screen.getAllByText(/Metadata/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Environment/i).length).toBeGreaterThan(0);
  });

  it("renders a map-like field for additionalProperties (e.g. env.vars)", () => {
    // env.vars has type: object and additionalProperties: { type: string }
    // It should render a way to add multiple key-value pairs.
    render(<SchemaFormRenderer schema={schemaFixture.schema as any} onSubmit={onSubmit} />);

    expect(screen.getAllByText(/Environment Variable Overrides/i).length).toBeGreaterThan(0);
    // It should have an "Add" button similar to arrays, but for keys
    // OR at least it shouldn't just be a single text input.
    expect(
      screen.getByRole("button", { name: /Add Environment Variable Overrides/i }),
    ).toBeDefined();
  });

  it("submits map data correctly (round-trip)", async () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        vars: {
          type: "object",
          title: "Vars",
          additionalProperties: { type: "string" },
        },
      },
    };
    render(
      <SchemaFormRenderer
        schema={schema}
        onSubmit={onSubmit}
        defaultValues={{ vars: { FOO: "bar" } }}
      />,
    );

    // Should render existing entry
    expect(screen.getByDisplayValue("FOO")).toBeDefined();
    expect(screen.getByDisplayValue("bar")).toBeDefined();

    // Add new entry
    fireEvent.click(screen.getByRole("button", { name: /Add Vars/i }));

    const inputs = screen.getAllByRole("textbox");
    // [FOO, bar, "", ""]
    fireEvent.change(inputs[2]!, { target: { value: "BAZ" } });
    fireEvent.change(inputs[3]!, { target: { value: "qux" } });

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          vars: { FOO: "bar", BAZ: "qux" },
        }),
      );
    });
  });
});
