import { useQuery } from "@tanstack/react-query";
import type {
  CompanySize,
  Industry,
  IndustryGroup,
  Knowhow,
  Taxonomy,
  Technology,
  TechnologyGroup,
} from "@b2b/shared";
import { api } from "../lib/api.js";

export function useTechnologies() {
  return useQuery<Technology[]>({
    queryKey: ["technologies"],
    queryFn: () => api.get<Technology[]>("/api/technologies"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTechnologyGroups() {
  return useQuery<TechnologyGroup[]>({
    queryKey: ["technology-groups"],
    queryFn: () => api.get<TechnologyGroup[]>("/api/technology-groups"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMachines() {
  return useQuery<Taxonomy[]>({
    queryKey: ["machines"],
    queryFn: () => api.get<Taxonomy[]>("/api/machines"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIndustries() {
  return useQuery<Industry[]>({
    queryKey: ["industries"],
    queryFn: () => api.get<Industry[]>("/api/industries"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIndustryGroups() {
  return useQuery<IndustryGroup[]>({
    queryKey: ["industry-groups"],
    queryFn: () => api.get<IndustryGroup[]>("/api/industry-groups"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useKnowhows() {
  return useQuery<Knowhow[]>({
    queryKey: ["knowhows"],
    queryFn: () => api.get<Knowhow[]>("/api/knowhows"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanySizes() {
  return useQuery<CompanySize[]>({
    queryKey: ["company-sizes"],
    queryFn: () => api.get<CompanySize[]>("/api/company-sizes"),
    staleTime: 5 * 60 * 1000,
  });
}
