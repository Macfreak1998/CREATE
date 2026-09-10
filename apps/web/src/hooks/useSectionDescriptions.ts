import { useQuery } from "@tanstack/react-query";
import type { SectionDescriptions } from "@b2b/shared";
import { api } from "../lib/api.js";

export function useSectionDescriptions() {
  return useQuery<SectionDescriptions>({
    queryKey: ["section-descriptions"],
    queryFn: () =>
      api.get<SectionDescriptions>("/api/section-descriptions"),
    staleTime: 10 * 60 * 1000,
  });
}
