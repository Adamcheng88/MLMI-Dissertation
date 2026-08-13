import { useParams, useNavigate } from 'react-router';
import { useUploadedTrees } from './UploadedTreesContext';
import TreeVisualization from './TreeVisualization';
import { ChevronLeft } from 'lucide-react';

export default function UploadedTreeVisualization() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTree } = useUploadedTrees();

  const uploadedTree = id ? getTree(id) : undefined;

  if (!uploadedTree) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Tree not found</p>
        <p className="text-sm text-muted-foreground">
          This tree may have been removed or the page was refreshed.
        </p>
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <TreeVisualization
      tree={uploadedTree.tree}
      title={uploadedTree.name}
      subtitle={uploadedTree.description}
      treeKey={`uploaded-${uploadedTree.id}`}
      backPath="/admin"
      reviewEditsPath="/admin/review-edits"
      comparePathBase="/admin/compare"
    />
  );
}
