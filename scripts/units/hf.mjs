import { nest, tall, byPeriod, unitId, ref, sok, groupBy, seriesBlock, patientsBlock } from "./common.mjs";
import { REGION_NAMES } from "../lib/regions.mjs";

const t = (tables, f) => tables[f] ?? [];
const byCol = (rows, col, v) => rows.filter((r) => r[col] === v);
const nameMap = (rows, idCol, nameCol) => new Map(rows.map((r) => [r[idCol], r[nameCol]]));

/** Latest period per kategori, provenance columns kept on the Tall. */
export function bedsBlock(bedRows) {
  const out = {};
  for (const [kategori, list] of groupBy(bedRows, "kategori")) {
    const r = list.reduce((a, b) => (b.period > a.period ? b : a));
    out[kategori] = { value: Number(r.senger), unit: "senger", period: r.period, quality: r.quality, source_id: r.source_id, source_url: r.source_url, source_note: r.source_note, last_verified: r.last_verified };
  }
  return out;
}

export function buildSiteUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const muniName = nameMap(t(tables, "municipalities.csv"), "municipality_code", "municipality_name");
  const areaName = nameMap(t(tables, "opptaksomrader.csv"), "omrade_id", "omrade_navn");
  const beds = groupBy(t(tables, "hospital_beds.csv"), "site_id");
  return t(tables, "sites.csv").map((s) => {
    const id = unitId("behandlingssted", s.site_id);
    const pop = t(tables, "catchment_population.csv").filter((r) => r.omrade_id === s.lokalsykehus_id && r.tjenesteomrade === "SOM" && r.aldersgruppe === "alle").sort(byPeriod);
    return {
      id, navn: s.site_navn, type: "behandlingssted",
      parent_ids: [unitId("helseforetak", s.hf_id), unitId("kommune", s.municipality_code)],
      sok: sok(s.site_navn, s.site_id, muniName.get(s.municipality_code)),
      fakta: {
        id, navn: s.site_navn, type: "behandlingssted",
        hf: ref("helseforetak", s.hf_id, hfName.get(s.hf_id)),
        kommune: ref("kommune", s.municipality_code, muniName.get(s.municipality_code)),
        lat: Number(s.lat), lon: Number(s.lon), site_type: s.site_type, akuttfunksjon: s.akuttfunksjon,
        senger: bedsBlock(beds.get(s.site_id) ?? []),
        opptaksomrade: s.lokalsykehus_id
          ? { ...ref("opptaksomrade", s.lokalsykehus_id, areaName.get(s.lokalsykehus_id)), befolkning_alle: pop.length ? tall(pop[pop.length - 1]) : null }
          : null,
      },
    };
  });
}

export function buildHfUnits(tables) {
  const sites = buildSiteUnits(tables);
  const activity = groupBy(t(tables, "hf_activity.csv"), "hf_id");
  const staffing = groupBy(t(tables, "hf_staffing.csv"), "hf_id");
  const specialists = groupBy(t(tables, "hf_specialists.csv"), "hf_id");
  const population = groupBy(t(tables, "catchment_population.csv"), "omrade_id");
  const areas = groupBy(t(tables, "opptaksomrader.csv"), "hf_id");
  const kommuner = groupBy(t(tables, "municipality_catchment.csv"), "hf_id");
  return t(tables, "helseforetak.csv").map((h) => {
    const id = unitId("helseforetak", h.hf_id);
    return {
      id, navn: h.hf_navn, type: "helseforetak",
      parent_ids: h.helseregion ? [unitId("helseregion", h.helseregion)] : [],
      sok: sok(h.hf_navn, h.hf_id),
      fakta: {
        id, navn: h.hf_navn, type: "helseforetak", hf_type: h.type,
        helseregion: h.helseregion ? ref("helseregion", h.helseregion, REGION_NAMES[h.helseregion]) : null,
        aktivitet: nest(activity.get(h.hf_id) ?? [], ["tjenesteomrade", "metric"]),
        arsverk: seriesBlock(staffing.get(h.hf_id) ?? [], "yrkesgruppe_kode", "yrkesgruppe"),
        spesialister: seriesBlock(specialists.get(h.hf_id) ?? [], "spesialitet_kode", "spesialitet"),
        befolkning: nest(population.get(h.hf_id) ?? [], ["tjenesteomrade", "aldersgruppe"]),
        opptaksomrader: (areas.get(h.hf_id) ?? []).map((a) => ({ ...ref("opptaksomrade", a.omrade_id, a.omrade_navn), type: a.omrade_type })),
        kommuner: (kommuner.get(h.hf_id) ?? []).map((k) => ref("kommune", k.municipality_code, k.municipality_name)),
        behandlingssteder: sites.filter((s) => s.fakta.hf.id === id).map((s) => ({ id: s.id, navn: s.navn, senger: s.fakta.senger })),
      },
    };
  });
}

/** land:H00 + the four helseregioner. hf_activity/catchment_population use H-codes; the patients tables use "0" for the country. */
export function buildRegionUnits(tables) {
  const hfs = t(tables, "helseforetak.csv");
  const defs = [["H00", "Hele landet", "land", [], "norge"], ...Object.entries(REGION_NAMES).map(([c, n]) => [c, n, "helseregion", [unitId("land", "H00")], n.replace("Helse ", "")])];
  return defs.map(([code, navn, type, parent_ids, alias]) => {
    const id = unitId(type, code);
    const regionId = code === "H00" ? "0" : code;
    return {
      id, navn, type, parent_ids, sok: sok(navn, code, alias),
      fakta: {
        id, navn, type,
        aktivitet: nest(byCol(t(tables, "hf_activity.csv"), "hf_id", code), ["tjenesteomrade", "metric"]),
        befolkning: nest(byCol(t(tables, "catchment_population.csv"), "omrade_id", code), ["tjenesteomrade", "aldersgruppe"]),
        pasienter: patientsBlock(byCol(t(tables, "patients_by_diagnosis.csv"), "region_id", regionId), byCol(t(tables, "patients_by_diagnosis_detail.csv"), "region_id", regionId)),
        helseforetak: (type === "land" ? hfs : hfs.filter((h) => h.helseregion === code)).map((h) => ({ ...ref("helseforetak", h.hf_id, h.hf_navn), type: h.type })),
      },
    };
  });
}
