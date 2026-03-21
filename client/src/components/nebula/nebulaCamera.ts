// Shared ref for world-space camera sync — no React overhead
export const nebulaCameraRef = {
  el:     null as HTMLDivElement | null,  // parallax anchor
  nebula: null as HTMLDivElement | null,  // central input wrapper
};
