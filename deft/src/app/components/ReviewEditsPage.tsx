import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, X, FileText } from 'lucide-react';
import { useAdvice } from './AdviceContext';

export default function ReviewEditsPage({ returnPath = '/' }: { returnPath?: string }) {
  const navigate = useNavigate();
  const { adviceItems, removeAdvice, selectedAdviceIds, setSelectedAdviceIds, submitSelectedAdvice } = useAdvice();

  const toggleSelection = (id: string) => {
    if (selectedAdviceIds.includes(id)) {
      setSelectedAdviceIds(selectedAdviceIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedAdviceIds([...selectedAdviceIds, id]);
    }
  };

  const handleSubmit = () => {
    submitSelectedAdvice();
    navigate(returnPath);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-medium">Review Edits</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Select advice to submit
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={selectedAdviceIds.length === 0}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedAdviceIds.length > 0
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Submit Advice
            </button>
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {adviceItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No advice items yet. Use the AI bar to add advice.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adviceItems.map((item) => {
                const isSelected = selectedAdviceIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`relative border rounded-lg p-4 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-muted-foreground'
                    }`}
                  >
                    {}
                    <button
                      onClick={() => removeAdvice(item.id)}
                      className="absolute top-3 right-3 p-1 hover:bg-accent rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {}
                    <div className="flex gap-4 pr-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(item.id)}
                        className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <div className="flex-1 space-y-3">
                        {}
                        <p className="text-sm">{item.message}</p>

                        {}
                        {item.handoffSnippet && (
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Handoff for tree generation:</span>
                            <p className="text-xs font-mono whitespace-pre-wrap bg-muted border border-border rounded-md px-3 py-2 text-foreground">
                              {item.handoffSnippet}
                            </p>
                          </div>
                        )}

                        {}
                        {item.contextNodes.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs text-muted-foreground">Context:</span>
                            <div className="flex flex-wrap gap-2">
                              {item.contextNodes.map((node) => (
                                <div
                                  key={node.id}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-md"
                                >
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium truncate max-w-[200px]">
                                    {node.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {}
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
