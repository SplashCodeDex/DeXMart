"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { z } from "zod";

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
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
      const reqSet = new Set(schema.required ?? []);
      const shape = Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, v]) => [
          k,
          buildZodSchema(v, reqSet.has(k)),
        ]),
      );
      return z.object(shape);
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

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: { ...schemaDefaults, ...defaultValues },
  });

  const properties = schema.properties ?? {};

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data as Record<string, unknown>))} noValidate>
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
