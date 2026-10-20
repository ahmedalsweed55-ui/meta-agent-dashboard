import { Redirect, Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Toaster } from "@/components/ui/sonner";
import { Shell } from "@/components/shell";
import { ConnectorsPage } from "@/pages/connectors";
import { EvalPage } from "@/pages/eval";
import { KnowledgePage } from "@/pages/knowledge";
import { LogsPage } from "@/pages/logs";
import { SetupPage } from "@/pages/setup";
import { SkillsPage } from "@/pages/skills";
import { TestPage } from "@/pages/test";
import { UiSkillsPage } from "@/pages/ui-skills";
import { DashboardProvider } from "@/state/dashboard";

export default function App() {
  return (
    <DashboardProvider>
      <Router hook={useHashLocation}>
        <Shell>
          <Switch>
            <Route path="/">
              <SetupPage />
            </Route>
            <Route path="/knowledge">
              <KnowledgePage />
            </Route>
            <Route path="/skills">
              <SkillsPage />
            </Route>
            <Route path="/ui-skills">
              <UiSkillsPage />
            </Route>
            <Route path="/connectors">
              <ConnectorsPage />
            </Route>
            <Route path="/test">
              <TestPage />
            </Route>
            <Route path="/eval">
              <EvalPage />
            </Route>
            <Route path="/logs">
              <LogsPage />
            </Route>
            <Route>
              <Redirect to="/" />
            </Route>
          </Switch>
        </Shell>
      </Router>
      <Toaster theme="dark" dir="rtl" />
    </DashboardProvider>
  );
}
