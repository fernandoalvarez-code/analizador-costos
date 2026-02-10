"use client";

import * as React from "react";
import { ToastContext, reducer, genId, type State, type Toast } from "@/hooks/use-toast";

const TOAST_REMOVE_DELAY = 1000000;
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function ToastStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] } as State);

  const toast = React.useCallback((props: Toast) => {
    const id = genId();

    const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        open: true,
        onOpenChange: (open) => {
          if (!open) dismiss();
        },
      },
    });
  }, []);

  const dismiss = React.useCallback((toastId?: string) => {
    dispatch({ type: "DISMISS_TOAST", toastId });
  }, []);

  React.useEffect(() => {
    const lastToast = state.toasts[0];
    if (lastToast && lastToast.open) {
      const { id } = lastToast;
      if (toastTimeouts.has(id)) {
        return;
      }
      const timeout = setTimeout(() => {
        toastTimeouts.delete(id);
        dispatch({ type: "REMOVE_TOAST", toastId: id });
      }, TOAST_REMOVE_DELAY);
      toastTimeouts.set(id, timeout);
    }
  }, [state.toasts]);

  return (
    <ToastContext.Provider value={{ ...state, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}
