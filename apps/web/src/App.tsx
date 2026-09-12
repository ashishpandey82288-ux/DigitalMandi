// ==============================================================================
// KisanFlow — React Router Main Application Component
// Integrated with AuthProvider, Role-Based Route Protection & Security Gates
// ==============================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/common/ProtectedRoute.tsx';
import { MainLayout } from './layouts/MainLayout.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { FarmerPage } from './pages/FarmerPage.tsx';
import { CenterPage } from './pages/CenterPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { SecurityVerificationPage } from './pages/SecurityVerificationPage.tsx';
import { SchemaViewerPage } from './pages/SchemaViewerPage.tsx';
import { UnauthorizedPage } from './pages/UnauthorizedPage.tsx';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <MainLayout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/security" element={<SecurityVerificationPage />} />
              <Route path="/schema" element={<SchemaViewerPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected Farmer Portal */}
              <Route
                path="/farmer"
                element={
                  <ProtectedRoute allowedRoles={['FARMER', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN']}>
                    <FarmerPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Procurement Center Portal */}
              <Route
                path="/center"
                element={
                  <ProtectedRoute allowedRoles={['CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN']}>
                    <CenterPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Government Oversight & Admin Portal */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['GOVERNMENT_ADMIN', 'SUPER_ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
