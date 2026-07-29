export type ProblemKind = "ANSWER" | "CODE" | "MANUAL";
export type ProblemStatus = "DRAFT" | "READY";
export type RuntimeMode = "IOI" | "ICPC";
export type RuntimeState =
    | "DRAFT"
    | "REGISTRATION"
    | "RUNNING"
    | "FROZEN"
    | "FINISHED"
    | "CANCELLED";

export interface EngineHealth {
    status: "ok";
    engine: "LUNEL";
    version: string;
    database: string;
}

export interface EngineProblem {
    id: string;
    slug: string;
    title: string;
    statement: string;
    kind: ProblemKind;
    checker: "EXACT" | "TOKENS" | "FLOAT";
    default_points: number;
    expected_answer: string | null;
    status: ProblemStatus;
    created_at: string;
    updated_at: string;
}

export interface RuntimeProblem {
    id: string;
    runtime_id: string;
    problem_id: string;
    label: string;
    points: number;
    order_index: number;
    slug: string;
    title: string;
    statement: string;
    kind: ProblemKind;
    checker: string;
}

export interface EngineRuntime {
    id: string;
    title: string;
    mode: RuntimeMode;
    state: RuntimeState;
    wrong_penalty_minutes: number;
    freeze_at: string | null;
    started_at: string | null;
    created_at: string;
    updated_at: string;
    problems: RuntimeProblem[];
    participant_count: number;
    submission_count: number;
}

export interface EngineParticipant {
    id: string;
    runtime_id: string;
    name: string;
    external_key: string | null;
    created_at: string;
}

export interface EngineSubmission {
    id: string;
    runtime_id: string;
    runtime_problem_id: string;
    participant_id: string;
    language: string | null;
    source_code: string | null;
    verdict: string;
    score: number;
    penalty: number;
    judge_message: string | null;
    submitted_at: string;
    judged_at: string | null;
}

export interface ScoreboardProblem {
    id: string;
    label: string;
    title: string;
    points: number;
}

export interface ScoreboardRow {
    rank: number;
    participant_id: string;
    name: string;
    score: number;
    solved: number;
    penalty: number;
    frozen_submissions: number;
    problems: Record<
        string,
        {
            solved: boolean;
            attempts: number;
            penalty?: number;
            score?: number;
            max_score?: number;
            verdict?: string | null;
        }
    >;
}

export interface EngineScoreboard {
    runtime_id: string;
    title: string;
    mode: RuntimeMode;
    state: RuntimeState;
    frozen: boolean;
    problems: ScoreboardProblem[];
    rankings: ScoreboardRow[];
}
