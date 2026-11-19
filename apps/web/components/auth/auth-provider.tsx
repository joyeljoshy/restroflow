"use client";

import type {
  AuthenticatedUser,
  LoginRequest,
  Role,
} from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";

import { fetchCurrentUser, loginStaff, logoutStaff } from "@/lib/auth-api";

const authQueryKey = ["auth", "current-user"] as const;

export function homeForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
    case "MANAGER":
      return "/admin";
    case "KITCHEN":
      return "/kitchen";
    case "WAITER":
      return "/waiter/pos";
    case "CASHIER":
      return "/cashier";
  }
}

type AuthContextValue = {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  authError: string | null;
  isLoggingIn: boolean;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  retryAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const currentUser = useQuery({
    queryKey: authQueryKey,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
  const loginMutation = useMutation({ mutationFn: loginStaff });
  const logoutMutation = useMutation({ mutationFn: logoutStaff });

  const login = useCallback(
    async (input: LoginRequest) => {
      const user = await loginMutation.mutateAsync(input);
      queryClient.setQueryData(authQueryKey, user);
      const membership = user.memberships[0];
      router.replace(
        membership ? homeForRole(membership.role) : "/unauthorized",
      );
    },
    [loginMutation, queryClient, router],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    queryClient.setQueryData(authQueryKey, null);
    router.replace("/login");
  }, [logoutMutation, queryClient, router]);

  const retryAuth = useCallback(async () => {
    await currentUser.refetch();
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        user: currentUser.data ?? null,
        isLoading: currentUser.isPending,
        authError: currentUser.isError
          ? "RestroFlow could not verify your session. Check the API connection and try again."
          : null,
        isLoggingIn: loginMutation.isPending,
        login,
        logout,
        retryAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
