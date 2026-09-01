// json-stat2: `value` is a flat row-major array over `id` (last dimension varies fastest).

export function jsonStatToRows(ds) {
  if (!ds || !Array.isArray(ds.id) || !Array.isArray(ds.size) || !ds.dimension) {
    throw new Error("Ikke et json-stat2-datasett (mangler id/size/dimension)");
  }
  const dims = ds.id.map((id) => {
    const cat = ds.dimension[id].category;
    const codes = Array.isArray(cat.index)
      ? cat.index
      : Object.keys(cat.index).sort((a, b) => cat.index[a] - cat.index[b]);
    return { id, codes, labels: cat.label ?? {} };
  });
  const total = ds.size.reduce((a, b) => a * b, 1);
  const rows = [];
  for (let flat = 0; flat < total; flat++) {
    const v = Array.isArray(ds.value) ? ds.value[flat] : ds.value?.[String(flat)];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const row = { value: v };
    let rem = flat;
    for (let d = dims.length - 1; d >= 0; d--) {
      const pos = rem % ds.size[d];
      rem = Math.floor(rem / ds.size[d]);
      const code = dims[d].codes[pos];
      row[dims[d].id] = code;
      row[`${dims[d].id}_label`] = dims[d].labels[code] ?? code;
    }
    rows.push(row);
  }
  return rows;
}

/** Test/fixture builder. dims: [{id, codes, labels?}], values: flat row-major array. */
export function makeJsonStat(dims, values) {
  const id = dims.map((d) => d.id);
  const size = dims.map((d) => d.codes.length);
  const dimension = Object.fromEntries(
    dims.map((d) => [
      d.id,
      { category: { index: [...d.codes], label: Object.fromEntries(d.codes.map((c, i) => [c, d.labels?.[i] ?? c])) } },
    ]),
  );
  return { class: "dataset", version: "2.0", id, size, dimension, value: values };
}
