import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

const REPLACE_RETRY_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);
const REPLACE_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 400];

function siblingTempPath(target) {
  return resolve(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
}

function retryableReplaceError(error) {
  return REPLACE_RETRY_CODES.has(String(error?.code || "").toUpperCase());
}

function sleepSync(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function replaceFileWithRetrySync(source, target, options = {}) {
  const renameFile = options.renameFile ?? renameSync;
  const delays = options.delays ?? REPLACE_RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      renameFile(source, target);
      return;
    } catch (error) {
      if (!retryableReplaceError(error) || attempt >= delays.length) throw error;
      sleepSync(Math.max(0, Number(delays[attempt]) || 0));
    }
  }
}

export async function replaceFileWithRetry(source, target, options = {}) {
  const renameFile = options.renameFile ?? rename;
  const delays = options.delays ?? REPLACE_RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      await renameFile(source, target);
      return;
    } catch (error) {
      if (!retryableReplaceError(error) || attempt >= delays.length) throw error;
      const waitMs = Math.max(0, Number(delays[attempt]) || 0);
      if (waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
    }
  }
}

export function atomicWriteFileSync(target, content, options = "utf8") {
  const temp = siblingTempPath(target);
  mkdirSync(dirname(target), { recursive: true });
  try {
    writeFileSync(temp, content, options);
    replaceFileWithRetrySync(temp, target);
  } finally {
    try { rmSync(temp, { force: true }); } catch { /* Preserve the replacement error. */ }
  }
}

export async function atomicWriteFile(target, content, options = "utf8") {
  const temp = siblingTempPath(target);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(temp, content, options);
    await replaceFileWithRetry(temp, target);
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}
