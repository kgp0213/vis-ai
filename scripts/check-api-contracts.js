#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function matchesType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

export function validateSchema(value, schema, path = "response") {
  const errors = [];
  if (schema.type && !matchesType(value, schema.type)) return [`${path} must be ${schema.type}`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} is not an allowed value`);
  if (schema.required && matchesType(value, "object")) {
    for (const key of schema.required) if (!(key in value)) errors.push(`${path}.${key} is required`);
  }
  if (schema.properties && matchesType(value, "object")) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (key in value) errors.push(...validateSchema(value[key], child, `${path}.${key}`));
    }
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)));
  }
  return errors;
}

export function assertApiContract(contracts, name, value) {
  const schema = contracts?.$defs?.[name];
  if (!schema) throw new Error(`unknown API contract: ${name}`);
  const errors = validateSchema(value, schema);
  if (errors.length) throw new Error(`${name} contract failed: ${errors.join("; ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const contracts = JSON.parse(readFileSync(join(root, "contracts", "api-responses.schema.json"), "utf8"));
  for (const name of ["overview", "health", "backups", "schedules", "providers"]) {
    if (!contracts.$defs?.[name]) throw new Error(`missing API contract: ${name}`);
  }
  console.log(`[api-contracts] ok: ${Object.keys(contracts.$defs).length} contracts`);
}
