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
               <Image 
                src="/logo.png" 
                alt="Logo de la empresa" 
                width={200} 
                height={50} 
                className="object-contain"
              />
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
