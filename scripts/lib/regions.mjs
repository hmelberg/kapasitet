// RHF org.nr → helseregion code used by SSB (H03 Vest, H04 Midt, H05 Nord, H12 Sør-Øst).
export const RHF_TO_REGION = {
  "883658752": "H05", // Helse Nord RHF
  "983658725": "H03", // Helse Vest RHF
  "983658776": "H04", // Helse Midt-Norge RHF
  "991324968": "H12", // Helse Sør-Øst RHF
};

export const REGION_NAMES = { H03: "Helse Vest", H04: "Helse Midt-Norge", H05: "Helse Nord", H12: "Helse Sør-Øst" };

// Private/ideal providers that appear in SSB 13942 but are not under an RHF in KLASS 629.
export const PRIVATE_RHF = {
  "916270097": "983658725", // Voss DPS NKS Bjørkeli
  "919865636": "983658725", // Solli DPS
  "922716552": "983658725", // Betanien sykehus (Bergen)
  "981275721": "991324968", // Betanien Hospital Skien
  "984027737": "983658725", // Haraldsplass Diakonale Sykehus
  "985773238": "991324968", // Revmatismesykehuset Lillehammer
  "985962170": "991324968", // Martina Hansens Hospital
  "986106839": "983658725", // Haugesund Sanitetsforenings Revmatismesykehus
  "987554401": "983658725", // NKS Olaviken alderspsykiatriske sykehus
  "996380041": "983658725", // NKS Jæren DPS
};

/** "Troms (2024-)" → "Troms"; "Troms (-2023)" → "Troms". */
export const stripPeriodSuffix = (label) => String(label).replace(/\s*\((\d{4})?-(\d{4})?\)\s*$/, "").trim();
export const isOrgNr = (code) => /^\d{9}$/.test(String(code));
export const isRegionCode = (code) => /^H\d\d$/.test(String(code));
/** SSB region-ish codes: "H05" → "H05", "H12_AV" → "H12"; H00 (whole country), H06_* (private without oppdragsdokument) → "". */
export const regionPrefix = (code) => (/^H(03|04|05|12)/.test(String(code)) ? String(code).slice(0, 3) : "");
