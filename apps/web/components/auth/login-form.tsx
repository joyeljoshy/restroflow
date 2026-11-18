"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [notice, setNotice] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const submit = handleSubmit(() =>
    setNotice("Authentication is intentionally scheduled for a later part."),
  );

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
        disabled={isSubmitting}
      >
        Continue
      </Button>
      {notice && (
        <p
          className="bg-accent text-accent-foreground rounded-lg p-3 text-sm"
          role="status"
        >
          {notice}
        </p>
      )}
    </form>
  );
}
