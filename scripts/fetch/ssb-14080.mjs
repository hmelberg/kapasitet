import { makeHfLongFetcher } from "./ssb-hf-long.mjs";
export default makeHfLongFetcher({
  id: "ssb_14080", tableId: "14080",
  navn: "SSB 14080 Avtalte legeårsverk i spesialisthelsetjenesten etter helseforetak og spesialitet",
  dim: "Spesialitet", dimCol: "spesialitet_kode", dimLabelCol: "spesialitet", contentsCode: "AvtAarsverk", outFile: "hf_specialists.csv",
});
