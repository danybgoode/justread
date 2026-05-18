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

      setMessage("Success! Redirecting you to panfleto...");
      
      // Give a tiny delay so they see the success message, then redirect
      setTimeout(() => {
        window.location.href = "https://app.panfleto.win";
      }, 1000);

    } catch (err: any) {
      setError(true);
      setMessage(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-200">
      <main className="max-w-4xl mx-auto px-6 py-16 flex flex-col items-center">
        
        {/* Header Section */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">panfleto</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            The minimalist, distraction-free RSS reader. Stay updated without the noise.
          </p>
        </header>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 w-full">
          
          {/* Registration Card */}
          <div className="bg-white border border-gray-200 p-8 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-5 text-gray-800">
              Create Account
            </h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>

              {message && (
                <div className={`p-3 rounded-md text-sm font-medium border ${error ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Start Reading Free"}
              </button>
              
              <div className="text-center mt-4 text-sm text-gray-600">
                Already have an account? <a href="https://app.panfleto.win" className="text-blue-600 hover:underline">Log in</a>
              </div>
            </form>
          </div>

          {/* Support Us Card */}
          <div className="bg-gray-50 border border-gray-200 p-8 rounded-lg shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-5 text-gray-800">
                Support panfleto
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                panfleto is completely free and open for everyone. We don't run ads or sell your data. If you love the service, consider supporting the infrastructure costs.
              </p>
              
              <div className="space-y-4">
                <div className="p-4 bg-white border border-gray-200 rounded-md shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-2">🇲🇽 Zero-Fee Direct Transfer</h3>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>DiMo Phone Number:</span>
                    <span className="font-mono bg-gray-100 border border-gray-200 px-2 py-1 rounded select-all text-gray-800">55 1234 5678</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    (Codi QR available inside the app)
                  </div>
                </div>
              </div>
            </div>

            <a href="https://buymeacoffee.com/panfleto" target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 w-full bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.216 1.884l-.5 2.502h2.082a.834.834 0 0 1 .834.834v3.332a4.167 4.167 0 0 1-4.167 4.167H17.5l-1.84 9.196a.833.833 0 0 1-.818.669H2.498a.833.833 0 0 1-.818-.997L4.68 1.884a.834.834 0 0 1 .818-.669h13.9a.834.834 0 0 1 .818.669zm-13.43 19.16h11.166l1.506-7.528H6.286l-1.505 7.528zm10.748-9.196h.933a2.5 2.5 0 0 0 2.5-2.5V3.385h-1.393l-2.04 10.203z"/></svg>
              Buy us a coffee
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
