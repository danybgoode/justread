"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedClabe, setCopiedClabe] = useState(false);

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
      
      setTimeout(() => {
        window.location.href = "https://app.panfleto.win";
      }, 1000);

    } catch (err: any) {
      setError(true);
      setMessage(err.message);
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-200">
      <main className="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center">
        
        {/* Header Section */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-gray-900">panfleto</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The minimalist, distraction-free RSS reader. Stay updated without the noise.
          </p>
        </header>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 w-full mb-20">
          
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
          <div className="bg-blue-50/50 border border-blue-100 p-8 rounded-lg shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <img src="/panflo.png" alt="Panflo Mascot" className="w-16 h-16 rounded-full border-2 border-white shadow-sm object-cover" />
                <h2 className="text-2xl font-bold text-gray-800">
                  Save Panflo
                </h2>
              </div>
              <p className="text-gray-600 leading-relaxed mb-6 text-sm">
                Panflo runs panfleto completely free and open for everyone, with zero ads or tracking. If you love the service, chip in to help Panflo keep the servers running!
              </p>
              
              <div className="space-y-3">
                {/* Phone */}
                <div 
                  onClick={() => copyToClipboard('5573971352', setCopiedPhone)}
                  className="group p-3 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:border-blue-300 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">🇲🇽 DiMo / Phone Transfer</h3>
                    <p className="text-gray-500 text-xs mt-0.5">55 7397 1352</p>
                  </div>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {copiedPhone ? 'Copied!' : 'Copy'}
                  </span>
                </div>

                {/* CLABE */}
                <div 
                  onClick={() => copyToClipboard('021180064223664702', setCopiedClabe)}
                  className="group p-3 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:border-blue-300 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">🇲🇽 CLABE Bank Transfer</h3>
                    <p className="text-gray-500 text-xs mt-0.5">021 180 0642 2366 4702</p>
                  </div>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {copiedClabe ? 'Copied!' : 'Copy'}
                  </span>
                </div>
              </div>
            </div>

            <a href="https://buymeacoffee.com/savepanflo" target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-center gap-2 w-full bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.216 1.884l-.5 2.502h2.082a.834.834 0 0 1 .834.834v3.332a4.167 4.167 0 0 1-4.167 4.167H17.5l-1.84 9.196a.833.833 0 0 1-.818.669H2.498a.833.833 0 0 1-.818-.997L4.68 1.884a.834.834 0 0 1 .818-.669h13.9a.834.834 0 0 1 .818.669zm-13.43 19.16h11.166l1.506-7.528H6.286l-1.505 7.528zm10.748-9.196h.933a2.5 2.5 0 0 0 2.5-2.5V3.385h-1.393l-2.04 10.203z"/></svg>
              Buy me a coffee
            </a>
          </div>

        </div>

        {/* Features & Screenshots Section */}
        <div className="w-full pt-16 border-t border-gray-100">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Reading, purely.</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Panfleto strips away the noise of modern internet platforms. Zero algorithms, zero ads, zero distractions. Just you and your feeds in chronological order.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md">
                <img src="/article.png" alt="Clean Article Reading View" className="w-full h-auto" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Distraction-Free Reading</h3>
                <p className="text-gray-600 text-sm">Focus entirely on the content with beautifully optimized typography.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md bg-gray-50 flex items-center justify-center p-4">
                <img src="/unreadd.png" alt="Unread Items List" className="w-full h-auto rounded shadow-sm border border-gray-100" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Strictly Chronological</h3>
                <p className="text-gray-600 text-sm">No manipulative algorithms deciding what you see. Read your unread items in order.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md bg-gray-50 flex items-center justify-center p-4">
                <img src="/categories.png" alt="Organized Categories" className="w-full h-auto rounded shadow-sm border border-gray-100" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Total Organization</h3>
                <p className="text-gray-600 text-sm">Group your feeds into elegant categories to separate work from play.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md bg-gray-50 flex items-center justify-center p-4">
                <img src="/feeds.png" alt="Feed Management" className="w-full h-auto rounded shadow-sm border border-gray-100" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Your Feeds, Your Rules</h3>
                <p className="text-gray-600 text-sm">Easily discover, import, and manage RSS feeds across the entire web.</p>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
