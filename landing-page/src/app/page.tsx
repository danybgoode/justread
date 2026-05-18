"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError(false);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setMessage("Success! You can now log in to panfleto.");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setError(true);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-rose-500/30">
      <main className="max-w-4xl mx-auto px-6 py-24 flex flex-col items-center">
        
        {/* Header Section */}
        <header className="text-center mb-16 space-y-4">
          <h1 className="text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-rose-400 to-orange-400">
            panfleto
          </h1>
          <p className="text-xl text-neutral-400 max-w-xl mx-auto font-light leading-relaxed">
            The minimalist, distraction-free RSS reader. Stay updated without the noise.
          </p>
        </header>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 w-full">
          
          {/* Registration Card */}
          <div className="bg-neutral-800/50 backdrop-blur-xl border border-neutral-700/50 p-8 rounded-3xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              Create Account
            </h2>
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {message && (
                <div className={`p-4 rounded-xl text-sm font-medium border ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Creating..." : "Start Reading Free"}
              </button>
            </form>
          </div>

          {/* Support Us Card */}
          <div className="bg-neutral-800/50 backdrop-blur-xl border border-neutral-700/50 p-8 rounded-3xl shadow-2xl flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                Support panfleto
              </h2>
              <p className="text-neutral-400 leading-relaxed mb-8">
                panfleto is completely free and open for everyone. We don't run ads or sell your data. If you love the service, consider supporting the infrastructure costs.
              </p>
              
              <div className="space-y-4">
                <div className="p-4 bg-neutral-900/50 border border-neutral-700/50 rounded-xl">
                  <h3 className="font-semibold text-rose-300 mb-2">🇲🇽 Zero-Fee Direct Transfer</h3>
                  <div className="flex items-center justify-between text-sm text-neutral-300">
                    <span>DiMo Phone Number:</span>
                    <span className="font-mono bg-neutral-800 px-2 py-1 rounded select-all text-white">55 1234 5678</span>
                  </div>
                  <div className="mt-3 text-xs text-neutral-500 text-center">
                    (Codi QR available inside the app)
                  </div>
                </div>
              </div>
            </div>

            <a href="https://buymeacoffee.com/panfleto" target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 w-full bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black font-semibold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.216 1.884l-.5 2.502h2.082a.834.834 0 0 1 .834.834v3.332a4.167 4.167 0 0 1-4.167 4.167H17.5l-1.84 9.196a.833.833 0 0 1-.818.669H2.498a.833.833 0 0 1-.818-.997L4.68 1.884a.834.834 0 0 1 .818-.669h13.9a.834.834 0 0 1 .818.669zm-13.43 19.16h11.166l1.506-7.528H6.286l-1.505 7.528zm10.748-9.196h.933a2.5 2.5 0 0 0 2.5-2.5V3.385h-1.393l-2.04 10.203z"/></svg>
              Buy us a coffee
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
