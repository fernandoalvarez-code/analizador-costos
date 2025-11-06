import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">
            Configuración
        </h1>
        <Card>
            <CardHeader>
                <CardTitle>Configuración de la cuenta</CardTitle>
                <CardDescription>
                    Aquí podrás administrar la configuración de tu cuenta en el futuro.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Esta sección está en construcción.</p>
            </CardContent>
        </Card>
    </div>
  );
}
