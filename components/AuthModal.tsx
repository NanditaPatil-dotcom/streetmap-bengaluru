"use client";

import { FormEvent, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { isValidPassword, PASSWORD_RULES_MESSAGE } from "@/lib/passwordValidation";

type AuthMode = "signin" | "register";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const initialForm = {
  name: "",
  email: "",
  password: "",
};

export default function AuthModal({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [hasGoogleProvider, setHasGoogleProvider] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForm(initialForm);
      setError("");
      setSuccess("");
      setMode("signin");
      setIsGoogleLoading(false);
      return;
    }

    let isMounted = true;

    const loadProviders = async () => {
      try {
        const providers = await getProviders();

        if (isMounted) {
          setHasGoogleProvider(Boolean(providers?.google));
        }
      } catch (providerError) {
        console.error("Failed to load auth providers", providerError);

        if (isMounted) {
          setHasGoogleProvider(false);
        }
      }
    };

    loadProviders();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        if (!isValidPassword(form.password)) {
          setError(PASSWORD_RULES_MESSAGE);
          return;
        }

        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
          }),
        });
        const registerData = await registerResponse.json();

        if (!registerResponse.ok) {
          setError(registerData.error || "Could not create your account");
          return;
        }

        setSuccess("Account created. Signing you in...");
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      setForm(initialForm);
      onClose();
    } catch (submitError) {
      console.error("Authentication failed", submitError);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSuccess("");
    setIsGoogleLoading(true);

    try {
      if (!hasGoogleProvider) {
        setError("Google sign-in is not configured yet.");
        return;
      }

      await signIn("google", { callbackUrl: "/" });
    } catch (submitError) {
      console.error("Google authentication failed", submitError);
      setError("Google sign-in is unavailable right now.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] bg-[#f4f0e8] p-6 text-[#111111] shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#686258]">
              StreetMap Bengaluru
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 px-3 py-1 text-sm transition hover:bg-black/5"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex rounded-full bg-black/8 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setSuccess("");
            }}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === "signin" ? "bg-[#111111] text-white" : "text-[#3f3a33]"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
              setSuccess("");
            }}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === "register" ? "bg-[#111111] text-white" : "text-[#3f3a33]"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
                placeholder="Linus Torvalds"
                required
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
              placeholder="8+ chars, Aa, symbol"
              minLength={8}
              required
            />
            {mode === "register" ? (
              <p className="mt-2 text-xs text-[#686258]">
                Use at least 8 characters, 1 uppercase letter, 1 lowercase letter,
                and 1 symbol.
              </p>
            ) : null}
          </label>

          {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
          {success ? <p className="text-sm text-[#166534]">{success}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || isGoogleLoading}
            className="w-full rounded-2xl bg-[#111111] px-4 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in"
                : "Register and sign in"}
          </button>
        </form>

        <div className="mt-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#686258]">
              Or
            </span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isGoogleLoading || !hasGoogleProvider}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-[#222222] bg-[#222222] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="text-base leading-none">G</span>
            {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          {!hasGoogleProvider ? (
            <p className="mt-2 text-xs text-[#686258]">
              Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable Google sign-in.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
