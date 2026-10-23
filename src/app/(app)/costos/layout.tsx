import CostosMarco from '@/components/costos/costos-marco';
import { EmpresaProvider } from '@/components/costos/empresa-context';

export default function CostosLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmpresaProvider>
      <CostosMarco>{children}</CostosMarco>
    </EmpresaProvider>
  );
}
