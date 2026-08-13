import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { GitBranch, Upload, Trash2, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { convertJsonToFeatureNode, buildTreeDescription, buildTreeTitle, type TreeJson } from "./jsonTreeConverter";
import { useUploadedTrees } from "./UploadedTreesContext";

interface SampleTree {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  route?: string;
}

interface LoadingEntry {
  id: string;
  filename: string;
  stage: number;
}

const LOADING_STAGES = [
  "Reading JSON structure…",
  "Parsing tree nodes…",
  "Validating feature definitions…",
  "Building visualization…",
  "Finalising…",
];

const BUILT_IN_TREES: SampleTree[] = [
  {
    id: "pol-ii",
    name: "Pol II Pausing Tree",
    description: "Basic decision tree for RNA polymerase II pausing prediction",
    isBuiltIn: true,
    route: "/admin/visualize/pol-ii",
  },
  {
    id: "enhanced",
    name: "Enhanced Pausing Tree",
    description: "Extended tree with additional position and composition features",
    isBuiltIn: true,
    route: "/admin/visualize/enhanced",
  },
];

export default function ExampleTreeViewer() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { trees: uploadedTrees, addTree, removeTree } = useUploadedTrees();
  const [loadingEntries, setLoadingEntries] = useState<LoadingEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const uploadedSampleTrees: SampleTree[] = uploadedTrees.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isBuiltIn: false,
    route: `/admin/visualize/uploaded/${t.id}`,
  }));

  const allTrees = [...BUILT_IN_TREES, ...uploadedSampleTrees];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setErrorMsg("Only .json files are supported.");
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setErrorMsg(null);
    const entryId = Math.random().toString(36).slice(2);
    const entry: LoadingEntry = { id: entryId, filename: file.name, stage: 0 };
    setLoadingEntries(prev => [...prev, entry]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;

      let json: TreeJson;
      try {
        json = JSON.parse(text);
      } catch {
        setLoadingEntries(prev => prev.filter(e => e.id !== entryId));
        setErrorMsg(`Failed to parse ${file.name}: invalid JSON.`);
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }

      if (!json.nodes || !json.root_id) {
        setLoadingEntries(prev => prev.filter(e => e.id !== entryId));
        setErrorMsg(`Invalid tree format in ${file.name}: missing "nodes" or "root_id".`);
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }

      let stage = 0;
      const interval = setInterval(() => {
        stage += 1;
        if (stage < LOADING_STAGES.length) {
          setLoadingEntries(prev =>
            prev.map(e => e.id === entryId ? { ...e, stage } : e)
          );
        } else {
          clearInterval(interval);
          setLoadingEntries(prev => prev.filter(e => e.id !== entryId));

          try {
            const featureTree = convertJsonToFeatureNode(json);
            const treeName = buildTreeTitle(json.meta, file.name);
            const treeDesc = buildTreeDescription(json.meta);

            addTree({
              id: entryId,
              name: treeName,
              description: treeDesc,
              tree: featureTree,
              meta: json.meta as Record<string, unknown>,
            });
          } catch (err) {
            setErrorMsg(`Failed to build tree from ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
            setTimeout(() => setErrorMsg(null), 5000);
          }
        }
      }, 600);
    };

    reader.onerror = () => {
      setLoadingEntries(prev => prev.filter(e => e.id !== entryId));
      setErrorMsg(`Failed to read ${file.name}.`);
      setTimeout(() => setErrorMsg(null), 5000);
    };

    reader.readAsText(file);
  };

  const handleDelete = (id: string) => {
    removeTree(id);
  };

  const handleTreeClick = (tree: SampleTree) => {
    if (tree.route) navigate(tree.route);
  };

  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allTrees.length} tree{allTrees.length !== 1 ? "s" : ""} available
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Upload className="w-4 h-4" />
          Add Tree
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {}
      <div className="space-y-2">
        {allTrees.map(tree => (
          <div
            key={tree.id}
            onClick={() => handleTreeClick(tree)}
            className={`group flex items-center gap-4 p-4 bg-card border border-border rounded-lg transition-all ${
              tree.route
                ? "cursor-pointer hover:border-primary/50 hover:shadow-sm"
                : "cursor-default opacity-70"
            }`}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{tree.name}</p>
                {tree.isBuiltIn && (
                  <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                    built-in
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{tree.description}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!tree.isBuiltIn && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(tree.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-all"
                  title="Remove tree"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {tree.route && (
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        ))}

        {}
        {loadingEntries.map(entry => (
          <div
            key={entry.id}
            className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate text-muted-foreground">{entry.filename}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{LOADING_STAGES[entry.stage]}</p>
              {}
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${((entry.stage + 1) / LOADING_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        {allTrees.length === 0 && loadingEntries.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <GitBranch className="w-8 h-8 opacity-30" />
            <p className="text-sm">No trees yet. Upload a JSON file to get started.</p>
          </div>
        )}
      </div>

      {}
      <p className="text-xs text-muted-foreground">
        Upload a <code className="px-1 py-0.5 bg-muted rounded">.json</code> file describing a decision tree to add it to the list.
      </p>
    </div>
  );
}
