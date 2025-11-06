import Image from "next/image";
import Link from "next/link";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const heroImage = PlaceHolderImages.find(p => p.id === "hero-landing");

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <Link href="/" className="flex items-center justify-center text-primary font-headline text-2xl font-bold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 mr-2"
              >
                <path d="M9.52 3.48a2.29 2.29 0 0 1 4.96 0 2.29 2.29 0 0 1-4.96 0Z" />
                <path d="M12 6.5v11.5" />
                <path d="M6 18h12" />
                <path d="M3 13a4 4 0 1 1 5.76-3.46" />
                <path d="M21 13a4 4 0 1 0-5.76-3.46" />
              </svg>
              Analizador de Costos de Corte
            </Link>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
        {heroImage && (
            <Image
            src={heroImage.imageUrl}
            alt={heroImage.description}
            data-ai-hint={heroImage.imageHint}
            fill
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-primary/40"></div>
      </div>
    </div>
  );
}
