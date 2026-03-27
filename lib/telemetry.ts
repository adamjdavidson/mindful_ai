export interface TelemetryData {
  messageTimestamps: number[];    // timestamp of each user message
  messageLengths: number[];       // character count per user message
  checkpointEngagements: {
    pillar: string;
    engaged: boolean;             // true if user spent 2+ seconds before continuing
    durationMs: number;
  }[];
  meditationCompleted: boolean;
  reflectionLength: number;       // character count of reflection/takeaway text
  sessionDurationMs: number;
}

export interface SelfReportData {
  awareness: number;   // 1-7
  calm: number;        // 1-7
  agency: number;      // 1-7
  clarity: number;     // 1-7
  intentionAlignment?: number; // 1-7, post-session only
  timestamp: number;
}

export function createTelemetry(): TelemetryData {
  return {
    messageTimestamps: [],
    messageLengths: [],
    checkpointEngagements: [],
    meditationCompleted: false,
    reflectionLength: 0,
    sessionDurationMs: 0,
  };
}

export function recordMessage(telemetry: TelemetryData, content: string): TelemetryData {
  return {
    ...telemetry,
    messageTimestamps: [...telemetry.messageTimestamps, Date.now()],
    messageLengths: [...telemetry.messageLengths, content.length],
  };
}

export function recordCheckpoint(telemetry: TelemetryData, pillar: string, durationMs: number): TelemetryData {
  return {
    ...telemetry,
    checkpointEngagements: [
      ...telemetry.checkpointEngagements,
      { pillar, engaged: durationMs >= 2000, durationMs },
    ],
  };
}

export function recordMeditation(telemetry: TelemetryData, completed: boolean): TelemetryData {
  return { ...telemetry, meditationCompleted: completed };
}

export function recordReflection(telemetry: TelemetryData, text: string): TelemetryData {
  return { ...telemetry, reflectionLength: text.length };
}

export function finalizeTelemetry(telemetry: TelemetryData, startedAt: number): TelemetryData {
  return { ...telemetry, sessionDurationMs: Date.now() - startedAt };
}
