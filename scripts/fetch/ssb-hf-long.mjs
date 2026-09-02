import { ssbQuery, all, item } from "../lib/ssb.mjs";
import { klassCodes } from "../lib/klass.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { RHF_TO_REGION, PRIVATE_RHF, NATIONAL_HF, isOrgNr, regionPrefix, stripPeriodSuffix } from "../lib/regions.mjs";

/** hf org.nr → helseregion from KLASS 629 level 2 plus PRIVATE_RHF. Shared by 13953/14080. */
export async function fetchHfRegion(deps) {
  const klass = await klassCodes(629, { level: 2, ...deps });
  const map = Object.fromEntries(klass.map((c) => [c.code, RHF_TO_REGION[c.parentCode]]));
  for (const [org, rhf] of Object.entries(PRIVATE_RHF)) map[org] ??= RHF_TO_REGION[rhf];
  return map;
}

const clean = (s) => stripPeriodSuffix(String(s).replaceAll(" ", " "));

export function makeHfLongFetcher({ id, tableId, navn, dim, dimCol, dimLabelCol, contentsCode, outFile }) {
  const columns = ["hf_id", "hf_navn", "helseregion", dimCol, dimLabelCol, "metric", "period", "value", "unit", "source_id", "quality"];
  const query = [all("HelseReg"), all(dim), item("HelseTjenomr", ["TOT"]), item("ContentsCode", [contentsCode]), all("Tid")];
  function transform({ dataset, hfRegion }) {
    const out = [];
    for (const r of jsonStatToRows(dataset)) {
      const code = r.HelseReg;
      let helseregion = "";
      if (isOrgNr(code)) {
        if (RHF_TO_REGION[code]) continue; // RHF total rows – the H.. rows already carry those
        if (NATIONAL_HF.has(code)) helseregion = ""; // felleseid støtteforetak – ingen enkelt helseregion
        else {
          helseregion = hfRegion[code];
          if (!helseregion) throw new Error(`[${id}] Org.nr ${code} i SSB ${tableId} finnes verken i KLASS 629 nivå 2 eller i PRIVATE_RHF`);
        }
      } else if (code.startsWith("H")) helseregion = regionPrefix(code);
      else throw new Error(`[${id}] Ukjent HelseReg-kode "${code}" i SSB ${tableId}`);
      out.push({
        hf_id: code, hf_navn: clean(r.HelseReg_label), helseregion, [dimCol]: r[dim], [dimLabelCol]: clean(r[`${dim}_label`]),
        metric: "arsverk", period: r.Tid, value: r.value, unit: "arsverk", source_id: id, quality: "ekte",
      });
    }
    return { [outFile]: out };
  }
  return {
    meta: { id, navn, url: `https://www.ssb.no/statbank/table/${tableId}`, api_url: `https://data.ssb.no/api/v0/no/table/${tableId}`, lisens: "NLOD 2.0", query },
    async fetchRaw(deps) {
      return { dataset: await ssbQuery(tableId, query, deps), hfRegion: await fetchHfRegion(deps) };
    },
    transform,
    columns: { [outFile]: columns },
  };
}
