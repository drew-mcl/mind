import type { TaskStatus } from "@/types";
import { cn } from "@/lib/cn";

const dotColors: Record<TaskStatus, string> = {
  pending: "bg-status-pending",
  in_progress: "bg-status-progress",
  blocked: "bg-status-blocked",
  done: "bg-status-done",
};

export function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-block h-[7px] w-[7px] rounded-full ring-2 ring-white",
        dotColors[status],
      )}
    />
  );
}
