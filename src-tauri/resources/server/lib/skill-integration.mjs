import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const SKILL_INTEGRATION_SCHEMA_VERSION = 1;

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_RISKS = new Set(["read"]);
const SAFE_CONNECTIONS = new Set(["vhome"]);
const TEMPLATE_VARIABLES = new Set(["date", "time", "lastRunAt", "taskName"]);
const SAFE_RECIPE_TOOLS = new Set(["organize_documents_to_report"]);
const SAFE_RECIPE_CARDINALITIES = new Set(["multiple"]);
const SAFE_RECIPE_FORMATS = new Set(["pdf", "word", "spreadsheet", "presentation", "html", "markdown", "csv", "text"]);
const SAFE_RECIPE_PERMISSIONS = new Set(["read-source", "write-output"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function versionParts(value) {
  const match = String(value ?? "").trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match ? match.slice(1, 4).map((part) => Number(part || 0)) : null;
}

export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function validateSkillIntegration(manifest, templatesFile, options = {}) {
  const expectedId = options.expectedId ?? null;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("integration.json must contain an object");
  if (manifest.schemaVersion !== SKILL_INTEGRATION_SCHEMA_VERSION) throw new Error(`unsupported integration schemaVersion: ${manifest.schemaVersion}`);
  if (!SAFE_ID.test(manifest.id ?? "")) throw new Error("integration id must use lowercase letters, digits and hyphens");
  if (expectedId && manifest.id !== expectedId) throw new Error(`integration id ${manifest.id} does not match skill ${expectedId}`);
  if (manifest.integrationApiVersion !== 1) throw new Error(`unsupported integrationApiVersion: ${manifest.integrationApiVersion}`);
  if (typeof manifest.version !== "string" || !versionParts(manifest.version)) throw new Error("integration version must be a numeric version string");

  const requirements = manifest.runtimeRequirements && typeof manifest.runtimeRequirements === "object"
    ? manifest.runtimeRequirements
    : {};
  for (const [runtime, requirement] of Object.entries(requirements)) {
    if (!SAFE_ID.test(runtime) || !requirement || typeof requirement.minVersion !== "string" || !versionParts(requirement.minVersion)) {
      throw new Error(`invalid runtime requirement: ${runtime}`);
    }
  }

  if (!templatesFile || typeof templatesFile !== "object" || Array.isArray(templatesFile)) throw new Error("schedule-templates.json must contain an object");
  if (templatesFile.schemaVersion !== SKILL_INTEGRATION_SCHEMA_VERSION) throw new Error(`unsupported schedule template schemaVersion: ${templatesFile.schemaVersion}`);
  if (templatesFile.integration !== manifest.id) throw new Error("schedule template integration does not match integration.json");
  if (!Array.isArray(templatesFile.templates)) throw new Error("schedule templates must be an array");

  const seen = new Set();
  const templates = templatesFile.templates.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("each schedule template must be an object");
    const id = String(raw.id ?? "").trim();
    if (!SAFE_ID.test(id) || seen.has(id)) throw new Error(`invalid or duplicate schedule template id: ${id}`);
    seen.add(id);
    const title = String(raw.title ?? "").trim();
    const description = String(raw.description ?? "").trim();
    const task = String(raw.task ?? "").trim();
    if (!title || title.length > 80) throw new Error(`schedule template ${id} must have a title of at most 80 characters`);
    if (!description || description.length > 240) throw new Error(`schedule template ${id} must have a description of at most 240 characters`);
    if (!task || task.length > 4000) throw new Error(`schedule template ${id} must have a task of at most 4000 characters`);
    if (!SAFE_RISKS.has(raw.risk)) throw new Error(`schedule template ${id} has unsupported risk: ${raw.risk}`);
    if (raw.scheduleAllowed !== true) throw new Error(`schedule template ${id} must explicitly allow scheduling`);
    const requiresConnection = raw.requiresConnection == null ? null : String(raw.requiresConnection);
    if (requiresConnection && !SAFE_CONNECTIONS.has(requiresConnection)) throw new Error(`schedule template ${id} has unsupported connection: ${requiresConnection}`);
    for (const variable of task.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)) {
      if (!TEMPLATE_VARIABLES.has(variable[1])) throw new Error(`schedule template ${id} uses unsupported variable: ${variable[1]}`);
    }
    return { id, title, description, task, risk: raw.risk, scheduleAllowed: true, requiresConnection };
  });

  const recipesFile = options.recipesFile == null ? null : options.recipesFile;
  const recipes = [];
  if (recipesFile != null) {
    if (!recipesFile || typeof recipesFile !== "object" || Array.isArray(recipesFile)) throw new Error("task-recipes.json must contain an object");
    if (recipesFile.schemaVersion !== SKILL_INTEGRATION_SCHEMA_VERSION) throw new Error(`unsupported task recipe schemaVersion: ${recipesFile.schemaVersion}`);
    if (recipesFile.integration !== manifest.id) throw new Error("task recipe integration does not match integration.json");
    if (!Array.isArray(recipesFile.recipes)) throw new Error("task recipes must be an array");
    const recipeIds = new Set();
    for (const raw of recipesFile.recipes) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("each task recipe must be an object");
      const id = String(raw.id ?? "").trim();
      if (!SAFE_ID.test(id) || recipeIds.has(id)) throw new Error(`invalid or duplicate task recipe id: ${id}`);
      recipeIds.add(id);
      const title = String(raw.title ?? "").trim();
      const description = String(raw.description ?? "").trim();
      const version = Number(raw.version);
      const tool = String(raw.tool ?? "").trim();
      const cardinality = String(raw.inputCardinality ?? "").trim();
      if (!title || title.length > 80 || !description || description.length > 240) throw new Error(`task recipe ${id} has invalid title or description`);
      if (!Number.isSafeInteger(version) || version < 1) throw new Error(`task recipe ${id} version must be a positive integer`);
      if (!SAFE_RECIPE_TOOLS.has(tool)) throw new Error(`task recipe ${id} has unsupported tool: ${tool}`);
      if (!SAFE_RECIPE_CARDINALITIES.has(cardinality)) throw new Error(`task recipe ${id} has unsupported inputCardinality: ${cardinality}`);
      if (cardinality === "multiple" && tool !== "organize_documents_to_report") throw new Error(`multiple task recipe ${id} must use organize_documents_to_report`);
      if (raw.hostManaged !== true || raw.resumable !== true) throw new Error(`task recipe ${id} must be hostManaged and resumable`);
      const formats = Array.isArray(raw.formats) ? [...new Set(raw.formats.map((item) => String(item).trim()))] : [];
      if (formats.length === 0 || formats.some((format) => !SAFE_RECIPE_FORMATS.has(format))) throw new Error(`task recipe ${id} has unsupported formats`);
      const phases = Array.isArray(raw.phases) ? [...new Set(raw.phases.map((item) => String(item).trim()))] : [];
      if (phases.length === 0 || phases.some((phase) => !SAFE_ID.test(phase))) throw new Error(`task recipe ${id} has invalid phases`);
      const permissions = Array.isArray(raw.permissions) ? [...new Set(raw.permissions.map((item) => String(item).trim()))] : [];
      if (permissions.some((permission) => !SAFE_RECIPE_PERMISSIONS.has(permission))) throw new Error(`task recipe ${id} has unsupported permissions`);
      const completionContract = String(raw.completionContract ?? "").trim();
      if (!completionContract || completionContract.length > 120) throw new Error(`task recipe ${id} must declare completionContract`);
      recipes.push({ id, title, description, version, tool, inputCardinality: cardinality, formats, phases, permissions, completionContract, hostManaged: true, resumable: true });
    }
  }

  return {
    id: manifest.id,
    displayName: String(manifest.displayName ?? manifest.id).trim().slice(0, 80) || manifest.id,
    version: manifest.version,
    capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities.filter((item) => SAFE_ID.test(item)).slice(0, 64) : [],
    requirements,
    templates,
    recipes,
  };
}

