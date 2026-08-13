











export interface ConfigValues {
  userContext: string;
  targetName: string;
  datasetInfo: string;
  maxDepth: number;
  minSamples: number;
  agentCandidates: number;
  agentReflections: number;
}

export const DEFAULT_CONFIG: ConfigValues = {
  userContext: "",
  targetName: "",
  datasetInfo: "",
  maxDepth: 4,
  minSamples: 1,
  agentCandidates: 8,
  agentReflections: 0,
};

interface NumericRange {
  min: number;
  max: number;
  step: number;
}

export const NUMERIC_RANGES: Record<
  "maxDepth" | "minSamples" | "agentCandidates" | "agentReflections",
  NumericRange
> = {
  maxDepth: { min: 1, max: 10, step: 1 },
  minSamples: { min: 0, max: 10, step: 0.1 },
  agentCandidates: { min: 1, max: 20, step: 1 },
  agentReflections: { min: 0, max: 20, step: 1 },
};


export const CHECKLIST_START = "@@CHECKLIST@@";
export const CHECKLIST_END = "@@END_CHECKLIST@@";
export const CONFIG_START = "@@CONFIG@@";
export const CONFIG_END = "@@END_CONFIG@@";
export const PAPERS_START = "@@PAPERS@@";
export const PAPERS_END = "@@END_PAPERS@@";

const START_MARKERS = [CHECKLIST_START, CONFIG_START, PAPERS_START];


export interface ChecklistOption {
  id: string;
  label: string;
}

export interface ChecklistQuestion {
  id: string;
  text: string;
}

export type ChecklistItem =
  | { id: string; type: "single_select"; prompt: string; options: ChecklistOption[] }
  | { id: string; type: "multi_select"; prompt: string; options: ChecklistOption[] }
  | { id: string; type: "questions"; prompt: string; questions: ChecklistQuestion[] }
  | { id: string; type: "custom_instructions"; prompt: string }
  | { id: string; type: "actions"; prompt?: string; options: ChecklistOption[] };

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}


export interface PaperLinks {
  doi?: string;
  scopus?: string;
  fullText?: string;
}

export interface Paper {
  id: string;
  title: string;
  authors?: string;
  year?: string;
  venue?: string;
  doi?: string;
  pageRange?: string;
  openAccess?: boolean;
  citedBy?: number;
  relevance?: string;
  links: PaperLinks;
}


function clampNumber(value: number, range: NumericRange): number {
  const stepped = Math.round(value / range.step) * range.step;
  const bounded = Math.max(range.min, Math.min(range.max, stepped));

  return Math.round(bounded * 100) / 100;
}



export function clampConfig(input: unknown): Partial<ConfigValues> {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: Partial<ConfigValues> = {};

  for (const key of ["targetName", "datasetInfo", "userContext"] as const) {
    if (typeof raw[key] === "string") out[key] = raw[key] as string;
  }

  for (const key of ["maxDepth", "minSamples", "agentCandidates", "agentReflections"] as const) {
    const v = raw[key];
    const num = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    if (!Number.isNaN(num)) out[key] = clampNumber(num, NUMERIC_RANGES[key]);
  }

  return out;
}


function removeCompleteBlocks(text: string, start: string, end: string): string {
  let out = text;
  for (;;) {
    const s = out.indexOf(start);
    if (s < 0) break;
    const e = out.indexOf(end, s + start.length);
    if (e < 0) break;
    out = out.slice(0, s) + out.slice(e + end.length);
  }
  return out;
}



function hidePartialTrailingMarker(text: string, marker: string): string {
  for (let n = marker.length - 1; n > 0; n--) {
    if (text.endsWith(marker.slice(0, n))) return text.slice(0, text.length - n);
  }
  return text;
}



export function displayText(text: string): string {
  let out = removeCompleteBlocks(text, CHECKLIST_START, CHECKLIST_END);
  out = removeCompleteBlocks(out, CONFIG_START, CONFIG_END);
  out = removeCompleteBlocks(out, PAPERS_START, PAPERS_END);



  let cut = -1;
  for (const marker of START_MARKERS) {
    const idx = out.indexOf(marker);
    if (idx >= 0 && (cut < 0 || idx < cut)) cut = idx;
  }
  if (cut >= 0) out = out.slice(0, cut);

  for (const marker of START_MARKERS) out = hidePartialTrailingMarker(out, marker);

  return out.replace(/\s*\n-{3,}\s*$/, "").trim();
}


function extractBlock(text: string, start: string, end: string): string | null {
  const s = text.indexOf(start);
  if (s < 0) return null;
  const e = text.indexOf(end, s + start.length);
  if (e < 0) return null;
  return text.slice(s + start.length, e).trim();
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {

    const fenced = json.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(fenced);
    } catch {
      return null;
    }
  }
}

const VALID_ITEM_TYPES = new Set([
  "single_select",
  "multi_select",
  "questions",
  "custom_instructions",
  "actions",
]);



