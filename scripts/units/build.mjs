import { unitPath } from "./common.mjs";
import { buildRegionUnits, buildHfUnits, buildSiteUnits } from "./hf.mjs";
import { buildOpptaksomradeUnits, buildFylkeUnits, buildKommuneUnits } from "./geo.mjs";

export function buildUnits(tables, { today }) {
  const units = [
    ...buildRegionUnits(tables), ...buildHfUnits(tables), ...buildSiteUnits(tables),
    ...buildOpptaksomradeUnits(tables), ...buildFylkeUnits(tables), ...buildKommuneUnits(tables),
  ];
  const ids = new Set();
  for (const u of units) { if (ids.has(u.id)) throw new Error(`Duplikat enhets-id ${u.id}`); ids.add(u.id); }
  for (const u of units) for (const p of u.parent_ids) if (!ids.has(p)) throw new Error(`${u.id} peker på ukjent forelder ${p}`);
  return {
    index: { generated: today, units: units.map(({ id, navn, type, parent_ids, sok }) => ({ id, navn, type, parent_ids, sok })) },
    files: Object.fromEntries(units.map((u) => [unitPath(u.id), u.fakta])),
  };
}
