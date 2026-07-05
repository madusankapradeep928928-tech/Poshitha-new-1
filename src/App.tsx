import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { LicenseGate } from '@/components/LicenseGate';
import { AppKeyGate } from '@/components/AppKeyGate';
import { routes } from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        {/* AppKeyGate is inside Router+AuthProvider so it can auto-login and navigate */}
        <AppKeyGate>
          <RouteGuard>
            <LicenseGate>
              <IntersectObserver />
              <div className="flex flex-col min-h-screen">
                <main className="flex-grow">
                  <Routes>
                    {routes.map((route, index) => (
                      <Route
                        key={index}
                        path={route.path}
                        element={route.element}
                      />
                    ))}
                    <Route path="/" element={<Navigate to="/billing" replace />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </main>
              </div>
              <Toaster />
            </LicenseGate>
          </RouteGuard>
        </AppKeyGate>
      </AuthProvider>
    </Router>
  );
};

export default App;
