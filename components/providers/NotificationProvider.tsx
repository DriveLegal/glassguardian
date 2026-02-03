"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationType = "success" | "error" | "info";
type NotificationItem = {
  id: number;
  type: NotificationType;
  title?: string;
  message: string;
};

type Ctx = {
  addNotification: (args: {
    type?: NotificationType;
    title?: string;
    message: string;
    duration?: number; // ms; 0 = sticky
  }) => void;
};

const NotificationContext = React.createContext<Ctx | null>(null);

export const useNotification = () => {
  const ctx = React.useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);

  const removeNotification = React.useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification: Ctx["addNotification"] = React.useCallback(
    ({ type = "info", title, message, duration = 5000 }) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setNotifications((prev) => [...prev, { id, type, title, message }]);
      if (duration > 0) {
        window.setTimeout(() => removeNotification(id), duration);
      }
    },
    [removeNotification]
  );

  const icons: Record<NotificationType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const colors: Record<NotificationType, string> = {
    success: "bg-green-50 border-green-500 text-green-900",
    error: "bg-red-50 border-red-500 text-red-900",
    info: "bg-blue-50 border-blue-500 text-blue-900",
  };

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}

      <div className="fixed top-4 right-4 z-[1000] space-y-2 max-w-sm">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`p-4 rounded-lg border-l-4 shadow-2xl backdrop-blur-sm ${colors[n.type]}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{icons[n.type]}</div>
                <div className="flex-1">
                  {n.title && <h4 className="font-semibold mb-1">{n.title}</h4>}
                  <p className="text-sm">{n.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-6 w-6"
                  onClick={() => removeNotification(n.id)}
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}