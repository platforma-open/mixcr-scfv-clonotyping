// The MiXCR steps a chain runs. The tag patterns pick the preset and each preset has one step
// list: generic-amplicon-with-umi refines tags before assembly. The UMI check matches the
// workflow's (main.tpl.tengo).
export function mixcrStepsFor(heavyTagPattern?: string, lightTagPattern?: string): string[] {
  const hasUmis = [heavyTagPattern, lightTagPattern].some(
    (p) => p !== undefined && /UMI|Umi|umi/.test(p),
  );
  return hasUmis ? ["align", "refineTagsAndSort", "assemble", "qc"] : ["align", "assemble", "qc"];
}

// The per-step memory floors of the steps the chain runs, or undefined when none is set. A
// floor kept for a step the tag patterns no longer run is dropped.
export function stepMemFloorsFor(
  floors: Record<string, number> | undefined,
  heavyTagPattern?: string,
  lightTagPattern?: string,
): Record<string, number> | undefined {
  if (!floors) return undefined;
  const kept: Record<string, number> = {};
  for (const step of mixcrStepsFor(heavyTagPattern, lightTagPattern)) {
    if (floors[step] !== undefined) kept[step] = floors[step];
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}
