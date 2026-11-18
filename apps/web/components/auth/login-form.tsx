"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest } from "@restroflow/contracts";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { homeForRole, useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/auth-api";

export function LoginForm() {
  const { user, login, isLoading, isLoggingIn } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  useEffect(() => {
    const membership = user?.memberships[0];
    if (membership) router.replace(homeForRole(membership.role));
  }, [router, user]);

  const submit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (error) {
      setError("root", {
        message:
          error instanceof ApiError
            ? error.message
            : "Sign-in failed. Please try again.",
      });
    }
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold">
          Work email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@restaurant.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-red-700" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <label htmlFor="password" className="text-sm font-semibold">
            Password
          </label>
          <span className="text-muted-foreground text-xs">8+ characters</span>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-red-700" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isLoading || isSubmitting || isLoggingIn}
      >
        {isSubmitting || isLoggingIn ? "Signing in…" : "Continue"}
      </Button>
      {errors.root?.message && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {errors.root.message}
        </p>
      )}
    </form>
  );
}
