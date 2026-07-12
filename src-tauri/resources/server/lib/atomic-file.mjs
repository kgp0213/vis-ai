import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

function siblingTempPath(target) {
  return resolve(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
}

export function atomicWriteFileSync(target, content, options = "utf8") {
  const temp = siblingTempPath(target);
  mkdirSync(dirname(target), { recursive: true });
  try {
    writeFileSync(temp, content, options);
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
}

export async function atomicWriteFile(target, content, options = "utf8") {
  const temp = siblingTempPath(target);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(temp, content, options);
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}
