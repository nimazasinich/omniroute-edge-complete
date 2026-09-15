import React from 'react';
import { Mail, Lock, Eye, Sun, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { WavyBackground } from './WavyBackground';
import { useNavigate } from 'react-router-dom';

export const LoginView = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans overflow-hidden bg-white">
      <WavyBackground />
      
      {/* Header */}
      <header className="relative z-10 w-full px-8 py-6 flex justify-between items-center">
        <div className="flex items-center">
          <Logo />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-slate-900 leading-tight">DreamWorker</span>
            <span className="text-sm font-medium text-slate-500 leading-tight">MCP Control Plane</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2 rounded-full border border-slate-200 bg-white/50 backdrop-blur text-slate-600 hover:bg-slate-50 transition-colors">
            <Sun size={18} />
          </button>
          <button className="px-3 py-1.5 rounded-full border border-slate-200 bg-white/50 backdrop-blur text-slate-600 hover:bg-slate-50 transition-colors flex items-center space-x-1 text-sm font-medium">
            <span>EN</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center px-4 lg:px-24 xl:px-48 max-w-[1600px] mx-auto w-full gap-12 lg:gap-24 pb-16 lg:pb-0">
        
        {/* Left Side: Login Card */}
        <div className="w-full max-w-md bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] border border-slate-100/50 relative z-20">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Welcome back</h1>
          <p className="text-slate-500 font-medium mb-8">Sign in to your MCP Control Plane</p>

          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); navigate('/loading'); }}>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  defaultValue="admin@dreamworker.ai"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-700"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <a href="#" className="text-sm font-medium text-sky-500 hover:text-sky-600">Forgot password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  defaultValue="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium tracking-widest text-slate-700"
                  placeholder="••••••••"
                />
                <button type="button" className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                  <Eye size={18} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-500 hover:to-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center space-x-2"
            >
              <span>Sign in</span>
              <span className="text-lg leading-none">&rarr;</span>
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center space-x-4">
            <div className="h-px bg-slate-100 flex-1"></div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or continue with</span>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <button className="flex justify-center items-center py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              <span className="ml-2 text-sm font-semibold text-slate-700 hidden sm:inline">Google</span>
            </button>
            <button className="flex justify-center items-center py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white">
              <img src="https://www.svgrepo.com/show/512317/github-142.svg" alt="GitHub" className="w-5 h-5 opacity-80" />
              <span className="ml-2 text-sm font-semibold text-slate-700 hidden sm:inline">GitHub</span>
            </button>
            <button className="flex justify-center items-center py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white">
              <img src="https://www.svgrepo.com/show/452234/microsoft.svg" alt="Microsoft" className="w-5 h-5" />
              <span className="ml-2 text-sm font-semibold text-slate-700 hidden sm:inline">Microsoft</span>
            </button>
          </div>

          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            Don't have an account? <a href="#" className="text-sky-500 hover:text-sky-600 font-semibold">Contact your administrator</a>
          </div>
        </div>

        {/* Right Side: Copy */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center text-left max-w-lg mt-12 lg:mt-0 relative z-10">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
            Open Tools<br/>A Brighter Tomorrow
          </div>
          <h2 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-2 tracking-tight">
            More capable<br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-emerald-400">tomorrow</span>
          </h2>
          
          <div className="w-12 h-1 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full my-8"></div>
          
          <p className="text-xl text-slate-500 font-medium leading-relaxed mb-8 max-w-md">
            Unified control for models, providers, and AI tools. Simple. Open. Powerful.
          </p>
          
          <blockquote className="text-lg text-slate-400 italic font-medium">
            " The best tools amplify<br/>human potential. "
          </blockquote>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-8 py-6 flex flex-col sm:flex-row justify-between items-center text-sm font-medium text-slate-500">
        <div className="flex items-center space-x-2">
          <span className="text-sky-600 font-bold">DreamWorker</span>
          <span>&middot;</span>
          <span>The future is created today.</span>
        </div>
        <div className="flex items-center space-x-6 mt-4 sm:mt-0">
          <span>v1.8.0</span>
          <a href="#" className="hover:text-slate-700 flex items-center">Documentation <span className="ml-1 text-xs font-bold">&nearr;</span></a>
          <a href="#" className="hover:text-slate-700 flex items-center">Support <span className="ml-1 text-xs font-bold">&nearr;</span></a>
        </div>
      </footer>
    </div>
  );
};
