import React from 'react';
import { useNavigate } from 'react-router-dom';

// SVG Logo mark (same as NavBar)
const Logo = () => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.2" />
        <path d="M16 6C16 6 8 10 8 18C8 22.4 11.6 26 16 26C20.4 26 24 22.4 24 18C24 10 16 6 16 6Z" fill="white" fillOpacity="0.9" />
        <path d="M16 26V16" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 20C16 20 13 17 11 16" stroke="#0D9488" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M16 17C16 17 18.5 14.5 20 14" stroke="#0D9488" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
);

const Footer = () => {
    const navigate = useNavigate();

    return (
        <footer className="bg-teal-600 mt-auto">
            <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col items-center gap-3">

                {/* Logo + Name */}
                <div
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2.5 cursor-pointer"
                >
                    <Logo />
                    <span className="text-xl font-black text-white tracking-tight">
                        Clean<span className="text-teal-200">Street</span>
                    </span>
                </div>

                {/* Tagline */}
                <p className="text-sm text-teal-100 text-center">
                    Your community issue reporter. Simple, clean, and effective.
                </p>

                {/* Divider */}
                <div className="w-full border-t border-teal-500 my-1" />

                {/* Copyright */}
                <p className="text-xs text-teal-200">
                    © {new Date().getFullYear()} CleanStreet. All rights reserved.
                </p>
            </div>
        </footer>
    );
};

export default Footer;