function compatibility(integration, runtimeVersions = {}) {
  for (const [runtime, requirement] of Object.entries(integration.requirements)) {
    const actual = runtimeVersions[runtime];
    const comparison = actual ? compareVersions(actual, requirement.minVersion) : null;
    if (comparison === null) return { compatible: false, reason: `${runtime} runtime version is unavailable` };
    if (comparison < 0) return { compatible: false, reason: `${runtime} ${actual} is older than required ${requirement.minVersion}` };
  }
  return { compatible: true, reason: null };
}

export function readRuntimeVersions(manifestPath) {
  try {
    const manifest = readJson(manifestPath);
    const versions = {};
    for (const artifact of Array.isArray(manifest?.artifacts) ? manifest.artifacts : []) {
      const name = String(artifact?.path ?? "").split(/[\\/]/).pop()?.replace(/\.exe$/i, "");
      if (name && typeof artifact.version === "string") versions[name] = artifact.version;
    }
    return versions;
  } catch {
    return {};
  }
}

export function loadSkillIntegrations(skillsRoot, options = {}) {
  if (!existsSync(skillsRoot)) return [];
  const integrations = [];
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !SAFE_ID.test(entry.name)) continue;
    const skillDir = resolve(skillsRoot, entry.name);
    const manifestPath = resolve(skillDir, "integration.json");
    const templatesPath = resolve(skillDir, "schedule-templates.json");
    const recipesPath = resolve(skillDir, "task-recipes.json");
    if (!existsSync(manifestPath) || !existsSync(templatesPath)) continue;
    try {
      const integration = validateSkillIntegration(readJson(manifestPath), readJson(templatesPath), {
        expectedId: entry.name,
        recipesFile: existsSync(recipesPath) ? readJson(recipesPath) : null,
      });
      integrations.push({ ...integration, ...compatibility(integration, options.runtimeVersions) });
    } catch (error) {
      integrations.push({ id: entry.name, displayName: entry.name, version: null, capabilities: [], templates: [], recipes: [], compatible: false, reason: error.message });
    }
  }
  return integrations.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function resolveSkillTaskRecipe(skillsRoot, skillName, recipeId, options = {}) {
  const integration = loadSkillIntegrations(skillsRoot, options).find((item) => item.id === skillName);
  if (!integration) throw new Error(`skill integration is unavailable: ${skillName}`);
  if (!integration.compatible) throw new Error(`skill integration ${skillName} is incompatible: ${integration.reason}`);
  const recipe = (integration.recipes ?? []).find((item) => item.id === recipeId);
  if (!recipe) throw new Error(`skill task recipe is unavailable: ${skillName}/${recipeId}`);
  return { integration, recipe };
}

export function resolveSkillScheduleTemplate(skillsRoot, skillName, action, options = {}) {
  const integration = loadSkillIntegrations(skillsRoot, options).find((item) => item.id === skillName);
  if (!integration) throw new Error(`skill integration is unavailable: ${skillName}`);
  if (!integration.compatible) throw new Error(`skill integration ${skillName} is incompatible: ${integration.reason}`);
  const template = integration.templates.find((item) => item.id === action);
  if (!template) throw new Error(`skill schedule template is unavailable: ${skillName}/${action}`);
  return { integration, template };
}

export function renderSkillScheduleTask(template, variables = {}, addendum = "") {
  let task = template.task;
  for (const key of TEMPLATE_VARIABLES) task = task.replaceAll(`{${key}}`, String(variables[key] ?? ""));
  const extra = String(addendum ?? "").trim().slice(0, 2000);
  return extra ? `${task}\n\n用户补充要求：\n${extra}` : task;
}
