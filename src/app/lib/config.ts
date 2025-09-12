export const ENGINE_VERSION = (process.env.NEXT_PUBLIC_PROSPER_ENGINE || process.env.PROSPER_ENGINE || "v1").toLowerCase();

export const DEFAULTS = {
  growth_real: 0.03, // real annual growth (as a number)
  swr_real: 0.04,    // safe withdrawal rate (as a number)
};
