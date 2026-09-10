import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api.js";
import type {
  LoginInput,
  MeUser,
  PasswordChangeInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  RegisterInput,
} from "@b2b/shared";

const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery<MeUser | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.get<MeUser>("/api/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<{ ok: true }>("/api/auth/login", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<{ ok: true }>("/api/auth/register", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.invalidateQueries();
    },
  });
}

export function usePasswordResetRequest() {
  return useMutation({
    mutationFn: (input: PasswordResetRequestInput) =>
      api.post<{ ok: true }>("/api/auth/password/request", input),
  });
}

export function usePasswordResetConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PasswordResetConfirmInput) =>
      api.post<{ ok: true }>("/api/auth/password/reset", input),
    onSuccess: () => {
      // Nach Reset ist der Cookie geloescht - Cache fuer me invalidieren.
      qc.setQueryData(ME_KEY, null);
      qc.invalidateQueries();
    },
  });
}

export function usePasswordChange() {
  return useMutation({
    mutationFn: (input: PasswordChangeInput) =>
      api.post<{ ok: true }>("/api/auth/password/change", input),
  });
}
