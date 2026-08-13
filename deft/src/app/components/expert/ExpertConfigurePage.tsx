






import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import ConfigureModelView from "../configure/ConfigureModelView";

export default function ExpertConfigurePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-8 py-16">

        {}
        <div className="mb-10">
          <button
            onClick={() => navigate('/expert')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to tree
          </button>
          <h1 className="text-4xl font-medium text-foreground mb-2">Configure Model</h1>
          <p className="text-sm text-muted-foreground">
            Configure the decision tree model. Your submitted advice is attached below and will be
            used when generating the tree.
          </p>
        </div>

        <ConfigureModelView generateLabel="Generate (expert)" />
      </div>
    </div>
  );
}
