// src/components/ui/table.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TableColumn<T> {
    key: string;
    header: React.ReactNode;
    headerClassName?: string;
    cellClassName?: string | ((item: T) => string);
    render?: (item: T, index: number) => React.ReactNode;
}

export interface CustomTableProps<T> {
    data: T[];
    columns: TableColumn<T>[];
    keyExtractor: (item: T) => string | number;
    onRowClick?: (item: T) => void;
    emptyStateText?: string;
    isLoading?: boolean;
    className?: string;
    tableClassName?: string;
    rowClassName?: string | ((item: T, index: number) => string);
    headerRowClassName?: string;
}

export function CustomTable<T>({
    data,
    columns,
    keyExtractor,
    onRowClick,
    emptyStateText = "No data found",
    isLoading = false,
    className,
    tableClassName,
    rowClassName,
    headerRowClassName,
}: CustomTableProps<T>) {
    return (
        <div className={cn("overflow-x-auto border border-slate-200 shadow-xs rounded mb-4", className)}>
            <table className={cn("w-full text-sm border-collapse whitespace-nowrap", tableClassName)}>
                <thead>
                    <tr className={cn("", headerRowClassName)}>
                        {columns.map((column, idx) => (
                            <th
                                key={column.key || idx}
                                className={cn(
                                    "bg-primary text-white py-2 px-3 text-left font-semibold",
                                    column.headerClassName
                                )}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? (
                        <tr>
                            <td colSpan={columns.length} className="p-8 text-center text-slate-400 bg-slate-50">
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    Loading...
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="p-8 text-center text-slate-400 bg-slate-50">
                                {emptyStateText}
                            </td>
                        </tr>
                    ) : (
                        data.map((item, index) => (
                            <tr
                                key={keyExtractor(item)}
                                onClick={() => onRowClick?.(item)}
                                className={cn(
                                    "border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors",
                                    onRowClick && "cursor-pointer",
                                    rowClassName ? (typeof rowClassName === "function" ? rowClassName(item, index) : rowClassName) : "odd:bg-white even:bg-[#fff9f5]"
                                )}
                            >
                                {columns.map((column, idx) => {
                                    const cellVal = (item as any)[column.key];
                                    const cellClass = typeof column.cellClassName === "function"
                                        ? column.cellClassName(item)
                                        : column.cellClassName;
                                    return (
                                        <td
                                            key={column.key || idx}
                                            className={cn(
                                                "py-2 px-3 align-middle",
                                                cellClass
                                            )}
                                        >
                                            {column.render ? column.render(item, index) : cellVal}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
