// Sentinel value used by the variant form's "Global (no region)" option.
// Lives outside actions.ts because that's a "use server" module — only async
// functions can be exported from there.
export const NONE_REGION_VALUE = '__none__';
