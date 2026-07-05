/**
 * LicenseGate — license check removed.
 * All users can access the app without a license key.
 * Kept as a wrapper stub so future re-enablement is easy.
 */
interface LicenseGateProps {
  children: React.ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  return <>{children}</>;
}
