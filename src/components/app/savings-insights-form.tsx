"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormStatus, useFormState } from "react-dom";
import * as z from "zod";
import React from "react";
import { Sparkles } from "lucide-react";

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
import { SavingsInsightsSchema } from "@/lib/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSavingsSuggestions } from "@/lib/actions";
import { Skeleton } from "@/components/ui/skeleton";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full md:w-auto">
      {pending ? "Generando..." : "Obtener Sugerencias"}
    </Button>
  );
}

export default function SavingsInsightsForm() {
  const [state, formAction] = useFormState(getSavingsSuggestions, { message: "", error: false });

  const form = useForm<z.infer<typeof SavingsInsightsSchema>>({
    resolver: zodResolver(SavingsInsightsSchema),
    defaultValues: {
      currentTool: "End Mill Genérico 1/2\"",
      currentToolCost: 85,
      proposedTool: "End Mill de Carburo V-Plus",
      proposedToolCost: 140,
      cycleTimeReduction: 15,
      partsProducedPerShift: 120,
      shiftsPerDay: 3,
      daysPerWeek: 6,
      weeksPerYear: 50,
      machineHourlyRate: 95,
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Parámetros de Análisis</CardTitle>
                <CardDescription>
                Completa los siguientes campos con los datos de tu operación actual y la propuesta.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form action={formAction} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="currentTool" render={({ field }) => (<FormItem><FormLabel>Herramienta Actual</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="currentToolCost" render={({ field }) => (<FormItem><FormLabel>Costo Herramienta Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="proposedTool" render={({ field }) => (<FormItem><FormLabel>Herramienta Propuesta</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="proposedToolCost" render={({ field }) => (<FormItem><FormLabel>Costo Herramienta Propuesta</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="cycleTimeReduction" render={({ field }) => (<FormItem><FormLabel>Reducción de Ciclo (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="partsProducedPerShift" render={({ field }) => (<FormItem><FormLabel>Piezas por Turno</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="shiftsPerDay" render={({ field }) => (<FormItem><FormLabel>Turnos por Día</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="daysPerWeek" render={({ field }) => (<FormItem><FormLabel>Días por Semana</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="weeksPerYear" render={({ field }) => (<FormItem><FormLabel>Semanas por Año</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>Tarifa de Máquina por Hora</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    </div>

                    <SubmitButton />
                </form>
                </Form>
            </CardContent>
        </Card>
        <Card className="sticky top-24">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-accent" />
                    <CardTitle className="font-headline text-accent">Sugerencias de la IA</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none min-h-[300px]">
                {useFormStatus().pending ? (
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/6" />
                    </div>
                ) : state.data ? (
                    state.data.suggestions
                ) : (
                    <p className="text-muted-foreground">
                        Las sugerencias de la IA aparecerán aquí una vez que envíes el formulario.
                    </p>
                )}
                {state.error && <p className="text-destructive mt-4">{state.message}</p>}
            </CardContent>
        </Card>
    </div>
  );
}
