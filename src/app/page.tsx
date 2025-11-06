import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, Calculator, FileText, FolderKanban } from "lucide-react";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function Home() {
  const heroImage = PlaceHolderImages.find(p => p.id === "hero-landing");

  const features = [
    {
      icon: <Calculator className="w-8 h-8 text-primary" />,
      title: "Diagnóstico Rápido",
      description: "Calcula el punto de equilibrio y los ahorros potenciales al instante.",
    },
    {
      icon: <FileText className="w-8 h-8 text-primary" />,
      title: "Informe Detallado",
      description: "Genera análisis A vs. B completos con ROI y métricas clave.",
    },
    {
      icon: <FolderKanban className="w-8 h-8 text-primary" />,
      title: "Gestión de Casos",
      description: "Guarda, busca y gestiona todos tus análisis de costos.",
    },
    {
      icon: <BrainCircuit className="w-8 h-8 text-primary" />,
      title: "Perspectivas de IA",
      description: "Recibe sugerencias inteligentes para maximizar tus ahorros.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center bg-background/80 backdrop-blur-sm fixed top-0 w-full z-50">
        <Link href="#" className="flex items-center justify-center">
           <Image 
            src="/logo.png" 
            alt="Logo de la empresa" 
            width={150} 
            height={40}
            className="object-contain"
          />
          <span className="sr-only">Analizador de Costos de Corte</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button asChild variant="ghost">
            <Link href="/login">Iniciar Sesión</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Registrarse</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full pt-24 md:pt-32 lg:pt-40 relative">
          <div className="container px-4 md:px-6 text-center">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                Optimiza tu Producción, Maximiza tu{" "}
                <span className="text-primary">Ahorro</span>
              </h1>
              <p className="mt-4 text-lg text-muted-foreground md:text-xl">
                Nuestra herramienta analiza los costos de tus herramientas de corte para ofrecerte informes detallados y perspectivas de IA que impulsarán tu rentabilidad.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">Empezar Ahora</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#">Saber Más</Link>
                </Button>
              </div>
            </div>
          </div>
          {heroImage && (
            <div className="relative mt-12 h-64 md:h-96 lg:h-[480px] w-full">
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                fill
                className="object-cover object-center rounded-t-2xl"
                data-ai-hint={heroImage.imageHint}
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"></div>
            </div>
          )}
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-card">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm text-primary font-medium">
                  Características Principales
                </div>
                <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                  Inteligencia para tu Taller
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Desde cálculos rápidos hasta informes exhaustivos y gestión de casos, tenemos todo lo que necesitas para tomar decisiones de herramientas más inteligentes.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-2 mt-12">
              {features.slice(0, 2).map((feature) => (
                <Card key={feature.title} className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center gap-4">
                    {feature.icon}
                    <CardTitle className="font-headline text-2xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
             <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-2 mt-8">
              {features.slice(2).map((feature) => (
                <Card key={feature.title} className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center gap-4">
                    {feature.icon}
                    <CardTitle className="font-headline text-2xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2024 Analizador de Costos de Corte. Todos los derechos reservados.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Términos de Servicio
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Política de Privacidad
          </Link>
        </nav>
      </footer>
    </div>
  );
}
