import { nest, unitId, ref, sok, sumRows, groupBy, seriesBlock, patientsBlock } from "./common.mjs";
import { REGION_NAMES } from "../lib/regions.mjs";

const t = (tables, f) => tables[f] ?? [];
const byCol = (rows, col, v) => rows.filter((r) => r[col] === v);
const nameMap = (rows, idCol, nameCol) => new Map(rows.map((r) => [r[idCol], r[nameCol]]));

export function buildOpptaksomradeUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const population = groupBy(t(tables, "catchment_population.csv"), "omrade_id");
  const catchment = t(tables, "municipality_catchment.csv");
  const sites = t(tables, "sites.csv");
  return t(tables, "opptaksomrader.csv").map((a) => {
    const id = unitId("opptaksomrade", a.omrade_id);
    const col = a.omrade_type === "dps" ? "dps_id" : "lokalsykehus_id";
    const site = sites.find((s) => s.lokalsykehus_id === a.omrade_id);
    return {
      id, navn: a.omrade_navn, type: "opptaksomrade", parent_ids: [unitId("helseforetak", a.hf_id)], sok: sok(a.omrade_navn, a.omrade_id),
      fakta: {
        id, navn: a.omrade_navn, type: "opptaksomrade", omrade_type: a.omrade_type,
        hf: ref("helseforetak", a.hf_id, hfName.get(a.hf_id)),
        befolkning: nest(population.get(a.omrade_id) ?? [], ["tjenesteomrade", "aldersgruppe"]),
        kommuner: byCol(catchment, col, a.omrade_id).map((k) => ({ ...ref("kommune", k.municipality_code, k.municipality_name), quality: k.quality })),
        behandlingssted: site ? ref("behandlingssted", site.site_id, site.site_navn) : null,
      },
    };
  });
}

export function buildFylkeUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const popBy = groupBy(t(tables, "municipal_population.csv"), "municipality_code");
  const catchBy = groupBy(t(tables, "municipality_catchment.csv"), "municipality_code");
  return [...groupBy(t(tables, "municipalities.csv"), "county_code")].map(([code, list]) => {
    const id = unitId("fylke", code);
    const navn = list[0].county_name;
    const pop = list.flatMap((m) => popBy.get(m.municipality_code) ?? []);
    const hfCount = groupBy(list.flatMap((m) => catchBy.get(m.municipality_code) ?? []), "hf_id");
    return {
      id, navn, type: "fylke", parent_ids: [unitId("land", "H00")], sok: sok(navn, code),
      fakta: {
        id, navn, type: "fylke",
        befolkning: nest(sumRows(pop, ["aldersgruppe", "period"]), ["aldersgruppe"]),
        pasienter: patientsBlock(byCol(t(tables, "patients_by_diagnosis.csv"), "region_id", code), byCol(t(tables, "patients_by_diagnosis_detail.csv"), "region_id", code)),
        kommuner: list.map((m) => ref("kommune", m.municipality_code, m.municipality_name)),
        helseforetak: [...hfCount].filter(([hf]) => hf).map(([hf, rows]) => ({ ...ref("helseforetak", hf, hfName.get(hf)), antall_kommuner: rows.length })),
      },
    };
  });
}

export function buildKommuneUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const areaName = nameMap(t(tables, "opptaksomrader.csv"), "omrade_id", "omrade_navn");
  const catchBy = new Map(t(tables, "municipality_catchment.csv").map((r) => [r.municipality_code, r]));
  const popBy = groupBy(t(tables, "municipal_population.csv"), "municipality_code");
  const capBy = groupBy(t(tables, "municipal_capacity.csv"), "municipality_code");
  const needBy = groupBy(t(tables, "municipal_needs.csv"), "municipality_code");
  return t(tables, "municipalities.csv").map((m) => {
    const code = m.municipality_code;
    const id = unitId("kommune", code);
    const c = catchBy.get(code);
    const parent_ids = [unitId("fylke", m.county_code)];
    if (c) for (const [type, v] of [["opptaksomrade", c.lokalsykehus_id], ["opptaksomrade", c.dps_id], ["helseforetak", c.hf_id]]) if (v) parent_ids.push(unitId(type, v));
    return {
      id, navn: m.municipality_name, type: "kommune", parent_ids, sok: sok(m.municipality_name, code),
      fakta: {
        id, navn: m.municipality_name, type: "kommune",
        fylke: ref("fylke", m.county_code, m.county_name),
        tilhorighet: c ? {
          lokalsykehus: c.lokalsykehus_id ? ref("opptaksomrade", c.lokalsykehus_id, areaName.get(c.lokalsykehus_id)) : null,
          dps: c.dps_id ? ref("opptaksomrade", c.dps_id, areaName.get(c.dps_id)) : null,
          hf: c.hf_id ? ref("helseforetak", c.hf_id, hfName.get(c.hf_id)) : null,
          helseregion: c.helseregion ? ref("helseregion", c.helseregion, REGION_NAMES[c.helseregion]) : null,
          quality: c.quality, note: c.note,
        } : null,
        befolkning: nest(popBy.get(code) ?? [], ["aldersgruppe"]),
        kapasitet: seriesBlock(capBy.get(code) ?? [], "metric", "metric_label"),
        behov: seriesBlock(needBy.get(code) ?? [], "metric", "metric_label"),
      },
    };
  });
}
