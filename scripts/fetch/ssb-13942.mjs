// scripts/fetch/ssb-13942.mjs
import { ssbQuery, all } from "../lib/ssb.mjs";
import { klassCodes } from "../lib/klass.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { RHF_TO_REGION, PRIVATE_RHF, isOrgNr, regionPrefix, stripPeriodSuffix } from "../lib/regions.mjs";

export const METRICS = {
  Dognplass: ["dognplasser", "senger"],
  Utskriv: ["utskrivninger", "antall"],
  Liggedag: ["liggedager", "dogn"],
  Polikliniske: ["polikliniske_konsultasjoner", "antall"],
  Dag: ["dagbehandlinger", "antall"],
  Sengedogn: ["sengedogn", "dogn"],
  BeleggSsb: ["beleggsprosent", "prosent"],
  BeleggOecd: ["beleggsprosent_oecd", "prosent"],
};

function rhfOf(orgnr, klassParent) {
  const rhf = klassParent[orgnr] ?? PRIVATE_RHF[orgnr];
  if (!rhf) throw new Error(`Org.nr ${orgnr} finnes verken i KLASS 629 nivå 2 eller i PRIVATE_RHF – legg den til i scripts/lib/regions.mjs`);
  return rhf;
}

export function transform13942({ dataset, klass }) {
  const klassParent = Object.fromEntries(klass.filter((c) => c.level === 2).map((c) => [c.code, c.parentCode]));
  const rows = jsonStatToRows(dataset);
  const activity = [];
  const hfs = new Map();
  for (const r of rows) {
    const m = METRICS[r.ContentsCode];
    if (!m) throw new Error(`Ukjent ContentsCode "${r.ContentsCode}" i SSB 13942 – oppdater METRICS`);
    const code = r.HelseReg;
    let helseregion = "";
    if (isOrgNr(code)) {
      const rhf = rhfOf(code, klassParent);
      helseregion = RHF_TO_REGION[rhf];
      if (!hfs.has(code)) {
        const navn = stripPeriodSuffix(r.HelseReg_label);
        hfs.set(code, { hf_id: code, hf_navn: navn, rhf_id: rhf, helseregion, type: /\bHF$/.test(navn) ? "hf" : "privat" });
      }
    } else if (code.startsWith("H")) helseregion = regionPrefix(code);
    else throw new Error(`Ukjent HelseReg-kode "${code}" i SSB 13942`);
    activity.push({
      hf_id: code, hf_navn: stripPeriodSuffix(r.HelseReg_label), helseregion, tjenesteomrade: r.HelseTjenomr,
      metric: m[0], period: r.Tid, value: r.value, unit: m[1], source_id: "ssb_13942", quality: "ekte",
    });
  }
  return { "hf_activity.csv": activity, "helseforetak.csv": [...hfs.values()] };
}

const def = {
  meta: {
    id: "ssb_13942",
    navn: "SSB 13942 Spesialisthelsetjenesten – døgnplasser, aktivitet og belegg etter helseforetak",
    url: "https://www.ssb.no/statbank/table/13942",
    api_url: "https://data.ssb.no/api/v0/no/table/13942",
    lisens: "NLOD 2.0",
    query: [all("HelseReg"), all("HelseTjenomr"), all("ContentsCode"), all("Tid")],
  },
  async fetchRaw(deps) {
    return { dataset: await ssbQuery("13942", def.meta.query, deps), klass: await klassCodes(629, { level: 2, ...deps }) };
  },
  transform: transform13942,
  columns: {
    "hf_activity.csv": ["hf_id", "hf_navn", "helseregion", "tjenesteomrade", "metric", "period", "value", "unit", "source_id", "quality"],
    "helseforetak.csv": ["hf_id", "hf_navn", "rhf_id", "helseregion", "type"],
  },
};
export default def;
