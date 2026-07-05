import LoginPage from './pages/LoginPage';
import ShopRegisterPage from './pages/ShopRegisterPage';
import BillingPage from './pages/BillingPage';
import ProductsPage from './pages/ProductsPage';
import BranchesPage from './pages/BranchesPage';
import SuppliersPage from './pages/SuppliersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import ShopProfilePage from './pages/ShopProfilePage';
import SuperAdminPage from './pages/SuperAdminPage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'ShopRegister',
    path: '/register-shop',
    element: <ShopRegisterPage />,
    public: true,
  },
  {
    name: 'Billing',
    path: '/billing',
    element: <BillingPage />,
  },
  {
    name: 'Products',
    path: '/products',
    element: <ProductsPage />,
  },
  {
    name: 'Branches',
    path: '/branches',
    element: <BranchesPage />,
  },
  {
    name: 'Suppliers',
    path: '/suppliers',
    element: <SuppliersPage />,
  },
  {
    name: 'Reports',
    path: '/reports',
    element: <ReportsPage />,
  },
  {
    name: 'Users',
    path: '/users',
    element: <UsersPage />,
  },
  {
    name: 'ShopProfile',
    path: '/shop-profile',
    element: <ShopProfilePage />,
  },
  {
    name: 'SuperAdmin',
    path: '/super-admin',
    element: <SuperAdminPage />,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <SettingsPage />,
  },
];
