// ==============================================================================
// DigitalMandi — Global Navigation Header
// Premium Indian AgriTech & Public Service Portal Navigation
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sprout,
  ShieldCheck,
  Building2,
  LogIn,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Wheat,
  ChevronDown,
} from 'lucide-react';
import { fetchHealthStatus } from '../../services/healthService.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { NotificationBell } from './NotificationBell.tsx';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchHealthStatus()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/farmer', label: 'Farmer Portal', icon: Sprout, roles: ['FARMER', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'] },
    { to: '/center', label: 'Mandi Center', icon: Building2, roles: ['CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'] },
    { to: '/admin', label: 'Govt Oversight', icon: ShieldCheck, roles: ['GOVERNMENT_ADMIN', 'SUPER_ADMIN'] },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/90 shadow-2xs">
      {/* Top Govt / National Banner Strip */}
      <div className="bg-emerald-950 text-emerald-100 text-[11px] font-medium py-1 px-4 sm:px-6 lg:px-8 border-b border-emerald-900/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold tracking-wide">Digital Mandi National Procurement Network</span>
            <span className="hidden sm:inline text-emerald-300/80">• Direct MSP & DBT Settlement</span>
          </div>
          <div className="flex items-center space-x-3 text-[10px] text-emerald-200/90">
            <span className="hidden md:inline">24x7 Farmer Helpline: 1800-180-1551</span>
            <span className="hidden md:inline">•</span>
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="font-mono text-[10px]">{apiOnline ? 'Live Services Active' : 'Connecting'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 border border-emerald-500/30">
                <Wheat className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-extrabold tracking-tight text-neutral-900">
                    Digital<span className="text-emerald-700">Mandi</span>
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                    Official MSP
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-medium text-neutral-500 tracking-tight leading-none">
                  National Agricultural Procurement Platform
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                      : 'text-neutral-700 hover:text-emerald-800 hover:bg-emerald-50/70'
                  }`}
                >
                  {Icon && <Icon className={`w-4 h-4 mr-1.5 ${isActive ? 'text-white' : 'text-emerald-600'}`} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action & User Profile Section */}
          <div className="flex items-center space-x-3">
            {/* In-app Notification Bell */}
            {isAuthenticated && <NotificationBell />}

            {isAuthenticated && user ? (
              <div className="flex items-center space-x-3">
                {/* User profile pill */}
                <div className="hidden sm:flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-neutral-100/80 border border-neutral-200">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-neutral-900 leading-none truncate max-w-[130px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold tracking-wide uppercase mt-0.5">
                      {user.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out from DigitalMandi"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-800 shadow-2xs transition-colors"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Farmer Registration</span>
                </Link>
              </div>
            )}

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white/98 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 shadow-lg">
          <div className="flex flex-col space-y-1">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-700 text-white font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-600'}`} />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {!isAuthenticated && (
            <div className="pt-3 border-t border-neutral-200 flex flex-col space-y-2">
              <Link
                to="/register"
                className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 rounded-lg bg-emerald-700 text-white text-sm font-semibold shadow-xs"
              >
                <UserIcon className="w-4 h-4" />
                <span>Register as Farmer</span>
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 rounded-lg bg-neutral-100 text-neutral-800 text-sm font-medium hover:bg-neutral-200"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Account</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