export function parseChecklist(text: string): Checklist | null {
  const block = extractBlock(text, CHECKLIST_START, CHECKLIST_END);
  if (!block) return null;
  const parsed = safeParse(block);
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: ChecklistItem[] = [];

  rawItems.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;
    const type = String(item.type);
    if (!VALID_ITEM_TYPES.has(type)) return;
    const id = typeof item.id === "string" && item.id ? item.id : `item-${index}`;
    const prompt = typeof item.prompt === "string" ? item.prompt : "";

    if (type === "single_select" || type === "multi_select" || type === "actions") {
      const options = Array.isArray(item.options)
        ? (item.options as unknown[])
            .map((o, i) => {
              if (!o || typeof o !== "object") return null;
              const opt = o as Record<string, unknown>;
              const label = typeof opt.label === "string" ? opt.label : "";
              if (!label) return null;
              return { id: typeof opt.id === "string" && opt.id ? opt.id : `opt-${i}`, label };
            })
            .filter((o): o is ChecklistOption => o !== null)
        : [];
      if (!options.length) return;
      items.push({ id, type, prompt, options } as ChecklistItem);
    } else if (type === "questions") {
      const questions = Array.isArray(item.questions)
        ? (item.questions as unknown[])
            .map((q, i) => {
              if (!q || typeof q !== "object") return null;
              const qq = q as Record<string, unknown>;
              const t = typeof qq.text === "string" ? qq.text : "";
              if (!t) return null;
              return { id: typeof qq.id === "string" && qq.id ? qq.id : `q-${i}`, text: t };
            })
            .filter((q): q is ChecklistQuestion => q !== null)
        : [];
      if (!questions.length) return;
      items.push({ id, type, prompt, questions });
    } else if (type === "custom_instructions") {
      items.push({ id, type, prompt });
    }
  });

  if (!items.length) return null;

  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : `checklist-${Date.now()}`,
    title: typeof obj.title === "string" ? obj.title : "A few questions",
    items,
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function looksLikePlaceholder(value: string): boolean {
  return /x{3,}|\.{3}|placeholder|example\.com|your[-_]?doi|todo/i.test(value);
}


function safeUrl(value: unknown): string | undefined {
  const raw = optionalString(value);
  if (!raw) return undefined;
  if (!/^https?:\/\
  if (looksLikePlaceholder(raw)) return undefined;
  return raw;
}

function normalizeDoi(value: unknown): string | undefined {
  const raw = optionalString(value);
  if (!raw) return undefined;
  const clean = raw.replace(/^https?:\/\/(dx\.)?doi\.org\
  if (!clean || looksLikePlaceholder(clean)) return undefined;
  return clean;
}

function doiLandingUrl(doi: string | undefined): string | undefined {
  return doi ? `https://doi.org/${doi}` : undefined;
}

function scopusRecordUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const scp = id.replace(/^SCOPUS_ID:/i, "").trim();
  if (!/^\d+$/.test(scp)) return undefined;
  return `https://www.scopus.com/inward/record.uri?partnerID=HzOxMe3b&scp=${scp}&origin=inward`;
}



export function resolvePaperLinks(paper: {
  id?: string;
  doi?: string;
  openAccess?: boolean;
  links?: PaperLinks;
}): PaperLinks {
  const doi = normalizeDoi(paper.doi);
  const fromDoi = doiLandingUrl(doi);
  return {
    doi: safeUrl(paper.links?.doi) ?? fromDoi,
    scopus: safeUrl(paper.links?.scopus) ?? scopusRecordUrl(paper.id),


    fullText: safeUrl(paper.links?.fullText) ?? (paper.openAccess ? fromDoi : undefined),
  };
}



export function parsePapers(text: string): Paper[] | null {
  const block = extractBlock(text, PAPERS_START, PAPERS_END);
  if (!block) return null;
  const parsed = safeParse(block);

  const rawList = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).papers)
      ? ((parsed as Record<string, unknown>).papers as unknown[])
      : parsed && typeof parsed === "object"
        ? [parsed]
        : [];

  const papers: Paper[] = [];
  rawList.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;
    const title = optionalString(item.title);
    if (!title) return;

    const rawLinks = (item.links && typeof item.links === "object" ? item.links : {}) as PaperLinks;
    const doi = normalizeDoi(item.doi);
    const id = optionalString(item.id) ?? `paper-${index}`;
    const openAccess = item.openAccess === true;
    const links = resolvePaperLinks({
      id,
      doi,
      openAccess,
      links: {
        doi: optionalString(rawLinks.doi),
        scopus: optionalString(rawLinks.scopus),
        fullText: optionalString(rawLinks.fullText),
      },
    });

    const citedByRaw = item.citedBy;
    const citedBy = typeof citedByRaw === "number"
      ? citedByRaw
      : typeof citedByRaw === "string" && citedByRaw.trim() !== "" && !Number.isNaN(Number(citedByRaw))
        ? Number(citedByRaw)
        : undefined;

    papers.push({
      id,
      title,
      authors: optionalString(item.authors),
      year: optionalString(item.year) ?? (typeof item.year === "number" ? String(item.year) : undefined),
      venue: optionalString(item.venue),
      doi,
      pageRange: optionalString(item.pageRange),
      openAccess,
      citedBy,
      relevance: optionalString(item.relevance),
      links,
    });
  });

  return papers.length ? papers : null;
}


export function parseConfig(text: string): Partial<ConfigValues> | null {
  const block = extractBlock(text, CONFIG_START, CONFIG_END);
  if (!block) return null;
  const parsed = safeParse(block);
  if (!parsed) return null;
  const clamped = clampConfig(parsed);
  return Object.keys(clamped).length ? clamped : null;
}
