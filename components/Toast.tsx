"use client";

import { AnimatePresence, motion } from "motion/react";
import { useUi } from "@/store/ui";

export default function Toast() {
  const toast = useUi((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="toast glass"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
