"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { z } from "zod";

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema | boolean;
  items?: JsonSchema;
  enum?: string[];
  required?: string[];
  title?: string;
  description?: string;
};

interface SchemaFormRendererProps {
  schema: JsonSchema;
  defaultValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
}

function buildZodSchema(schema: JsonSchema, isRequired = false): z.ZodTypeAny {
  switch (schema.type) {
    case "string":
      if (schema.enum?.length) {
        const s = z.enum(schema.enum as [string, ...string[]]);
        return isRequired ? s : s.optional();
      }
      return isRequired ? z.string().min(1, "Required") : z.string().optional();
    case "number":
    case "integer": {
      const s = z.coerce.number();
      return isRequired ? s : s.optional();
    }
    case "boolean":
      return z.boolean().default(false);
    case "object": {
      if (schema.additionalProperties && !schema.properties) {
        const valSchema =
          typeof schema.additionalProperties === "object"
            ? buildZodSchema(schema.additionalProperties)
            : z.unknown();
        return z.record(z.string(), valSchema).default({});
      }
      const reqSet = new Set(schema.required ?? []);
      const shape = Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, v]) => [
          k,
          buildZodSchema(v, reqSet.has(k)),
        ]),
      );
      return z.object(shape).passthrough();
    }
    case "array": {
      const itemSchema = schema.items ? buildZodSchema(schema.items) : z.unknown();
      return z.array(itemSchema).default([]);
    }
    default:
      return z.unknown();
  }
}

function buildDefaultValues(schema: JsonSchema): unknown {
  switch (schema.type) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
    case "integer":
      return undefined;
    case "object":
      if (schema.additionalProperties && !schema.properties) {
        return {};
      }
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, v]) => [k, buildDefaultValues(v)]),
      );
    case "array":
      return [];
    default:
      return undefined;
  }
}

type FormValues = Record<string, unknown>;

function ArrayField({
  name,
  schema,
  control,
  register,
}: {
  name: string;
  schema: JsonSchema;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: name as never });
  const label = schema.title ?? name;

  return (
    <div className="mb-2">
      <p className="text-sm font-medium mb-1">{label}</p>
      <div className="flex flex-col gap-1">
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              type="text"
              {...register(`${name}.${idx}` as never)}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button type="button" onClick={() => remove(idx)} className="text-xs text-destructive">
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => append("" as never)}
        className="mt-1 text-xs text-primary"
        aria-label={`Add ${label}`}
      >
        Add {label}
      </button>
    </div>
  );
}

function MapField({
  name,
  schema,
  control,
  register,
}: {
  name: string;
  schema: JsonSchema;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `_map_${name}` as never,
  });
  const label = schema.title ?? name;

  return (
    <div className="mb-2 border rounded-md p-3">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex flex-col gap-2 mb-2">
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              placeholder="Key"
              {...register(`_map_${name}.${idx}.key` as never)}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
            <input
              placeholder="Value"
              {...register(`_map_${name}.${idx}.value` as never)}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
            <button type="button" onClick={() => remove(idx)} className="text-xs text-destructive">
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => append({ key: "", value: "" } as never)}
        className="text-xs text-primary"
        aria-label={`Add ${label}`}
      >
        Add {label}
      </button>
    </div>
  );
}

