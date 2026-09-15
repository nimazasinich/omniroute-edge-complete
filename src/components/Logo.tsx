import React from 'react';

export const Logo = ({ className = "mr-3" }: { className?: string }) => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M22 65 C35 65 40 40 45 20 L55 20 C60 40 70 85 90 85 L90 70 C75 70 70 40 65 20 L45 20 C40 40 35 55 22 55 Z" fill="url(#logo_grad1)" />
    <path d="M10 25 L25 25 C30 35 45 65 55 65 L40 85 C25 60 15 35 10 25 Z" fill="url(#logo_grad2)" />
    <defs>
      <linearGradient id="logo_grad1" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#0EA5E9" />
      </linearGradient>
      <linearGradient id="logo_grad2" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0EA5E9" />
        <stop offset="1" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
  </svg>
);
