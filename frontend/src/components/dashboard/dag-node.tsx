import { Handle, Position } from "@xyflow/react";
import { ActivityNode } from "@/types";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
    TODO: "bg-foreground/[0.04] border-border/40 text-foreground/70",
    IN_PROGRESS: "bg-primary/10 border-primary/30 text-primary",
    DONE: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
    BLOCKED: "bg-destructive/10 border-destructive/30 text-destructive",
};

export function DagNode({ data: rawData }: { data: Record<string, unknown> }) {
    const data = rawData as unknown as ActivityNode;
    return (
        <div
            className={cn(
                "px-4 py-3 rounded-2xl border backdrop-blur-md shadow-sm transition-all min-w-[150px]",
                statusColors[data.status || "TODO"]
            )}
        >
            <Handle type="target" position={Position.Top} className="w-2 h-2 rounded-full !bg-foreground/20 border-none" />
            
            <div className="font-semibold text-sm mb-1">{data.title || data.id.slice(0, 8)}</div>
            <div className="flex items-center justify-between mt-2 text-[10px] opacity-80">
                <span className="font-medium tracking-wide uppercase">{data.node_type}</span>
                <span>{data.progress}%</span>
            </div>
            
            <div className="w-full bg-foreground/10 h-1 rounded-full mt-2 overflow-hidden">
                <div 
                    className="h-full bg-current transition-all duration-500" 
                    style={{ width: `${data.progress}%` }} 
                />
            </div>

            <Handle type="source" position={Position.Bottom} className="w-2 h-2 rounded-full !bg-foreground/20 border-none" />
        </div>
    );
}
