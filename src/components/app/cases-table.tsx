

"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  GroupingState,
  getExpandedRowModel,
  useReactTable,
  Row,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { MoreHorizontal, PlusCircle, Search, Trash2, Eye, ChevronDown, ChevronRight, GripVertical, Edit, Printer } from "lucide-react";
import { collection, doc } from "firebase/firestore";
import Link from "next/link";
import { User } from "firebase/auth";
import { Firestore } from "firebase/firestore";


import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number' || !isFinite(value)) return 'N/A';
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value);
}

export type CaseData = {
  id: string;
  userId: string;
  name: string;
  dateCreated: { seconds: number; nanoseconds: number; };
  annualSavings: number;
  roi: number;
  cliente: string;
  operacion: string;
  material: string;
  status: 'Pendiente' | 'Exitoso' | 'No Exitoso';
};

export type UserProfile = {
  role: 'admin' | 'user';
}

function getStatusVariant(status: string) {
    switch (status) {
        case 'Exitoso':
        return 'default';
        case 'No Exitoso':
        return 'destructive';
        default:
        return 'secondary';
    }
}

const ActionCell = ({ row, user, firestore, isAdmin }: { row: Row<CaseData>, user: User | null, firestore: Firestore | null, isAdmin: boolean }) => {
    const caseData = row.original;
    const isOwner = user?.uid === caseData.userId;
    const { toast } = useToast();

    function handleDelete() {
        if (!firestore || !caseData.id) return;
        const caseDocRef = doc(firestore, 'cuttingToolAnalyses', caseData.id);
        deleteDocumentNonBlocking(caseDocRef);
        toast({
          title: "Caso eliminado",
          description: `El caso "${caseData.name}" ha sido eliminado.`,
        });
    };

    return (
        <div className="text-right">
            <AlertDialog>
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
                        <DropdownMenuItem asChild>
                            <Link href={`/cases/${caseData.id}?print=true`} target="_blank">
                                <Printer className="mr-2 h-4 w-4"/>
                                Descargar PDF
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild disabled={!isAdmin && !isOwner}>
                            <Link href={`/cases/${caseData.id}?edit=true`}>
                                <Edit className="mr-2 h-4 w-4"/>
                                Editar
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive" disabled={!isAdmin && !isOwner} onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="mr-2 h-4 w-4"/>
                                Eliminar caso
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                    </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Esto eliminará permanentemente el caso
                        de éxito y todos sus datos asociados de nuestros servidores.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Continuar
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};


const CasesTable = ({ casesData, isLoading, user, isAdmin }: { casesData: CaseData[], isLoading: boolean, user: User | null, isAdmin: boolean }) => {
  const firestore = useFirestore();
  const router = useRouter();
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  
  const columns = React.useMemo<ColumnDef<CaseData>[]>(() => [
      {
        accessorKey: "name",
        header: "Nombre del Caso",
        cell: ({ row, getValue }) => (
          <div className={cn("font-medium", row.getCanExpand() && "pl-2")}>
            {row.getCanExpand() ? (
              <button
                {...{
                  onClick: row.getToggleExpandedHandler(),
                  style: { cursor: 'pointer' },
                  className: "flex items-center gap-1"
                }}
              >
                {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {getValue<string>()} ({row.subRows.length})
              </button>
            ) : (
              getValue<string>()
            )}
          </div>
        ),
      },
      {
        accessorKey: "cliente",
        header: "Cliente",
        cell: ({ getValue }) => getValue() || 'N/A',
        enableGrouping: true,
      },
        {
        accessorKey: "operacion",
        header: "Operación",
        cell: ({ getValue }) => getValue() || 'N/A',
      },
      {
        accessorKey: "material",
        header: "Material",
        cell: ({ getValue }) => getValue() || 'N/A',
        enableGrouping: true,
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            if (!status) return null;
            return <Badge variant={getStatusVariant(status)}>{status}</Badge>
        },
        enableGrouping: true,
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
        header: () => <div className="text-right">Ahorro Anual</div>,
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("annualSavings"));
          return <div className="font-medium text-right">{formatCurrency(amount)}</div>;
        },
      },
      {
        accessorKey: "roi",
        header: () => <div className="text-center">ROI</div>,
        cell: ({ row }) => {
            const roi = parseFloat(row.getValue("roi"));
             if (!isFinite(roi)) {
                return <div className="text-center"><Badge variant="secondary" className="text-xs">∞</Badge></div>
            }
            const getBadgeVariant = (roi: number) => {
                if (roi > 300) return "default";
                if (roi > 200) return "secondary";
                return "outline";
            }
            return <div className="text-center"><Badge variant={getBadgeVariant(roi)} className="text-xs">{roi.toFixed(0)}%</Badge></div>
        }
      },
      {
        id: "actions",
        cell: ({ row }) => <ActionCell row={row} user={user} firestore={firestore} isAdmin={isAdmin} />,
      },
  ], [user, firestore, isAdmin]);
  
  const table = useReactTable({
    data: casesData || [],
    columns,
    state: {
      sorting,
      globalFilter,
      grouping,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
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
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Agrupar por:</span>
                    <Button variant={grouping.includes('cliente') ? 'secondary' : 'outline'} size="sm" onClick={() => table.setGrouping(g => g.includes('cliente') ? g.filter(i => i !== 'cliente') : [...g, 'cliente'])}>Cliente</Button>
                    <Button variant={grouping.includes('material') ? 'secondary' : 'outline'} size="sm" onClick={() => table.setGrouping(g => g.includes('material') ? g.filter(i => i !== 'material') : [...g, 'material'])}>Material</Button>
                    <Button variant={grouping.includes('status') ? 'secondary' : 'outline'} size="sm" onClick={() => table.setGrouping(g => g.includes('status') ? g.filter(i => i !== 'status') : [...g, 'status'])}>Estado</Button>
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
                            <TableHead key={header.id} className="p-2 text-xs h-10">
                                {header.isPlaceholder ? null : (
                                    <div className={cn("flex items-center gap-1", header.column.getCanSort() ? "cursor-pointer select-none" : "")}
                                        onClick={header.column.getToggleSortingHandler()}>
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        {{
                                            asc: ' 🔼',
                                            desc: ' 🔽',
                                        }[header.column.getIsSorted() as string] ?? null}
                                        {header.column.getCanGroup() ? (
                                            <button {...{
                                                onClick: (e) => {
                                                    e.stopPropagation();
                                                    header.column.getToggleGroupingHandler()();
                                                },
                                                className: "hover:bg-muted p-1 rounded-sm"
                                            }}>
                                                <GripVertical size={14} className={header.column.getIsGrouped() ? "text-primary" : ""} />
                                            </button>
                                        ) : null}{' '}
                                    </div>
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
                                <TableCell colSpan={columns.length} className="p-2">
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
                            <TableCell key={cell.id} className="p-2 text-xs">
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

const CasesTableWrapper = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const casesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, `cuttingToolAnalyses`);
  }, [firestore]);

  const { data: casesData, isLoading } = useCollection<CaseData>(casesCollectionRef);

  return (
    <CasesTable 
      casesData={casesData || []} 
      isLoading={isLoading} 
      user={user} 
      isAdmin={isAdmin} 
    />
  );
};

export default CasesTableWrapper;

    
    