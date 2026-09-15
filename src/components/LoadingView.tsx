import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { WavyBackground } from './WavyBackground';
import { useNavigate } from 'react-router-dom';

export const LoadingView = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Simulate loading steps
    const t1 = setTimeout(() => setStep(2), 1500);
    const t2 = setTimeout(() => setStep(3), 3000);
    const t3 = setTimeout(() => setStep(4), 4500);
    const t4 = setTimeout(() => navigate('/'), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [navigate]);

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans overflow-hidden bg-white">
      <WavyBackground />
      
      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 w-full pb-20">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-10">
          <Logo className="w-[60px] h-[60px] mb-3" />
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">DreamWorker</h1>
          <h2 className="text-base font-medium text-slate-500">MCP Control Plane</h2>
        </div>

        {/* Spinner */}
        <div className="relative w-40 h-40 mb-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full"
               style={{
                 background: 'linear-gradient(135deg, #a7f3d0, #38bdf8, #3b82f6)',
                 maskImage: 'radial-gradient(transparent 65%, black 66%)',
                 WebkitMaskImage: 'radial-gradient(transparent 65%, black 66%)',
               }}>
          </div>
          <div className="absolute inset-0 rounded-full animate-spin flex justify-center items-start overflow-hidden pointer-events-none">
            {/* Extremely performant spinning mask instead of CSS blur */}
            <div className="w-[150%] h-[150%] -top-1/4 -left-1/4 absolute" 
                 style={{
                   background: 'conic-gradient(from 270deg, transparent 0deg, white 90deg, transparent 180deg)'
                 }}>
            </div>
          </div>
        </div>

        <h3 className="text-[28px] font-bold text-slate-900 mb-2 z-10">Signing you in...</h3>
        <p className="text-slate-500 font-medium mb-16 z-10 text-[15px]">Connecting to your environment</p>

        {/* Stepper */}
        <div className="w-full max-w-[600px] relative mb-16 px-4">
          <div className="absolute top-2 left-[10%] right-[10%] h-[2px] bg-sky-100 -z-10"></div>
          <div className="absolute top-2 left-[10%] h-[2px] bg-gradient-to-r from-emerald-400 to-sky-300 -z-10 transition-all duration-700" 
               style={{ width: step === 1 ? '0%' : step === 2 ? '26%' : step === 3 ? '53%' : '80%' }}></div>
          
          <div className="flex justify-between relative">
            <div className="flex flex-col items-center w-24">
              <div className={`w-[18px] h-[18px] rounded-full border-[3px] bg-white transition-colors duration-300 ${step >= 1 ? 'border-emerald-400 bg-emerald-400' : 'border-sky-200'}`}></div>
              <span className={`text-[13px] mt-3 text-center transition-colors duration-300 ${step >= 1 ? 'text-slate-800 font-semibold' : 'text-slate-400 font-medium'}`}>Authenticating</span>
            </div>
            <div className="flex flex-col items-center w-24">
              <div className={`w-[18px] h-[18px] rounded-full border-[3px] bg-white transition-colors duration-300 ${step >= 2 ? 'border-sky-300 bg-sky-50' : 'border-sky-100'}`}></div>
              <span className={`text-[13px] mt-3 text-center transition-colors duration-300 ${step >= 2 ? 'text-slate-600 font-semibold' : 'text-slate-400 font-medium'}`}>Loading<br/>workspace</span>
            </div>
            <div className="flex flex-col items-center w-24">
              <div className={`w-[18px] h-[18px] rounded-full border-[3px] bg-white transition-colors duration-300 ${step >= 3 ? 'border-sky-300 bg-sky-50' : 'border-sky-100'}`}></div>
              <span className={`text-[13px] mt-3 text-center transition-colors duration-300 ${step >= 3 ? 'text-slate-600 font-semibold' : 'text-slate-400 font-medium'}`}>Checking<br/>permissions</span>
            </div>
            <div className="flex flex-col items-center w-24">
              <div className={`w-[18px] h-[18px] rounded-full border-[3px] bg-white transition-colors duration-300 ${step >= 4 ? 'border-sky-300 bg-sky-50' : 'border-sky-100'}`}></div>
              <span className={`text-[13px] mt-3 text-center transition-colors duration-300 ${step >= 4 ? 'text-slate-600 font-semibold' : 'text-slate-400 font-medium'}`}>Almost there...</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-sky-50/80 backdrop-blur-sm border border-sky-100/50 rounded-xl px-5 py-4 flex items-center space-x-3 max-w-sm w-full relative z-20">
          <ShieldCheck className="text-teal-500 w-[22px] h-[22px] flex-shrink-0" />
          <div className="flex flex-col text-[13px] leading-snug">
            <span className="text-slate-700 font-medium">Your data stays private and secure.</span>
            <span className="text-slate-500">Powered by open tools.</span>
          </div>
        </div>
      </main>
    </div>
  );
};
