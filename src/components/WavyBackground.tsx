import React from 'react';

export const WavyBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-50/50 via-white to-white" />
    <svg className="absolute bottom-0 w-full h-[60%] sm:h-[80%] min-w-[1000px]" preserveAspectRatio="none" viewBox="0 0 1440 600" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,400 C200,300 400,200 700,350 C1000,500 1200,200 1440,300 L1440,600 L0,600 Z" fill="url(#paint0_linear)" opacity="0.6" />
      <path d="M0,500 C300,300 500,450 800,350 C1100,250 1300,400 1440,250 L1440,600 L0,600 Z" fill="url(#paint1_linear)" opacity="0.5" />
      <path d="M0,600 C250,550 450,350 750,450 C1050,550 1250,400 1440,500 L1440,600 L0,600 Z" fill="url(#paint2_linear)" opacity="0.7" />
      <defs>
        <linearGradient id="paint0_linear" x1="0" y1="200" x2="1440" y2="600" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bae6fd" stopOpacity="0.8" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="paint1_linear" x1="0" y1="250" x2="1440" y2="600" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" stopOpacity="0.7" />
          <stop offset="1" stopColor="#a7f3d0" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="paint2_linear" x1="0" y1="350" x2="1440" y2="600" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" stopOpacity="0.9" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0.1" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);
