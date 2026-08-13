



import { useState, useRef } from "react";
import { ArrowRight, Upload, X, FileText, Clock, Sparkles, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useAdvice } from "../AdviceContext";
import TooltipIcon from "../TooltipIcon";
import InteractiveConfigChat from "./InteractiveConfigChat";
import { ConfigValues, DEFAULT_CONFIG } from "../../lib/configureProtocol";


interface SliderProps {
  label: string;
  tooltip: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  reversed?: boolean;
  defaultValue?: number;
}

function ConfigSlider({ label, tooltip, value, onChange, min, max, step, formatValue, reversed, defaultValue }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');

  const rawPct = (value - min) / (max - min);
  const thumbPct = reversed ? 1 - rawPct : rawPct;

  const valueFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    let pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (reversed) pct = 1 - pct;
    const raw = min + pct * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(valueFromClientX(e.clientX));
    const move = (e: MouseEvent) => onChange(valueFromClientX(e.clientX));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const commitEdit = () => {
    const parsed = parseFloat(editInput);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      const stepped = Math.round(parsed / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    }
    setIsEditing(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-foreground">{label}</span>
        <TooltipIcon text={tooltip} />
        {isEditing ? (
          <input
            className="ml-auto w-16 text-sm font-medium text-right border border-border rounded px-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={editInput}
            onChange={e => setEditInput(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setIsEditing(false); }}
            autoFocus
          />
        ) : (
          <span
            className="ml-auto text-sm font-medium tabular-nums cursor-pointer hover:text-primary transition-colors"
            onClick={() => { setEditInput(String(value)); setIsEditing(true); }}
            title="Click to edit"
          >
            {formatValue(value)}
          </span>
        )}
      </div>

      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative h-6 flex items-center cursor-pointer select-none"
      >
        <div
          className="absolute left-0 right-0 h-1.5 rounded-full"
          style={{ background: "linear-gradient(to right, #16a34a, #dc2626)" }}
        />
        <div
          className="absolute w-4 h-4 bg-white border-2 rounded-full shadow-md transition-none"
          style={{ left: `calc(${thumbPct * 100}% - 8px)`, borderColor: "rgba(0,0,0,0.18)" }}
          onDoubleClick={e => { e.stopPropagation(); if (defaultValue !== undefined) onChange(defaultValue); }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Fast / Exploratory</span>
        <span>Slow / Paper-Quality</span>
      </div>
    </div>
  );
}


type RGB = [number, number, number];
const GREEN: RGB  = [22, 163, 74];
const ORANGE: RGB = [234, 88, 12];
const RED: RGB    = [220, 38, 38];

function lerp(a: RGB, b: RGB, t: number): string {
  t = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

function timeColor(hours: number): string {
  if (hours >= 10) return lerp(ORANGE, RED, 1);
  if (hours >= 5)  return lerp(ORANGE, RED, (hours - 5) / 5);
  if (hours >= 1)  return lerp(GREEN, ORANGE, (hours - 1) / 4);
  return lerp(GREEN, ORANGE, hours / 1);
}

function qualityColor(units: number): string {
  if (units >= 10000) return lerp(GREEN, GREEN, 1);
  if (units >= 2000)  return lerp(RED, GREEN, (units - 2000) / 8000);
  return lerp(RED, ORANGE, units / 2000);
}


const TOOLTIPS = {
  userContext:      "Any extra information or instructions you'd like the AI to consider when building your tree. The more specific you are, the better the results.",
  targetName:       "A short name for what the decision tree is trying to predict. For example, 'customer churn' or 'disease presence'. This helps the AI understand the goal.",
  datasetInfo:      "A brief description of your dataset. For example, 'customer transaction records' or 'genomic sequence features'. This helps the AI understand what kind of data it's working with.",
  maxDepth:         "How many decisions the tree can make in sequence before reaching a conclusion. Deeper trees can capture more complex patterns but take longer to build and may be harder to interpret.",
  minSamples:       "The smallest allowed group size at each decision point, as a percentage of your total data. Larger minimums are faster but may miss subtle patterns. Smaller minimums are more thorough but slower.",
  agentCandidates:  "How many alternative decision rules the AI proposes at each step. More candidates give the AI more options to pick from — increasing the chance of finding a great split — but takes proportionally longer.",
  agentReflections: "How many times the AI re-examines and improves its proposed rules at each step. More reflections produce more refined, thoughtful features — but each reflection adds proportionally more time and cost.",
};

type ConfigMode = "standard" | "interactive";

interface ConfigureModelViewProps {

  generateLabel?: string;
}

export default function ConfigureModelView({ generateLabel = "Generate" }: ConfigureModelViewProps) {
  const { submittedAdvice, removeSubmittedAdvice } = useAdvice();
  const [mode, setMode] = useState<ConfigMode>("standard");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const [cfg, setCfg] = useState<ConfigValues>({ ...DEFAULT_CONFIG });
  const set = (key: keyof ConfigValues) => (v: number | string) =>
    setCfg(prev => ({ ...prev, [key]: v }));

  const applyConfigPartial = (partial: Partial<ConfigValues>) => {
    if (!Object.keys(partial).length) return;
    setCfg(prev => ({ ...prev, ...partial }));
  };

  const handleGenerate = (sourceCfg: ConfigValues = cfg) => {
    console.log(generateLabel, { cfg: sourceCfg, submittedAdvice, uploadedFiles });
  };

  const adviceSummaries = submittedAdvice.map(a => ({
    message: a.message,
    handoffSnippet: a.handoffSnippet,
  }));


  const timeUnits = Math.pow(2, cfg.maxDepth) * cfg.agentCandidates * (1 + cfg.agentReflections);
  const hours = timeUnits / 2500;
  const cappedHours = Math.min(hours, 10);

  const timeLabel = hours >= 10 ? "10+ hours"
    : hours >= 1   ? `${hours.toFixed(1)} hours`
    : hours * 60 < 1 ? "< 1 min"
    : `~${Math.round(hours * 60)} min`;

  const timeSeverity = hours < 1 ? "Low" : hours < 5 ? "Medium" : "High";
  const qualityLevel = timeUnits < 2000 ? "Low" : timeUnits < 10000 ? "Medium" : "High";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };


  const submittedAdviceBlock = submittedAdvice.length > 0 && (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Submitted Advice:</p>
      {submittedAdvice.map(item => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex-1">
            <p className="text-sm text-foreground mb-2">{item.message}</p>
            {item.handoffSnippet && (
              <div className="mb-2">
                <span className="text-xs font-medium text-muted-foreground">Handoff for tree generation:</span>
                <p className="text-xs font-mono whitespace-pre-wrap bg-white border border-green-300 rounded px-3 py-2 text-foreground mt-1">
                  {item.handoffSnippet}
                </p>
              </div>
            )}
            {item.contextNodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.contextNodes.map(node => (
                  <div key={node.id} className="flex items-center gap-2 px-2 py-1 bg-white border border-green-300 rounded text-xs">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{node.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => removeSubmittedAdvice(item.id)} className="p-1 hover:bg-green-100 rounded transition-colors ml-3">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );

  const uploadedFilesList = uploadedFiles.length > 0 && (
    <div className="space-y-2">
      {uploadedFiles.map((file, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button onClick={() => setUploadedFiles(f => f.filter((_, j) => j !== i))} className="p-1 hover:bg-background rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );

  const estimationCards = (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-5 bg-card border border-border rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Estimated Generation Time</span>
        </div>
        <div>
          <div className="text-2xl font-semibold" style={{ color: timeColor(hours) }}>
            {timeSeverity}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{timeLabel}</div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(cappedHours / 10) * 100}%`, background: timeColor(hours) }}
          />
        </div>
      </div>

      <div className="p-5 bg-card border border-border rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          <span>Estimated Prediction Quality</span>
        </div>
        <div>
          <div className="text-2xl font-semibold" style={{ color: qualityColor(timeUnits) }}>
            {qualityLevel}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            Score: {timeUnits.toLocaleString()}
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (timeUnits / 10000) * 100)}%`, background: qualityColor(timeUnits) }}
          />
        </div>
      </div>
    </div>
  );

  const generateButton = (
    <div className="pt-4">
      <button
        onClick={() => handleGenerate()}
        className="w-full bg-primary text-primary-foreground px-8 py-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-3 group"
      >
        <span>Generate Decision Tree</span>
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      {}
      <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
        {([
          { key: "standard", label: "Standard Configuration", icon: SlidersHorizontal },
          { key: "interactive", label: "Interactive Configuration", icon: MessageSquare },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
              mode === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "standard" ? (
        <>
          {}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="target" className="text-foreground">Target Prediction</label>
                <TooltipIcon text={TOOLTIPS.targetName} />
              </div>
              <input
                id="target"
                type="text"
                value={cfg.targetName}
                onChange={e => set("targetName")(e.target.value)}
                placeholder="e.g. customer churn"
                className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all text-sm"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="dataset" className="text-foreground">Dataset Context</label>
                <TooltipIcon text={TOOLTIPS.datasetInfo} />
              </div>
              <input
                id="dataset"
                type="text"
                value={cfg.datasetInfo}
                onChange={e => set("datasetInfo")(e.target.value)}
                placeholder="e.g. tabular features from customer records"
                className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all text-sm"
              />
            </div>
          </div>

          {}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="ctx" className="text-foreground">Additional Context</label>
              <TooltipIcon text={TOOLTIPS.userContext} />
            </div>
            <textarea
              id="ctx"
              value={cfg.userContext}
              onChange={e => set("userContext")(e.target.value)}
              placeholder="Add instructions, context, or references to papers, data, and figures you'd like the agent to consider when building the tree."
              className="w-full h-28 px-4 py-3 bg-input-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all text-sm"
            />
          </div>

          {}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <label className="text-foreground">Reference Materials</label>
              <TooltipIcon text="Upload papers, datasets, or figures for the agent to reference when building the tree." />
            </div>
            <div className="border-2 border-dashed border-border rounded-lg p-6 hover:border-muted-foreground transition-colors">
              <input type="file" id="file-upload" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.csv,.txt,.png,.jpg,.jpeg" />
              <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-foreground mb-1">Upload papers, datasets, or figures</p>
                <p className="text-xs text-muted-foreground">PDF, CSV, TXT, PNG, JPG up to 10MB each</p>
              </label>
            </div>

            {uploadedFilesList}
            {submittedAdviceBlock}
          </div>

          {}
          <div className="space-y-6 p-5 bg-card border border-border rounded-xl">
            <ConfigSlider
              label="Maximum Tree Depth"
              tooltip={TOOLTIPS.maxDepth}
              value={cfg.maxDepth}
              onChange={v => set("maxDepth")(v)}
              min={1} max={10} step={1}
              formatValue={v => String(v)}
              defaultValue={4}
            />
            <ConfigSlider
              label="Minimum Node Sample Percentage"
              tooltip={TOOLTIPS.minSamples}
              value={cfg.minSamples}
              onChange={v => set("minSamples")(v)}
              min={0} max={10} step={0.1}
              formatValue={v => `${v.toFixed(1)}%`}
              reversed
              defaultValue={1}
            />
            <ConfigSlider
              label="Agent Candidates"
              tooltip={TOOLTIPS.agentCandidates}
              value={cfg.agentCandidates}
              onChange={v => set("agentCandidates")(v)}
              min={1} max={20} step={1}
              formatValue={v => String(v)}
              defaultValue={8}
            />
            <ConfigSlider
              label="Agent Reflections"
              tooltip={TOOLTIPS.agentReflections}
              value={cfg.agentReflections}
              onChange={v => set("agentReflections")(v)}
              min={0} max={20} step={1}
              formatValue={v => String(v)}
              defaultValue={0}
            />
          </div>

          {estimationCards}
          {generateButton}
        </>
      ) : (
        <InteractiveConfigChat
          cfg={cfg}
          onApplyConfig={applyConfigPartial}
          onAttachFiles={files => setUploadedFiles(prev => [...prev, ...files])}
          submittedAdvice={adviceSummaries}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
