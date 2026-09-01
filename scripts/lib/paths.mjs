import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const RAW_DIR = join(ROOT, "data", "raw");
export const NORMALIZED_DIR = join(ROOT, "data", "normalized");
export const SOURCES_DIR = join(ROOT, "data", "sources");
export const UNITS_DIR = join(ROOT, "apps", "web", "public", "data", "units");

export const normalized = (name) => join(NORMALIZED_DIR, name);
export const raw = (name) => join(RAW_DIR, name);
