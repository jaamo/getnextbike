// Sentinel for the variant picker's "unmatched" option. Lives outside
// actions.ts because that's a "use server" module — only async functions
// may be exported from there.
export const NONE_VARIANT_VALUE = '__none__';
