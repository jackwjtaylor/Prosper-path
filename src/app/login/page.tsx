"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import React from "react";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

/**
 * LoginPage provides a modern authentication experience using Supabase Auth UI.
 * Users can sign in with OAuth providers like Google or GitHub or request
 * a magic link via email. After authentication, Supabase redirects back to
 * `/auth/callback` where account linking occurs.
 */
export default function LoginPage() {
  const supabase = getSupabaseClient();

  // Compute redirect URL on the client so Supabase knows where to send the user
  // after authentication with third‑party providers or magic links.
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?redirect=/`
      : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md rounded-md border bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-semibold">Sign in</h1>
        {supabase ? (
          <Auth
            supabaseClient={supabase}
            providers={["google", "github"]}
            redirectTo={redirectTo}
            magicLink
            view="magic_link"
            showLinks={false}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#1d4ed8",
                    brandAccent: "#1d4ed8",
                  },
                },
              },
            }}
            socialLayout="vertical"
          />
        ) : (
          <p className="text-center text-sm text-gray-600">
            Supabase client not configured.
          </p>
        )}
      </div>
    </div>
  );
}

