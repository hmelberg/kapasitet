import { makeHfLongFetcher } from "./ssb-hf-long.mjs";
export default makeHfLongFetcher({
  id: "ssb_13953", tableId: "13953",
  navn: "SSB 13953 Avtalte årsverk i spesialisthelsetjenesten etter helseforetak og yrkesgruppe",
  dim: "Yrke", dimCol: "yrkesgruppe_kode", dimLabelCol: "yrkesgruppe", contentsCode: "Arsverk", outFile: "hf_staffing.csv",
});
