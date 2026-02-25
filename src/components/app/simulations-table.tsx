"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { MoreHorizontal, Search, Trash2 } from "lucide-react";
import {
  useCollection,
  useFirestore,
  useUser,
  useMemoFirebase,
  doc,
  collection,
  deleteDocumentNonBlocking,
  query,
  orderBy,
  User,
  useDoc
} from "@/firebase";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { UserProfile } from "./cases-table";

// Type for a single simulation document
export type SimulationData = {
  id: string;
  userId: string;
  clientName: string;
  date: { seconds: number; nanoseconds: number };
  results: {
    chinaCalc: { totalCostPerPiece: number };
    premiumCalc: { totalCostPerPiece: number };
    competitivenessIndex: number;
  };
};

// Action Cell Component
const ActionCell = ({
  simData,
  user,
  isAdmin,
  onDeleteClick,
}: {
  simData: SimulationData;
  user: User | null;
  isAdmin: boolean;
  onDeleteClick: (simData: SimulationData) => void;
}) => {
  const isOwner = user?.uid === simData.userId;
  const canDelete = isAdmin || isOwner;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem
          className="text-destructive"
          disabled={!canDelete}
          onSelect={(e) => {
            e.preventDefault();
            onDeleteClick(simData);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Main Table Component
const SimulationsTable = ({
  simulationsData,
  isLoading,
  user,
  isAdmin,
}: {
  simulationsData: SimulationData[];
  isLoading: boolean;
  user: User | null;
  isAdmin: boolean;
}) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [simToDelete, setSimToDelete] = React.useState<SimulationData | null>(null);

  const handleDelete = () => {
    if (!simToDelete || !firestore) return;

    const simClientName = simToDelete.clientName;
    const simId = simToDelete.id;
    
    setSimToDelete(null);
    
    const simDocRef = doc(firestore, 'simulations', simId);
    deleteDocumentNonBlocking(simDocRef);
    toast({
        title: "Simulación eliminada",
        description: `La simulación para "${simClientName}" ha sido eliminada.`,
    });
  };

  const columns = React.useMemo<ColumnDef<SimulationData>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Fecha",
        cell: ({ row }) => {
          const date = row.getValue("date") as { seconds: number };
          if (!date?.seconds) return "N/A";
          return new Date(date.seconds * 1000).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        },
      },
      {
        accessorKey: "clientName",
        header: "Cliente",
      },
      {
        id: "costoAnterior",
        header: () => <div className="text-right">Costo Anterior</div>,
        cell: ({ row }) => {
          const cost = row.original.results.chinaCalc.totalCostPerPiece;
          return <div className="font-medium text-right">{formatCurrency(cost)}</div>;
        },
      },
      {
        id: "costoNuevo",
        header: () => <div className="text-right">Nuevo Costo</div>,
        cell: ({ row }) => {
          const cost = row.original.results.premiumCalc.totalCostPerPiece;
          return <div className="font-medium text-right text-blue-600">{formatCurrency(cost)}</div>;
        },
      },
      {
        id: "ahorro",
        header: () => <div className="text-right">Ahorro</div>,
        cell: ({ row }) => {
          const index = row.original.results.competitivenessIndex;
          if (index === 0) return <div className="text-right">-</div>;
          const savings = (1 - index) * 100;
          return (
            <div className={cn("text-right font-bold", savings > 0 ? "text-green-600" : "text-red-600")}>
              {formatPercent(savings)}
            </div>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <ActionCell
            simData={row.original}
            user={user}
            isAdmin={isAdmin}
            onDeleteClick={setSimToDelete}
          />
        ),
      },
    ],
    [user, isAdmin]
  );
  
  const table = useReactTable({
    data: simulationsData || [],
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center py-4 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-8 w-full md:w-1/2"
              />
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
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
                    <TableRow key={row.id}>
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
                      No se encontraron simulaciones.
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

      <AlertDialog open={!!simToDelete} onOpenChange={(isOpen) => !isOpen && setSimToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la simulación para "{simToDelete?.clientName}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Wrapper Component
const SimulationsTableWrapper = () => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const firestore = useFirestore();
  const { user } = useUser();
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const simulationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "simulations"), orderBy("date", "desc"));
  }, [firestore]);

  const { data: simulationsData, isLoading } = useCollection<SimulationData>(simulationsCollectionRef);

  if (!isMounted) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
           <Skeleton className="h-10 w-full" />
           <Skeleton className="h-8 w-full" />
           <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Admin sees all, regular user sees only their own.
  const filteredSimulations = isAdmin ? simulationsData : simulationsData?.filter(sim => sim.userId === user?.uid);

  return (
    <SimulationsTable 
      simulationsData={filteredSimulations || []} 
      isLoading={isLoading} 
      user={user}
      isAdmin={isAdmin}
    />
  );
};

export default SimulationsTableWrapper;
