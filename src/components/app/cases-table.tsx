"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, PlusCircle, Search, Trash2, Eye } from "lucide-react";
import { collection } from "firebase/firestore";
import Link from "next/link";


import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

type CaseData = {
  id: string;
  name: string;
  dateCreated: { seconds: number; nanoseconds: number; };
  annualSavings: number;
  roi: number;
  cliente: string;
  operacion: string;
  material: string;
};


export const columns: ColumnDef<CaseData>[] = [
  {
    accessorKey: "name",
    header: "Nombre del Caso",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "cliente",
    header: "Cliente",
  },
    {
    accessorKey: "operacion",
    header: "Operación",
  },
  {
    accessorKey: "material",
    header: "Material",
  },
  {
    accessorKey: "dateCreated",
    header: "Fecha",
    cell: ({ row }) => {
        const date = row.getValue("dateCreated") as { seconds: number };
        if (!date || !date.seconds) return 'N/A';
        return new Date(date.seconds * 1000).toLocaleDateString('es-ES');
    }
  },
  {
    accessorKey: "annualSavings",
    header: "Ahorro Anual",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("annualSavings"));
      return <div className="font-medium text-right">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: "roi",
    header: "ROI",
    cell: ({ row }) => {
        const roi = parseFloat(row.getValue("roi"));
         if (!isFinite(roi)) {
            return <div className="text-center"><Badge variant="default">∞</Badge></div>
        }
        const getBadgeVariant = (roi: number) => {
            if (roi > 300) return "default";
            if (roi > 200) return "secondary";
            return "outline";
        }
        return <div className="text-center"><Badge variant={getBadgeVariant(roi)}>{roi.toFixed(0)}%</Badge></div>
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const caseData = row.original;
      return (
        <div className="text-right">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/cases/${caseData.id}`}>
                        <Eye className="mr-2 h-4 w-4"/>
                        Ver detalles
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4"/>
                    Eliminar caso
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      );
    },
  },
];

export default function CasesTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const casesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/cuttingToolAnalyses`);
  }, [firestore, user]);

  const { data: casesData, isLoading } = useCollection<CaseData>(casesCollectionRef);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  
  const table = useReactTable({
    data: casesData || [],
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
  });
  
  const handleNewCase = () => {
    router.push('/dashboard');
  }

  return (
    <Card>
        <CardContent className="p-4">
            <div className="flex items-center py-4 gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, cliente, operación o material..."
                        value={globalFilter ?? ""}
                        onChange={(event) =>
                            setGlobalFilter(event.target.value)
                        }
                        className="pl-8 w-full md:w-1/2 lg:w-2/3"
                    />
                </div>
                 <Button onClick={handleNewCase}>
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Nuevo Caso
                </Button>
            </div>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                        return (
                            <TableHead key={header.id}>
                            {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                )}
                            </TableHead>
                        );
                        })}
                    </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                         Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={columns.length}>
                                    <Skeleton className="h-8 w-full" />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                        <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                        No se encontraron resultados.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                >
                Anterior
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                >
                Siguiente
                </Button>
            </div>
        </CardContent>
    </Card>
  );
}
