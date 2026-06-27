#!/usr/bin/env node
/**
 * Spaced-repetition concept tracker for /learn track.
 *
 * Stores a per-user concept library in ~/.visionox/learn-track.json and uses
 * the SM-2 algorithm to schedule reviews. The library is intentionally simple
 * (a single JSON file) so users can inspect, edit, and back it up easily.
 */

import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const TRACK_FILE = join(homedir(), ".visionox", "learn-track.json");

/**
 * @typedef {Object} Concept
 * @property {string} id
 * @property {string} name
 * @property {number} level 1=recognize, 2=understand, 3=apply, 4=analyze/evaluate, 5=architect
 * @property {number} ease SM-2 easiness factor
 * @property {number} interval current interval in days
 * @property {number} repetitions consecutive successful reviews
 * @property {string} nextReview ISO date string, next scheduled review
 * @property {string|null} lastReview ISO date string of last review
 * @property {string} source where it came from (skill, project, user, etc.)
 * @property {string} createdAt ISO date string
 * @property {string[]} [tags]
 */

function ensureTrackDir() {
  const dir = join(homedir(), ".visionox");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadLibrary() {
  ensureTrackDir();
  if (!existsSync(TRACK_FILE)) return { version: 1, concepts: [] };
  try {
    const raw = readFileSync(TRACK_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.concepts)) return { version: 1, concepts: [] };
    return parsed;
  } catch (err) {
    console.error(`[learn-track] failed to load library: ${err.message}`);
    return { version: 1, concepts: [] };
  }
}

function saveLibrary(lib) {
  ensureTrackDir();
  writeFileSync(TRACK_FILE, JSON.stringify(lib, null, 2), "utf8");
}

function saveLibraryAtomic(lib) {
  ensureTrackDir();
  const tmp = `${TRACK_FILE}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(lib, null, 2), "utf8");
  renameSync(tmp, TRACK_FILE);
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function clampEase(ease) {
  return Math.max(MIN_EASE, ease);
}

/**
 * SM-2 update.
 * @param {Concept} concept
 * @param {number} quality 0..5 (5=perfect, 4=correct with effort, 3=correct with hint, <3=forgot)
 * @returns {Concept}
 */
function sm2Update(concept, quality) {
  const q = Math.max(0, Math.min(5, Number(quality) || 0));
  let { ease, interval, repetitions } = concept;

  if (q >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  ease = clampEase(ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  const now = new Date();
  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ...concept,
    ease,
    interval,
    repetitions,
    lastReview: isoDate(now),
    nextReview: isoDate(nextReview),
  };
}

const QUALITY_MAP = {
  again: 0,
  hard: 2,
  good: 3,
  easy: 5,
  // aliases
  forgot: 0,
  struggle: 1,
  ok: 3,
  perfect: 5,
};

export class LearningConceptManager {
  constructor() {
    this.lib = loadLibrary();
  }

  _save() {
    saveLibraryAtomic(this.lib);
  }

  /**
   * Add a new concept.
   * @param {Object} opts
   * @param {string} opts.name
   * @param {number} [opts.level=1]
   * @param {string} [opts.source='user']
   * @param {string[]} [opts.tags=[]]
   * @returns {Concept}
   */
  addConcept({ name, level = 1, source = "user", tags = [] }) {
    const normalizedName = String(name).trim();
    if (!normalizedName) throw new Error("Concept name is required.");
    const existing = this.lib.concepts.find((c) => c.name.toLowerCase() === normalizedName.toLowerCase());
    if (existing) return existing;

    const today = isoDate();
    const concept = {
      id: randomUUID().slice(0, 8),
      name: normalizedName,
      level: Math.max(1, Math.min(5, Number(level) || 1)),
      ease: DEFAULT_EASE,
      interval: 1,
      repetitions: 0,
      nextReview: today,
      lastReview: null,
      source,
      createdAt: today,
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
    };
    this.lib.concepts.push(concept);
    this._save();
    return concept;
  }

  /**
   * Record a review for a concept.
   * @param {string} idOrName
   * @param {number|string} quality 0..5 or keyword (again/hard/good/easy)
   * @returns {Concept|null}
   */
  review(idOrName, quality) {
    const term = String(idOrName).trim().toLowerCase();
    const concept = this.lib.concepts.find(
      (c) => c.id.toLowerCase() === term || c.name.toLowerCase() === term
    );
    if (!concept) return null;

    const q = typeof quality === "number" ? quality : (QUALITY_MAP[quality] ?? 3);
    const updated = sm2Update(concept, q);
    Object.assign(concept, updated);
    this._save();
    return concept;
  }

  /**
   * Get concepts whose next review is today or earlier.
   */
  getDueConcepts() {
    const today = isoDate();
    return this.lib.concepts
      .filter((c) => c.nextReview <= today)
      .sort((a, b) => a.nextReview.localeCompare(b.nextReview) || b.level - a.level);
  }

  /**
   * Get most recently active concepts (reviewed or due), newest first.
   * @param {number} limit
   */
  getActiveConcepts(limit = 20) {
    const today = isoDate();
    return this.lib.concepts
      .filter((c) => c.lastReview || c.nextReview <= today)
      .sort((a, b) => {
        const ad = a.lastReview || a.nextReview;
        const bd = b.lastReview || b.nextReview;
        return bd.localeCompare(ad);
      })
      .slice(0, limit);
  }

  /**
   * Search concepts by name or tag.
   */
  findConcepts(query) {
    const q = String(query).toLowerCase();
    return this.lib.concepts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  getConcept(idOrName) {
    const term = String(idOrName).trim().toLowerCase();
    return this.lib.concepts.find(
      (c) => c.id.toLowerCase() === term || c.name.toLowerCase() === term
    );
  }

  getStats() {
    const today = isoDate();
    const total = this.lib.concepts.length;
    const due = this.lib.concepts.filter((c) => c.nextReview <= today).length;
    const levels = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let reviewed = 0;
    for (const c of this.lib.concepts) {
      levels[c.level] = (levels[c.level] || 0) + 1;
      if (c.lastReview) reviewed += 1;
    }
    const avgEase = total > 0
      ? this.lib.concepts.reduce((sum, c) => sum + c.ease, 0) / total
      : 0;
    return { total, due, reviewed, levels, avgEase: avgEase.toFixed(2) };
  }

  /**
   * Import concepts from an external list, e.g. extracted from a skill/project.
   */
  importConcepts(items, source = "import") {
    const added = [];
    for (const item of items) {
      if (!item?.name) continue;
      const c = this.addConcept({
        name: item.name,
        level: item.level ?? 1,
        source: item.source || source,
        tags: item.tags || [],
      });
      added.push(c);
    }
    return added;
  }

  listAll() {
    return this.lib.concepts;
  }
}

let _instance = null;
export function getConceptManager() {
  if (!_instance) _instance = new LearningConceptManager();
  return _instance;
}
