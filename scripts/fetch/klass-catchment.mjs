import { klassCodes, klassCorrespondence } from "../lib/klass.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";
import { RHF_TO_REGION, PRIVATE_RHF } from "../lib/regions.mjs";

function areasByCode(codes) {
  return Object.fromEntries(codes.filter((c) => c.level === 3).map((c) => [c.code, c]));
}

/**
 * area → { kommune → antall nivå-4-koder }. Nivå 4 er av to slag: 8 sifre = grunnkrets
 * (kommunen er de fire første sifrene), 4 sifre = postnummer, som i KLASS 632 alltid heter
 * "<Kommune> (postnummer)" (Trondheim og Kristiansand). Et postnummer er *ikke* en kommunekode
 * – 4611–4647 er Vestland-kommuner – så kommunen slås opp på navnet. Begge slag teller 1.
 */
function coverage(codes, municipalities) {
  const byName = new Map(municipalities.map((m) => [m.municipality_name.toLowerCase(), m.municipality_code]));
  const cov = {};
  for (const c of codes) {
    if (c.level !== 4) continue;
    let kommune = c.code.slice(0, 4);
    if (c.code.length === 4) {
      kommune = byName.get(String(c.name).replace(/\s*\(postnummer\)\s*$/i, "").trim().toLowerCase());
      if (!kommune) throw new Error(`[ssb_klass_opptak] postnummer-kode ${c.code} «${c.name}» kan ikke knyttes til en kommune`);
    }
    ((cov[c.parentCode] ??= {})[kommune] ??= 0);
    cov[c.parentCode][kommune] += 1;
  }
  return cov;
}

function pickArea(kommune, candidates, areas, cov) {
  if (candidates.length === 0) return { id: "", note: null, split: false };
  if (candidates.length === 1) return { id: candidates[0], note: null, split: false };
  const scored = candidates
    .map((id) => ({ id, n: cov[id]?.[kommune] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const desc = scored.map((s) => `${s.id} ${areas[s.id]?.name ?? ""} (${s.n})`).join(", ");
  return { id: scored[0].id, note: desc, split: true };
}

export function buildCatchment({ codes629, codes632, corr2688, corr2690, municipalities }) {
  const sAreas = areasByCode(codes629);
  const dAreas = areasByCode(codes632);

  // Validate that all correspondence codes exist in their respective area maps
  for (const m of corr2688) {
    if (!sAreas[m.sourceCode]) {
      throw new Error(`[ssb_klass_opptak] ukjent områdekode ${m.sourceCode} i korrespondansetabellen`);
    }
  }
  for (const m of corr2690) {
    if (!dAreas[m.sourceCode]) {
      throw new Error(`[ssb_klass_opptak] ukjent områdekode ${m.sourceCode} i korrespondansetabellen`);
    }
  }

  const opptaksomrader = [
    ...Object.values(sAreas).map((a) => ({ omrade_id: a.code, omrade_navn: a.name, omrade_type: "lokalsykehus", hf_id: a.parentCode })),
    ...Object.values(dAreas).map((a) => ({ omrade_id: a.code, omrade_navn: a.name, omrade_type: "dps", hf_id: a.parentCode })),
  ];
  const sCov = coverage(codes629, municipalities);
  const dCov = coverage(codes632, municipalities);
  const sCand = {};
  for (const m of corr2688) (sCand[m.targetCode] ??= []).push(m.sourceCode);
  const dCand = {};
  for (const m of corr2690) (dCand[m.targetCode] ??= []).push(m.sourceCode);
  const hfParent = Object.fromEntries(codes629.filter((c) => c.level === 2).map((c) => [c.code, c.parentCode]));

  const catchment = municipalities.map((m) => {
    const k = m.municipality_code;
    const s = pickArea(k, sCand[k] ?? [], sAreas, sCov);
    const d = pickArea(k, dCand[k] ?? [], dAreas, dCov);
    const notes = [];
    if (!s.id) notes.push("Ikke i KLASS 2688");
    if (s.split) notes.push(`Delt lokalsykehus: ${s.note}`);
    if (!d.id) notes.push("Ikke i KLASS 2690");
    if (d.split) notes.push(`Delt DPS: ${d.note}`);
    const hf_id = s.id ? sAreas[s.id].parentCode : "";

    // Validate that the HF maps to a known region
    let helseregion = "";
    if (hf_id) {
      const rhf = hfParent[hf_id] ?? PRIVATE_RHF[hf_id];
      if (!rhf) {
        throw new Error(`[ssb_klass_opptak] ukjent helseregion for helseforetak ${hf_id} (område ${s.id})`);
      }
      helseregion = RHF_TO_REGION[rhf] ?? "";
      if (!helseregion) {
        throw new Error(`[ssb_klass_opptak] ukjent helseregion for helseforetak ${hf_id} (område ${s.id})`);
      }
    }

    return {
      municipality_code: k,
      municipality_name: m.municipality_name,
      lokalsykehus_id: s.id,
      dps_id: d.id,
      hf_id,
      helseregion,
      quality: notes.length === 0 ? "ekte" : "avledet",
      note: notes.join("; "),
    };
  });
  return { opptaksomrader, catchment };
}

const def = {
  meta: {
    id: "ssb_klass_opptak",
    navn: "SSB KLASS 629 lokalsykehusområder og 632 DPS-områder med korrespondanse til kommune (2688, 2690)",
    url: "https://www.ssb.no/klass/klassifikasjoner/629",
    api_url: "https://data.ssb.no/api/klass/v1/classifications/629/codes",
    lisens: "NLOD 2.0",
  },
  async fetchRaw(deps) {
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows;
    return {
      codes629: await klassCodes(629, deps),
      codes632: await klassCodes(632, deps),
      corr2688: await klassCorrespondence(2688, deps),
      corr2690: await klassCorrespondence(2690, deps),
      municipalities,
    };
  },
  transform(raw) {
    const { opptaksomrader, catchment } = buildCatchment(raw);
    return { "opptaksomrader.csv": opptaksomrader, "municipality_catchment.csv": catchment };
  },
  columns: {
    "opptaksomrader.csv": ["omrade_id", "omrade_navn", "omrade_type", "hf_id"],
    "municipality_catchment.csv": ["municipality_code", "municipality_name", "lokalsykehus_id", "dps_id", "hf_id", "helseregion", "quality", "note"],
  },
};
export default def;