function FieldRenderer({
  name,
  schema,
  register,
  control,
  errors,
}: {
  name: string;
  schema: JsonSchema;
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors | undefined;
}) {
  const label = schema.title ?? name;
  const errorMessage = (errors as { message?: string } | undefined)?.message;

  if (schema.type === "array") {
    return <ArrayField name={name} schema={schema} control={control} register={register} />;
  }

  if (schema.type === "object" && schema.additionalProperties && !schema.properties) {
    return <MapField name={name} schema={schema} control={control} register={register} />;
  }

  if (schema.type === "object" && schema.properties) {
    return (
      <fieldset className="border rounded-md p-3 mb-2">
        <legend className="text-sm font-medium px-1">{label}</legend>
        {Object.entries(schema.properties).map(([key, propSchema]) => (
          <FieldRenderer
            key={key}
            name={`${name}.${key}`}
            schema={propSchema}
            register={register}
            control={control}
            errors={(errors as Record<string, FieldErrors> | undefined)?.[key]}
          />
        ))}
      </fieldset>
    );
  }

  if (schema.type === "boolean") {
    return (
      <div className="flex items-center gap-2 mb-2">
        <input id={name} type="checkbox" {...register(name as never)} className="h-4 w-4" />
        <label htmlFor={name} className="text-sm">
          {label}
        </label>
        {errorMessage ? (
          <span role="alert" className="text-xs text-destructive">
            {errorMessage}
          </span>
        ) : null}
      </div>
    );
  }

  if (schema.type === "string" && schema.enum?.length) {
    return (
      <div className="mb-2">
        <label htmlFor={name} className="block text-sm mb-1">
          {label}
        </label>
        <select
          id={name}
          aria-label={label}
          {...register(name as never)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {schema.enum.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {errorMessage ? (
          <span role="alert" className="text-xs text-destructive">
            {errorMessage}
          </span>
        ) : null}
      </div>
    );
  }

  const inputType = schema.type === "number" || schema.type === "integer" ? "number" : "text";

  return (
    <div className="mb-2">
      <label htmlFor={name} className="block text-sm mb-1">
        {label}
      </label>
      <input
        id={name}
        type={inputType}
        {...register(name as never)}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
      />
      {errorMessage ? (
        <span role="alert" className="text-xs text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}

export function SchemaFormRenderer({ schema, defaultValues, onSubmit }: SchemaFormRendererProps) {
  const zodSchema = buildZodSchema(schema) as z.ZodObject<z.ZodRawShape>;
  const schemaDefaults = buildDefaultValues(schema) as Record<string, unknown>;

  const initialValues = { ...schemaDefaults, ...defaultValues };

  // Transform incoming maps to _map_ internal representation
  const flattenedInitial = { ...initialValues };
  const findMaps = (s: JsonSchema, path: string, val: any) => {
    if (s.type === "object") {
      if (s.additionalProperties && !s.properties) {
        if (val && typeof val === "object") {
          flattenedInitial[`_map_${path}`] = Object.entries(val).map(([k, v]) => ({
            key: k,
            value: v,
          }));
        }
      } else if (s.properties) {
        Object.entries(s.properties).forEach(([k, ps]) => {
          findMaps(ps, path ? `${path}.${k}` : k, val?.[k]);
        });
      }
    }
  };
  findMaps(schema, "", initialValues);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: flattenedInitial,
  });

  const handleFormSubmit = (data: FormValues) => {
    const result = { ...data };
    Object.keys(data).forEach((key) => {
      if (key.startsWith("_map_")) {
        const originalName = key.slice(5);
        const entries = data[key] as { key: string; value: string }[];
        const map: Record<string, unknown> = {};
        entries.forEach((e) => {
          if (e.key) map[e.key] = e.value;
        });
        // Handle nested paths if necessary
        const parts = originalName.split(".");
        let target = result as any;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]!;
          if (!target[part]) target[part] = {};
          target = target[part];
        }
        const lastPart = parts[parts.length - 1]!;
        target[lastPart] = map;
        delete result[key];
      }
    });
    onSubmit(result);
  };

  const properties = schema.properties ?? {};

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      {Object.entries(properties).map(([key, propSchema]) => (
        <FieldRenderer
          key={key}
          name={key}
          schema={propSchema}
          register={register}
          control={control}
          errors={errors[key] as any}
        />
      ))}
      <button
        type="submit"
        className="mt-2 rounded-md px-4 py-2 text-sm bg-primary text-primary-foreground"
      >
        Submit
      </button>
    </form>
  );
}
