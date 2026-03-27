import { SelfReportData, TelemetryData, createTelemetry } from "./telemetry";

export type SessionPhase = "arrival" | "conversation" | "reflection" | "closing";

export interface SessionData {
  id: string;
  phase: SessionPhase;
  intention: string;
  messages: Message[];
  exchangeCount: number;
  startedAt: number;
  takeaway: string;
  preReport?: SelfReportData;
  postReport?: SelfReportData;
  telemetry: TelemetryData;
  interventionsShown: { id: number; pillar: string; timestamp: number; engaged: boolean }[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface SessionSummary {
  id: string;
  intention: string;
  takeaway: string;
  duration: number;
  exchangeCount: number;
  date: string;
  preReport?: SelfReportData;
  postReport?: SelfReportData;
  pillarCoverage: string[];
}

export function createSession(): SessionData {
  return {
    id: crypto.randomUUID(),
    phase: "arrival",
    intention: "",
    messages: [],
    exchangeCount: 0,
    startedAt: Date.now(),
    takeaway: "",
    telemetry: createTelemetry(),
    interventionsShown: [],
  };
}

export function computePillarCoverage(interventions: SessionData['interventionsShown']): string[] {
  // A pillar is "covered" if at least one intervention of that type was shown AND engaged
  const covered = new Set<string>();
  for (const i of interventions) {
    if (i.engaged) covered.add(i.pillar);
  }
  return Array.from(covered);
}

export function saveSessionSummary(session: SessionData): void {
  const summary: SessionSummary = {
    id: session.id,
    intention: session.intention,
    takeaway: session.takeaway,
    duration: Date.now() - session.startedAt,
    exchangeCount: session.exchangeCount,
    date: new Date().toISOString(),
    preReport: session.preReport,
    postReport: session.postReport,
    pillarCoverage: computePillarCoverage(session.interventionsShown),
  };

  const existing = getSessionHistory();
  existing.unshift(summary);
  localStorage.setItem("mindful-sessions", JSON.stringify(existing.slice(0, 50)));
}

export function getSessionHistory(): SessionSummary[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("mindful-sessions") || "[]");
  } catch {
    return [];
  }
}
