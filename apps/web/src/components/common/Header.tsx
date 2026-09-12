// ==============================================================================
// KisanFlow — Global Navigation Header
// Displays Authenticated User State, Role Badge, Assigned Center & Sign Out
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sprout, ShieldCheck, Building2, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { fetchHealthStatus } from '../../services/healthService.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { NotificationBell } from './NotificationBell.tsx';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealthStatus()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: 'Overview' },
    { to: '/farmer', label: 'Farmer Portal', icon: Sprout, roles: ['FARMER', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'] },
    { to: '/center', label: 'Mandi Center', icon: Building2, roles: ['CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'] },
    { to: '/admin', label: 'Govt Admin', icon: ShieldCheck, roles: ['GOVERNMENT_ADMIN', 'SUPER_ADMIN'] },
    { to: '/security', label: 'Security & RBAC' },
    { to: '/schema', label: 'Database Schema' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-sm group-hover:bg-emerald-800 transition-colors">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold tracking-tight text-neutral-900">KisanFlow</span>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    SIH 2026
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 hidden sm:block">Smart Procurement & Direct MSP Engine</p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action & User Profile Section */}
          <div className="flex items-center space-x-3">
            {/* Live API Health Indicator */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-neutral-50 text-neutral-600 border-neutral-200"
              title="KisanFlow Express API Status"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiOnline === true
                    ? 'bg-emerald-500 animate-pulse'
                    : apiOnline === false
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <span className="hidden lg:inline">
                {apiOnline === true ? 'API Ready' : apiOnline === false ? 'API Offline' : 'Connecting'}
              </span>
            </div>

            {/* In-app Notification Bell */}
            {isAuthenticated && <NotificationBell />}

            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2">
                {/* User details and role pill */}
                <div className="hidden sm:flex flex-col items-end text-right">
                  <div className="text-xs font-bold text-neutral-900 leading-tight truncate max-w-[140px]">
                    {user.name}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {user.role}
                    </span>
                    {(user.operatorCenterId || (user.assignedCenterIds && user.assignedCenterIds.length > 0)) && (
                      <span className="text-[10px] font-medium text-neutral-500">
                        {user.operatorCenterId || user.assignedCenterIds?.[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out of KisanFlow"
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
