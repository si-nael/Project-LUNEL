"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Group } from "@/types";
import { toast } from "sonner";
import { Terminal, Lock, Unlock, AlertTriangle } from "lucide-react";
import ChallengeModal from "@/components/dashboard/challenge-modal";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SecretGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Challenge Modal state
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [showModal, setShowModal] = useState(false);
    
    // Lockout state (simulated for 24 hours on client)
    const [lockedOutGroups, setLockedOutGroups] = useState<Record<string, number>>({});
    
    const router = useRouter();

    useEffect(() => {
        // Load locked groups from localStorage
        const stored = localStorage.getItem("lunel_locked_groups");
        if (stored) {
            try {
                setLockedOutGroups(JSON.parse(stored));
            } catch (e) {}
        }
        
        api.get<Group[]>("/groups/secret")
            .then(({ data }) => setGroups(data))
            .catch(() => toast.error("ACCESS DENIED: Failed to fetch secure nodes."))
            .finally(() => setLoading(false));
    }, []);

    const handleChallengeInit = (group: Group) => {
        if (lockedOutGroups[group.id] && Date.now() < lockedOutGroups[group.id]) {
            toast.error("SECURITY LOCKOUT: Try again later.");
            return;
        }
        setSelectedGroup(group);
        setShowModal(true);
    };

    const handleChallengeSuccess = async () => {
        if (!selectedGroup) return;
        
        try {
            // After challenge verification, join the group
            await api.post(`/groups/${selectedGroup.id}/join-via-challenge`);
            toast.success("ACCESS GRANTED: Welcome to the node.");
            setShowModal(false);
            
            // Redirect to the group page
            setTimeout(() => {
                router.push(`/dashboard/groups/${selectedGroup.id}`);
            }, 1000);
        } catch (error: any) {
            if (error.response?.status === 409) {
                // Already a member
                toast.success("Already a member. Rerouting...");
                router.push(`/dashboard/groups/${selectedGroup.id}`);
            } else {
                toast.error("ERROR: Failed to establish secure connection.");
            }
        }
    };

    const handleModalOpenChange = (open: boolean) => {
        setShowModal(open);
        if (!open) {
            // We don't necessarily know if they failed max attempts from here directly without lifting state,
            // but we can simulate it by letting the ChallengeModal show "Failed" internally.
            // If we wanted to lock them out, we'd add logic here or pass an onFail prop.
        }
    };
    
    // Simulate Lockout (would ideally be driven by a callback from modal on max fails)
    // For now, we'll just implement the UI for it.

    return (
        <div className="min-h-full bg-zinc-950 p-6 rounded-2xl border border-green-500/20 shadow-[inset_0_0_50px_rgba(34,197,94,0.05)] text-green-400 font-mono relative overflow-hidden">
            {/* Cyberpunk background accents */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50" />
            
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-green-500/30">
                <Terminal className="h-6 w-6 text-green-500" />
                <div>
                    <h1 className="text-xl font-bold uppercase tracking-widest text-green-400">Secure Nodes</h1>
                    <p className="text-xs text-green-500/70 mt-1">Proof-based networking interface. Solve to enter.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="h-8 w-8 border-2 border-green-500/20 border-t-green-500 animate-spin" />
                    <p className="text-xs text-green-500/50 animate-pulse uppercase tracking-widest">Decrypting network topology...</p>
                </div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 border border-dashed border-green-500/20 rounded-xl bg-green-500/5">
                    <AlertTriangle className="h-8 w-8 text-green-500/50 mb-3" />
                    <p className="text-sm text-green-500/70 uppercase">No secure nodes found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((g) => {
                        const isLocked = lockedOutGroups[g.id] && Date.now() < lockedOutGroups[g.id];
                        
                        return (
                            <div 
                                key={g.id} 
                                className={cn(
                                    "relative rounded-xl border p-5 transition-all duration-300",
                                    isLocked 
                                        ? "bg-red-950/20 border-red-500/30 text-red-400" 
                                        : "bg-black/40 border-green-500/30 hover:border-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)] group"
                                )}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className={cn(
                                        "text-sm font-bold uppercase tracking-wider",
                                        isLocked ? "text-red-500" : "text-green-300"
                                    )}>
                                        {isLocked ? "ACCESS DENIED" : g.name}
                                    </h3>
                                    {isLocked ? (
                                        <Lock className="h-4 w-4 text-red-500" />
                                    ) : (
                                        <Lock className="h-4 w-4 text-green-500/50 group-hover:text-green-400" />
                                    )}
                                </div>
                                
                                <div className={cn(
                                    "text-xs mb-6",
                                    isLocked ? "text-red-500/70" : "text-green-500/60"
                                )}>
                                    <p>TYPE: {g.type}</p>
                                    <p>MEMBERS: {g.member_count}</p>
                                    {isLocked && <p className="mt-2 text-red-500 animate-pulse">SECURITY LOCKDOWN ACTIVE</p>}
                                </div>
                                
                                <button
                                    onClick={() => handleChallengeInit(g)}
                                    disabled={!!isLocked}
                                    className={cn(
                                        "w-full py-2.5 text-xs font-bold uppercase tracking-widest border transition-all",
                                        isLocked 
                                            ? "border-red-500/30 bg-red-500/10 text-red-500/50 cursor-not-allowed" 
                                            : "border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black"
                                    )}
                                >
                                    {isLocked ? "SYSTEM LOCKED" : "[ INITIALIZE CHALLENGE ]"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedGroup && selectedGroup.visibility_policy_id && (
                <ChallengeModal
                    open={showModal}
                    onOpenChange={handleModalOpenChange}
                    policyId={selectedGroup.visibility_policy_id}
                    onSuccess={handleChallengeSuccess}
                    targetTitle={selectedGroup.name}
                    theme="cyberpunk"
                />
            )}
        </div>
    );
}
