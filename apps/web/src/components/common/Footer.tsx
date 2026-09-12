// ==============================================================================
// DigitalMandi — Formal Public Service Footer Component
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { Wheat, ShieldCheck, HeartHandshake, PhoneCall, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-900 text-neutral-300 border-t border-neutral-800 mt-auto pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-800">
          {/* Brand & Mission */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                <Wheat className="w-4 h-4 text-amber-300" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Digital<span className="text-emerald-400">Mandi</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Empowering Indian farmers through transparent Minimum Support Price (MSP) realization, digital gate passes, AI quality inspection, and instant Direct Benefit Transfer (DBT).
            </p>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 pt-1 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Cryptographically Secured Audit Trail</span>
            </div>
          </div>

          {/* Farmer Portals */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              Farmer Services
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <Link to="/farmer" className="hover:text-emerald-400 transition-colors">
                  MSP Rate Inquiries
                </Link>
              </li>
              <li>
                <Link to="/farmer" className="hover:text-emerald-400 transition-colors">
                  Schedule Procurement Slot
                </Link>
              </li>
              <li>
                <Link to="/farmer" className="hover:text-emerald-400 transition-colors">
                  Digital Gate Pass & QR Code
                </Link>
              </li>
              <li>
                <Link to="/farmer" className="hover:text-emerald-400 transition-colors">
                  DBT Payment Disbursement Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Center Operations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              Mandi Operations
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <Link to="/center" className="hover:text-emerald-400 transition-colors">
                  Mandi Gate Check-in & Queue
                </Link>
              </li>
              <li>
                <Link to="/center" className="hover:text-emerald-400 transition-colors">
                  Computer Vision Grading
                </Link>
              </li>
              <li>
                <Link to="/center" className="hover:text-emerald-400 transition-colors">
                  Digital Weighbridge Integration
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-emerald-400 transition-colors">
                  State Procurement Oversight
                </Link>
              </li>
            </ul>
          </div>

          {/* Citizen & Farmer Helpdesk */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              National Helpdesk
            </h4>
            <div className="p-3 rounded-lg bg-neutral-800/80 border border-neutral-700/80 space-y-1.5 text-xs">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Kisan Call Center: 1800-180-1551</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-normal">
                Toll-free assistance available in 22 regional languages, 6:00 AM to 10:00 PM IST daily.
              </p>
            </div>
            <p className="text-[11px] text-neutral-500">
              Ministry of Agriculture & Farmers Welfare, Government of India.
            </p>
          </div>
        </div>

        {/* Bottom Sub-footer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <p>© 2026 DigitalMandi. All rights reserved. Designed for transparent Indian agriculture.</p>
          <div className="flex items-center space-x-4 text-[11px]">
            <span className="hover:text-neutral-400 cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-neutral-400 cursor-pointer">Terms of Service</span>
            <span>•</span>
            <span className="hover:text-neutral-400 cursor-pointer">DBT Guidelines</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

