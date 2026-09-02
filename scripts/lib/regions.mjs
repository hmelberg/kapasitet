// RHF org.nr → helseregion code used by SSB (H03 Vest, H04 Midt, H05 Nord, H12 Sør-Øst).
export const RHF_TO_REGION = {
  "883658752": "H05", // Helse Nord RHF
  "983658725": "H03", // Helse Vest RHF
  "983658776": "H04", // Helse Midt-Norge RHF
  "991324968": "H12", // Helse Sør-Øst RHF
};

export const REGION_NAMES = { H03: "Helse Vest", H04: "Helse Midt-Norge", H05: "Helse Nord", H12: "Helse Sør-Øst" };

// Org.nr → eier-RHF for foretak som dukker opp i SSB 13942/13953/14080 men ikke har en
// forelder i KLASS 629 nivå 2: private/ideelle avtaleparter, nedlagte/fusjonerte HF-er
// (eierskap videreført til etterfølger-RHF), og regionale støtte-/apotek-/IKT-HF-er som
// ikke har eget opptaksområde.
export const PRIVATE_RHF = {
  "883971752": "991324968", // Sunnaas sykehus HF – eid av Helse Sør-Øst RHF, ingen opptaksområde i KLASS 629
  "883975162": "991324968", // Blefjell sykehus HF (-2008) – fusjonert inn i Vestre Viken, forgjenger Helse Sør → Helse Sør-Øst
  "883975332": "991324968", // Sykehuset Buskerud HF (-2008) – fusjonert inn i Vestre Viken
  "914637651": "991324968", // Sykehuspartner HF – IKT/støtte for Helse Sør-Øst RHF
  "915536255": "983658725", // Helse Vest Innkjøp HF (2015-2016)
  "918177833": "883658752", // Helse Nord IKT HF
  "922307814": "983658776", // Helseplattformen AS – journalløsning, hovedeier Helse Midt-Norge RHF
  "928033821": "983658776", // Hemit HF – IKT for Helse Midt-Norge RHF
  "916270097": "983658725", // Voss DPS NKS Bjørkeli
  "919865636": "983658725", // Solli DPS
  "922716552": "983658725", // Betanien sykehus (Bergen)
  "981275721": "991324968", // Betanien Hospital Skien
  "983971652": "991324968", // Aker universitetssykehus HF (-2008) – fusjonert inn i Oslo universitetssykehus
  "983971687": "991324968", // Sykehuset Asker og Bærum HF (2003-2008) – fusjonert inn i Vestre Viken
  "983971784": "991324968", // Ullevål universitetssykehus HF (-2008) – fusjonert inn i Oslo universitetssykehus
  "983974716": "983658725", // Sjukehusapoteka Vest HF
  "983974759": "983658776", // Helse Sunnmøre HF (-2010) – fusjonert inn i Helse Møre og Romsdal
  "983974767": "983658776", // Helse Nordmøre og Romsdal HF (-2010) – fusjonert inn i Helse Møre og Romsdal
  "983974805": "983658776", // Sykehusapotekene i Midt-Norge HF
  "983974937": "883658752", // Sykehusapotek Nord HF
  "983975305": "991324968", // Psykiatrien i Vestfold HF (-2011) – fusjonert inn i Sykehuset i Vestfold
  "983975348": "991324968", // Ringerike sykehus HF (-2008) – fusjonert inn i Vestre Viken
  "984027737": "983658725", // Haraldsplass Diakonale Sykehus
  "985773238": "991324968", // Revmatismesykehuset Lillehammer
  "985962170": "991324968", // Martina Hansens Hospital
  "986106839": "983658725", // Haugesund Sanitetsforenings Revmatismesykehus
  "986523065": "983658776", // Rusbehandling Midt-Norge HF (2004-2013)
  "987399708": "991324968", // Rikshospitalet HF (2007-2008) – fusjonert inn i Oslo universitetssykehus
  "987554401": "983658725", // NKS Olaviken alderspsykiatriske sykehus
  "987601787": "983658725", // Helse Vest IKT AS
  "992281618": "991324968", // Sykehusapotekene HF – Helse Sør-Øst RHF sitt apotekforetak
  "996380041": "983658725", // NKS Jæren DPS
  "998308615": "983658776", // Ambulanse Midt-Norge HF (2012-2014)
};

// HF-er felleseid av alle fire RHF-ene ("H99 Felleseide støtteforetak" i SSB) – har ingen
// enkelt eier-RHF og gis derfor tom helseregion i stedet for å bli tvunget inn i én region.
export const NATIONAL_HF = new Set([
  "814630722", // Sykehusbygg HF
  "818711832", // Luftambulansetjenesten HF
  "911912759", // Helsetjenestens driftsorganisasjon for nødnett HF
  "913454405", // Nasjonal IKT HF (2014-2019)
  "916879067", // Sykehusinnkjøp HF
  "918695079", // Pasientreiser HF
]);

/** "Troms (2024-)" → "Troms"; "Troms (-2023)" → "Troms". */
export const stripPeriodSuffix = (label) => String(label).replace(/\s*\((\d{4})?-(\d{4})?\)\s*$/, "").trim();
export const isOrgNr = (code) => /^\d{9}$/.test(String(code));
export const isRegionCode = (code) => /^H\d\d$/.test(String(code));
/** SSB region-ish codes: "H05" → "H05", "H12_AV" → "H12"; H00 (whole country), H06_* (private without oppdragsdokument) → "". */
export const regionPrefix = (code) => (/^H(03|04|05|12)/.test(String(code)) ? String(code).slice(0, 3) : "");
