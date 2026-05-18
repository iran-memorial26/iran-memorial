/**
 * Derives the case status of a victim from their cause_of_death and date_of_death.
 * No DB migration needed — status is derived at runtime.
 */

export type CaseStatus =
  | "executed"
  | "death_in_custody"
  | "killed"
  | "imprisoned"
  | "disappeared"
  | "deceased";

export function getCaseStatus(
  causeOfDeath: string | null | undefined,
  dateOfDeath: Date | string | null | undefined
): CaseStatus {
  const cause = (causeOfDeath || "").toLowerCase();
  const isDead = !!dateOfDeath;

  // Cause-of-death takes precedence over the missing-date heuristic:
  // ~1,400 Boroumand 1980s mass-execution victims have an execution
  // cause but no recorded date. They are dead, just dateless. Exception:
  // "Sentenced to death (imprisoned)" — those are still alive on death
  // row and must NOT classify as executed.
  const hasExecCause =
    cause.includes("execution") ||
    cause.includes("hanged") ||
    cause.includes("hanging") ||
    cause.includes("firing squad") ||
    cause.includes("اعدام");
  if (hasExecCause && !cause.includes("sentenced")) {
    return "executed";
  }

  if (!isDead) {
    if (cause.includes("imprisoned") || cause.includes("inhaftiert") || cause.includes("sentence")) {
      return "imprisoned";
    }
    if (cause.includes("disappear") || cause.includes("vermisst")) {
      return "disappeared";
    }
    return "imprisoned"; // default for alive entries with no-date
  }

  // Deceased — categorize by cause
  if (cause.includes("execution") || cause.includes("hanging") || cause.includes("firing squad") || cause.includes("afd")) {
    return "executed";
  }
  if (cause.includes("death in custody") || cause.includes("custody")) {
    return "death_in_custody";
  }
  if (cause.includes("shooting") || cause.includes("shot") || cause.includes("bullet") || cause.includes("sniper") || cause.includes("birdshot") || cause.includes("pellet")) {
    return "killed";
  }
  if (cause.includes("torture") || cause.includes("beating")) {
    return "killed";
  }
  return "deceased";
}

export type StatusConfig = {
  label: Record<string, string>;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  /** Monospace shape distinguishable WITHOUT color. Carries the same
   *  information as the colored dot so red-green color-blind users
   *  (~5% of men incl. in Iran) can tell the categories apart. */
  shape: string;
};

export const STATUS_CONFIG: Record<CaseStatus, StatusConfig> = {
  executed: {
    label: { en: "Executed", de: "Hingerichtet", fa: "اعدام شده", ar: "أُعدم", fr: "Exécuté", it: "Giustiziato", es: "Ejecutado" },
    color: "text-blood-400",
    bgColor: "bg-blood-400/10",
    borderColor: "border-blood-400/30",
    dotColor: "bg-blood-400",
    shape: "✕",
  },
  death_in_custody: {
    label: { en: "Death in Custody", de: "Tod in Haft", fa: "مرگ در بازداشت", ar: "وفاة في الحجز", fr: "Mort en détention", it: "Morte in custodia", es: "Muerte bajo custodia" },
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/30",
    dotColor: "bg-orange-400",
    shape: "⊘",
  },
  killed: {
    label: { en: "Killed", de: "Getötet", fa: "کشته شده", ar: "قُتل", fr: "Tué", it: "Ucciso", es: "Asesinado" },
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    borderColor: "border-red-400/30",
    dotColor: "bg-red-400",
    shape: "▲",
  },
  imprisoned: {
    label: { en: "Currently Imprisoned", de: "Aktuell inhaftiert", fa: "در حال حاضر در زندان", ar: "مسجون حالياً", fr: "Actuellement emprisonné", it: "Attualmente in carcere", es: "Actualmente encarcelado" },
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/30",
    dotColor: "bg-amber-400",
    shape: "■",
  },
  disappeared: {
    label: { en: "Disappeared", de: "Verschwunden", fa: "ناپدید شده", ar: "مختفٍ", fr: "Disparu", it: "Scomparso", es: "Desaparecido" },
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/30",
    dotColor: "bg-purple-400",
    shape: "?",
  },
  deceased: {
    label: { en: "Deceased", de: "Verstorben", fa: "درگذشته", ar: "متوفى", fr: "Décédé", it: "Deceduto", es: "Fallecido" },
    color: "text-memorial-400",
    bgColor: "bg-memorial-400/10",
    borderColor: "border-memorial-400/30",
    dotColor: "bg-memorial-400",
    shape: "○",
  },
};
