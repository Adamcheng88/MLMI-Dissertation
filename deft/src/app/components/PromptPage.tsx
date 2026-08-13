import { useState } from "react";
import ExampleTreeViewer from "./ExampleTreeViewer";
import ConfigureModelView from "./configure/ConfigureModelView";

export default function PromptPage() {
  const [activeTab, setActiveTab] = useState<"configure" | "examples">("configure");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-8 py-16">

        {}
        <div className="mb-10">
          <h1 className="text-4xl font-medium text-foreground mb-6">DEFT Decision Tree Model</h1>
          <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
            {(["configure", "examples"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "configure" ? "Configure Model" : "Example Tree Viewer"}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "examples" ? <ExampleTreeViewer /> : <ConfigureModelView generateLabel="Generate" />}
      </div>
    </div>
  );
}
