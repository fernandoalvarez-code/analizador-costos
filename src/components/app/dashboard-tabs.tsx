"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React from "react";
import {
  Calculator,
  Download,
  Save,
  TrendingUp,
  BarChart,
  Clock,
  DollarSign,
  Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  QuickDiagnosisSchema,
  DetailedReportSchema,
} from "@/lib/schemas";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QuickDiagnosisResult = {
  breakEven: number;
  annualSavings: number;
};
type DetailedReportResult = {
  cppCurrent: number;
  cppProposed: number;
  netSavings: number;
  roi: number;
  machineHoursFreed: number;
};

export default function DashboardTabs() {
  const [quickResult, setQuickResult] = React.useState<QuickDiagnosisResult | null>(null);
  const [detailedResult, setDetailedResult] = React.useState<DetailedReportResult | null>(null);

  const quickForm = useForm<z.infer<typeof QuickDiagnosisSchema>>({
    resolver: zodResolver(QuickDiagnosisSchema),
    defaultValues: {
      currentToolCost: 100,
      proposedToolCost: 150,
      cycleTimeReduction: 20,
    },
  });

  const detailedForm = useForm<z.infer<typeof DetailedReportSchema>>({
    resolver: zodResolver(DetailedReportSchema),
    defaultValues: {
      currentTool: "Herramienta Estándar",
      currentToolCost: 100,
      proposedTool: "Herramienta Premium",
      proposedToolCost: 150,
      cycleTimeReduction: 20,
      partsProducedPerShift: 50,
      shiftsPerDay: 2,
      daysPerWeek: 5,
      weeksPerYear: 50,
      machineHourlyRate: 80,
    },
  });

  function onQuickSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { currentToolCost, proposedToolCost, cycleTimeReduction } = data;
    // Dummy calculations
    const costDifference = proposedToolCost - currentToolCost;
    if (cycleTimeReduction <= 0) {
        setQuickResult({ breakEven: Infinity, annualSavings: 0 });
        return;
    }
    const breakEven = Math.ceil(costDifference / (cycleTimeReduction / 100));
    const annualSavings = (breakEven * (cycleTimeReduction / 100) * 250) - costDifference * 12;
    setQuickResult({ breakEven, annualSavings: Math.max(0, annualSavings) });
  }

  function onDetailedSubmit(data: z.infer<typeof DetailedReportSchema>) {
    // Dummy calculations
    const cppCurrent = data.currentToolCost / data.partsProducedPerShift;
    const cppProposed = data.proposedToolCost / (data.partsProducedPerShift * (1 + data.cycleTimeReduction/100));
    const annualParts = data.partsProducedPerShift * data.shiftsPerDay * data.daysPerWeek * data.weeksPerYear;
    const netSavings = (cppCurrent - cppProposed) * annualParts;
    const investment = data.proposedToolCost - data.currentToolCost;
    const roi = investment > 0 ? (netSavings / investment) * 100 : Infinity;
    const hoursSaved = (annualParts * (data.cycleTimeReduction/100)) / 60;

    setDetailedResult({
        cppCurrent,
        cppProposed,
        netSavings,
        roi,
        machineHoursFreed: hoursSaved,
    });
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

  const StatCard = ({ icon, title, value, description }: { icon: React.ReactNode, title: string, value: string, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
  )

  return (
    <Tabs defaultValue="quick">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="quick">Diagnóstico Rápido</TabsTrigger>
        <TabsTrigger value="detailed">Informe Detallado</TabsTrigger>
      </TabsList>
      <TabsContent value="quick">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Diagnóstico Rápido</CardTitle>
            <CardDescription>
              Calcula rápidamente el punto de equilibrio y los ahorros potenciales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...quickForm}>
              <form onSubmit={quickForm.handleSubmit(onQuickSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={quickForm.control} name="currentToolCost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Herramienta Actual ($)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={quickForm.control} name="proposedToolCost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Herramienta Propuesta ($)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={quickForm.control} name="cycleTimeReduction" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reducción Tiempo Ciclo (%)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <div className="md:col-span-3">
                  <Button type="submit" className="w-full md:w-auto">Calcular</Button>
                </div>
              </form>
            </Form>
            {quickResult && (
                <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-headline font-semibold mb-4">Resultados del Diagnóstico</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <StatCard icon={<Calculator className="h-4 w-4 text-muted-foreground" />} title="Punto de Equilibrio" value={isFinite(quickResult.breakEven) ? `${quickResult.breakEven.toFixed(2)}` : 'N/A'} description="Costo justificado por la reducción de tiempo" />
                        <StatCard icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} title="Ahorro Anual Estimado" value={formatCurrency(quickResult.annualSavings)} description="Basado en una operación continua" />
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="detailed">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Informe Detallado (A vs. B)</CardTitle>
            <CardDescription>
              Genera una comparación exhaustiva entre dos herramientas de corte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...detailedForm}>
              <form onSubmit={detailedForm.handleSubmit(onDetailedSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                      <h4 className="font-semibold text-primary">Herramienta Actual (A)</h4>
                      <FormField control={detailedForm.control} name="currentTool" render={({ field }) => (<FormItem><FormLabel>Nombre Herramienta A</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={detailedForm.control} name="currentToolCost" render={({ field }) => (<FormItem><FormLabel>Costo Herramienta A ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  </div>
                   <div className="space-y-4">
                      <h4 className="font-semibold text-accent">Herramienta Propuesta (B)</h4>
                      <FormField control={detailedForm.control} name="proposedTool" render={({ field }) => (<FormItem><FormLabel>Nombre Herramienta B</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={detailedForm.control} name="proposedToolCost" render={({ field }) => (<FormItem><FormLabel>Costo Herramienta B ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  </div>
                </div>
                <div className="border-t pt-8">
                    <h4 className="font-semibold mb-4">Parámetros de Producción</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <FormField control={detailedForm.control} name="cycleTimeReduction" render={({ field }) => (<FormItem><FormLabel>Reducción Ciclo (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="partsProducedPerShift" render={({ field }) => (<FormItem><FormLabel>Piezas/Turno</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="shiftsPerDay" render={({ field }) => (<FormItem><FormLabel>Turnos/Día</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="daysPerWeek" render={({ field }) => (<FormItem><FormLabel>Días/Semana</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>Costo Máquina/Hr ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    </div>
                </div>
                <div>
                  <Button type="submit">Generar Informe</Button>
                </div>
              </form>
            </Form>
            {detailedResult && (
                <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-headline font-semibold">Resultados del Informe</h3>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"><Save className="mr-2"/> Guardar Caso</Button>
                            <Button variant="outline" size="sm"><Download className="mr-2"/> Descargar PDF</Button>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <StatCard icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} title="Ahorro Neto Anual" value={formatCurrency(detailedResult.netSavings)} />
                        <StatCard icon={<BarChart className="h-4 w-4 text-muted-foreground" />} title="Retorno de Inversión (ROI)" value={isFinite(detailedResult.roi) ? `${detailedResult.roi.toFixed(1)}%` : '∞'} />
                        <StatCard icon={<Clock className="h-4 w-4 text-muted-foreground" />} title="Horas de Máquina Liberadas" value={`${detailedResult.machineHoursFreed.toFixed(1)} hrs`} />
                        <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="CPP Actual" value={formatCurrency(detailedResult.cppCurrent)} description="Costo Por Pieza" />
                        <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="CPP Propuesto" value={formatCurrency(detailedResult.cppProposed)} description="Costo Por Pieza" />
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
