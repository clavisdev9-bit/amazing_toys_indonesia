import { createContext, useContext } from 'react';

// Shared catalogue state — provided by CustomerShellDesktop so both the
// sidebar (category filter, search) and BrowsePageDesktop (product grid)
// consume the same useCatalogueState() instance without duplicate API calls.
export const CatalogueContext = createContext(null);

export function useCatalogueContext() {
  const ctx = useContext(CatalogueContext);
  if (!ctx) throw new Error('useCatalogueContext must be inside CatalogueContext.Provider');
  return ctx;
}
