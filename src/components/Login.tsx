import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Sign out anonymous user first
      await supabase.auth.signOut();

      // Sign in with Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password.");
        } else if (
          authError.message.includes("Email not confirmed")
        ) {
          setError(
            "Please confirm your email address before logging in.",
          );
        } else {
          setError(
            "An error occurred during login. Please try again.",
          );
        }

        // Re-establish anonymous session for realtime
        const { data: anonData } =
          await supabase.auth.signInAnonymously();
        if (anonData.session?.access_token) {
          supabase.realtime.setAuth(anonData.session.access_token);
        }
        return;
      }

      // Set realtime auth
      if (authData.session?.access_token) {
        supabase.realtime.setAuth(authData.session.access_token);
      }

      // Fetch user profile from users table to check role
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (userError) {
        setError(
          "Unable to load user profile. Please contact admin.",
        );
        return;
      }

      // Redirect based on role
      if (userData.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-md w-full bg-white border border-neutral-200 p-12">
        <h1 className="text-3xl font-light text-neutral-900 mb-8 tracking-tight">
          Welcome Back
        </h1>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-6">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 text-sm"
              required
            />
          </div>

          <div className="mb-8">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-700 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-neutral-900 text-white py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200 ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600">
            Don't have an account?{" "}
            <span className="text-neutral-900 font-medium">
              Contact admin to create one
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
