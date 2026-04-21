import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchemaFormRenderer } from "./SchemaFormRenderer";
import type { JsonSchema } from "./SchemaFormRenderer";

describe("SchemaFormRenderer", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a text input for string type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { name: { type: "string", title: "Name" } },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/name/i).tagName).toBe("INPUT");
  });

  it("renders a number input for number type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { count: { type: "number", title: "Count" } },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/count/i) as HTMLInputElement;
    expect(input.type).toBe("number");
  });

  it("renders a checkbox for boolean type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { enabled: { type: "boolean", title: "Enabled" } },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    const checkbox = screen.getByRole("checkbox", { name: /enabled/i }) as HTMLInputElement;
    expect(checkbox.type).toBe("checkbox");
  });

  it("renders a select for string with enum values", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        color: { type: "string", title: "Color", enum: ["red", "green", "blue"] },
      },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    expect(screen.getByRole("combobox", { name: /color/i })).toBeDefined();
    expect(screen.getByRole("option", { name: "red" })).toBeDefined();
    expect(screen.getByRole("option", { name: "green" })).toBeDefined();
    expect(screen.getByRole("option", { name: "blue" })).toBeDefined();
  });

  it("renders nested fields for object type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          title: "Address",
          properties: {
            street: { type: "string", title: "Street" },
            city: { type: "string", title: "City" },
          },
        },
      },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    expect(screen.getByLabelText(/street/i)).toBeDefined();
    expect(screen.getByLabelText(/city/i)).toBeDefined();
  });

  it("renders array field with an Add button", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        tags: { type: "array", title: "Tags", items: { type: "string" } },
      },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: /add/i })).toBeDefined();
  });

  it("adds a new array item when Add is clicked", async () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        tags: { type: "array", title: "Tags", items: { type: "string" } },
      },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    const addBtn = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for required string field left empty", async () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["username"],
      properties: { username: { type: "string", title: "Username" } },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with correct typed values when form is valid", async () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["label"],
      properties: {
        label: { type: "string", title: "Label" },
        count: { type: "number", title: "Count" },
        active: { type: "boolean", title: "Active" },
      },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: "hello" } });
    fireEvent.change(screen.getByLabelText(/count/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /active/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ label: "hello", count: 42, active: true }),
      );
    });
  });

  it("coerces required number field to numeric type on submit", async () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["port"],
      properties: { port: { type: "number", title: "Port" } },
    };
    render(<SchemaFormRenderer schema={schema} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/port/i), { target: { value: "8080" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ port: 8080 }));
    });
  });

  it("populates fields with defaultValues", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { title: { type: "string", title: "Title" } },
    };
    render(
      <SchemaFormRenderer
        schema={schema}
        onSubmit={onSubmit}
        defaultValues={{ title: "Pre-filled" }}
      />,
    );
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("Pre-filled");
  });
});
