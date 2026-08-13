import { BrowserRouter, Routes, Route } from 'react-router';
import PromptPage from './components/PromptPage';
import TreeVisualization from './components/TreeVisualization';
import UploadedTreeVisualization from './components/UploadedTreeVisualization';
import CompareTreesPage from './components/CompareTreesPage';
import ReviewEditsPage from './components/ReviewEditsPage';
import { AdviceProvider } from './components/AdviceContext';
import { UploadedTreesProvider } from './components/UploadedTreesContext';
import { ParticipantProvider } from './contexts/ParticipantContext';
import { AdminProvider } from './contexts/AdminContext';
import { ClassLabelsProvider } from './contexts/ClassLabelsContext';
import { polIIPausingTree, enhancedPausingTree } from './components/TreeData';

import ExpertTreePage from './components/expert/ExpertTreePage';
import ExpertConfigurePage from './components/expert/ExpertConfigurePage';

import LandingPage from './components/study/LandingPage';
import InstructionsPage from './components/study/InstructionsPage';
import InfoSheetPage from './components/study/InfoSheetPage';
import ConsentPage from './components/study/ConsentPage';
import DemographicsPage from './components/study/DemographicsPage';
import TutorialPage from './components/study/TutorialPage';
import TaskShell from './components/study/TaskShell';
import PostSurveyPage from './components/study/PostSurveyPage';
import FinishingPage from './components/study/FinishingPage';
import StudyStepGuard from './components/study/StudyStepGuard';

import AdminLogin from './components/admin/AdminLogin';
import AdminLayout from './components/admin/AdminLayout';
import ExperimentSettingsPage from './components/admin/ExperimentSettingsPage';
import AdminBaselinePreview from './components/baseline/AdminBaselinePreview';

export default function App() {
  return (
    <AdminProvider>
      <ParticipantProvider>
        <ClassLabelsProvider>
        <AdviceProvider>
          <UploadedTreesProvider>
            <BrowserRouter>
              <Routes>
                {}
                <Route path="/expert" element={<ExpertTreePage />} />
                <Route
                  path="/expert/review-edits"
                  element={<ReviewEditsPage returnPath="/expert/configure" />}
                />
                <Route path="/expert/configure" element={<ExpertConfigurePage />} />

                {}
                <Route path="/" element={<LandingPage />} />
                <Route
                  path="/instructions"
                  element={
                    <StudyStepGuard step="instructions">
                      <InstructionsPage />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/info-sheet"
                  element={
                    <StudyStepGuard step="info_sheet">
                      <InfoSheetPage />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/consent"
                  element={
                    <StudyStepGuard step="consent">
                      <ConsentPage />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/demographics"
                  element={
                    <StudyStepGuard step="demographics">
                      <DemographicsPage />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/tutorial"
                  element={
                    <StudyStepGuard step="tutorial">
                      <TutorialPage />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/task"
                  element={
                    <StudyStepGuard step="task">
                      <TaskShell />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/task/review-edits"
                  element={
                    <StudyStepGuard step="task">
                      <ReviewEditsPage returnPath="/task" />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/surveys"
                  element={
                    <StudyStepGuard step="surveys">
                      <PostSurveyPage />
                    </StudyStepGuard>
                  }
                />
                <Route
                  path="/complete"
                  element={
                    <StudyStepGuard step="complete">
                      <FinishingPage />
                    </StudyStepGuard>
                  }
                />

                {}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<PromptPage />} />
                  <Route
                    path="visualize/pol-ii"
                    element={
                      <TreeVisualization
                        tree={polIIPausingTree}
                        title="Pol II Pausing Tree"
                        subtitle="Basic decision tree for RNA polymerase II pausing prediction"
                        treeKey="pol-ii"
                        backPath="/admin"
                        reviewEditsPath="/admin/review-edits"
                        comparePathBase="/admin/compare"
                      />
                    }
                  />
                  <Route
                    path="visualize/enhanced"
                    element={
                      <TreeVisualization
                        tree={enhancedPausingTree}
                        title="Enhanced Pausing Tree"
                        subtitle="Extended tree with additional position and composition features"
                        treeKey="enhanced"
                        backPath="/admin"
                        reviewEditsPath="/admin/review-edits"
                        comparePathBase="/admin/compare"
                      />
                    }
                  />
                  <Route path="visualize/uploaded/:id" element={<UploadedTreeVisualization />} />
                  <Route path="visualize/baseline" element={<AdminBaselinePreview />} />
                  <Route path="compare/:treeKey" element={<CompareTreesPage />} />
                  <Route path="review-edits" element={<ReviewEditsPage returnPath="/admin" />} />
                  <Route path="settings" element={<ExperimentSettingsPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </UploadedTreesProvider>
        </AdviceProvider>
        </ClassLabelsProvider>
      </ParticipantProvider>
    </AdminProvider>
  );
}
