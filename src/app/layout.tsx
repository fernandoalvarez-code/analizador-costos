
import type {Metadata} from 'next';
import './globals.css';
import "./print.css";
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import { ToastStateProvider } from '@/components/toast-state-provider';

export const metadata: Metadata = {
  title: 'Analizador de Costos de Corte',
  description: 'Optimiza tus costos de manufactura con análisis avanzados.',
};

// Fuerza render dinámico en toda la app para que la CDN no cachee el HTML
// (evita servir la versión anterior tras cada deploy). Cubre el grupo (app)
// y la landing / (fuera del grupo). Los /_next/static hasheados siguen immutables.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          <ToastStateProvider>
            {children}
            <Toaster />
          </ToastStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
