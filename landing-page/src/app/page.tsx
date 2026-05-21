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
  const [mcpApiKey, setMcpApiKey] = useState("");
  const [copiedMcp, setCopiedMcp] = useState(false);

  const mcpUrl = mcpApiKey.trim()
    ? `https://panfleto.win/api/mcp?token=${mcpApiKey.trim()}`
    : "";


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
        window.location.href = "https://app.panfleto.win/feeds";
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
            <a 
              href="https://app.panfleto.win/oauth2/oidc/redirect" 
              className="w-full mb-6 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-md border border-gray-300 shadow-sm transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

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
                <img src="/panflo.png" alt="Panflo Mascot" className="w-24 h-24 object-contain" />
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
                  onClick={() => copyToClipboard('638180000153447394', setCopiedClabe)}
                  className="group p-3 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:border-blue-300 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">🇲🇽 CLABE Bank Transfer</h3>
                    <p className="text-gray-500 text-xs mt-0.5">638 180 0001 5344 7394</p>
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

        {/* AI Assistant / MCP Section */}
        <div className="w-full pt-16 mt-4 border-t border-gray-100">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your feeds, in your AI assistant.</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Connect Panfleto to any MCP-compatible AI client — Claude, Cursor, Continue, and more. Ask for your daily digest, search your feeds, or get a brief. One URL, zero setup.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 w-full">

            {/* URL Builder */}
            <div className="bg-white border border-gray-200 p-8 rounded-lg shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Get your MCP URL</h3>
              <p className="text-sm text-gray-500 mb-5">
                Generate your API key at{" "}
                <a href="https://app.panfleto.win/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  app.panfleto.win → Settings → API Keys
                </a>
                , then paste it below.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="mcp-api-key">
                    Your Panfleto API Key
                  </label>
                  <input
                    id="mcp-api-key"
                    type="password"
                    value={mcpApiKey}
                    onChange={(e) => setMcpApiKey(e.target.value)}
                    placeholder="Paste your API key here..."
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {mcpUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your MCP URL</label>
                    <div
                      onClick={() => copyToClipboard(mcpUrl, setCopiedMcp)}
                      className="group flex items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:border-blue-300 transition-colors"
                    >
                      <span className="font-mono text-xs text-gray-600 truncate">
                        {mcpUrl}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {copiedMcp ? "Copied!" : "Copy"}
                      </span>
                    </div>
                  </div>
                )}

                {!mcpUrl && (
                  <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-md text-center">
                    <span className="text-xs text-gray-400 font-mono">https://panfleto.win/api/mcp?token=...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="bg-white border border-gray-200 p-8 rounded-lg shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-5">Connect your AI client</h3>
              <div className="space-y-5">

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1.5">Claude.ai</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Go to <span className="font-medium text-gray-700">Settings → Connectors</span> → Add MCP Server → paste your URL.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1.5">Claude Code / CLI</h4>
                  <div className="bg-gray-50 rounded-md p-3 font-mono text-xs text-gray-600 select-all">
                    claude mcp add --transport http panfleto https://panfleto.win/api/mcp?token=YOUR_KEY
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">What you can ask</h4>
                  <ul className="space-y-1.5 text-sm text-gray-500">
                    <li className="flex gap-2"><span className="text-gray-300">—</span>"Give me today's digest from my feeds"</li>
                    <li className="flex gap-2"><span className="text-gray-300">—</span>"How many unread articles do I have?"</li>
                    <li className="flex gap-2"><span className="text-gray-300">—</span>"Search my feeds for anything about AI"</li>
                    <li className="flex gap-2"><span className="text-gray-300">—</span>"Read me my starred articles"</li>
                    <li className="flex gap-2"><span className="text-gray-300">—</span>"Summarize my unread tech news"</li>
                  </ul>
                </div>

              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
