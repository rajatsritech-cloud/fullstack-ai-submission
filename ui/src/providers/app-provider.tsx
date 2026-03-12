import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "./query-provider";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryProvider>
  );
}
