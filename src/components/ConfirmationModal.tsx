import { useStore } from "@/store";
import { cn } from "@/lib/cn";

export function ConfirmationModal() {
  const { isOpen, title, message, onConfirm, confirmLabel, variant } = useStore((s) => s.confirmationModal);
  const closeConfirmationModal = useStore((s) => s.closeConfirmationModal);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-canvas/40 backdrop-blur-sm transition-opacity" 
        onClick={closeConfirmationModal}
      />
      
      {/* Modal Card */}
      <div 
        className={cn(
          "relative w-full max-w-sm rounded-2xl bg-surface/90 backdrop-blur-xl p-6 shadow-2xl border border-border/50 transition-all scale-100",
          "animate-in fade-in zoom-in duration-200"
        )}
      >
        <h3 className="text-lg font-bold tracking-tight text-text-primary mb-2">
          {title}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {message}
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={closeConfirmationModal}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-tertiary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              closeConfirmationModal();
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95",
              variant === "danger" 
                ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20" 
                : "bg-accent text-white hover:bg-accent-hover shadow-accent/20"
            )}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
