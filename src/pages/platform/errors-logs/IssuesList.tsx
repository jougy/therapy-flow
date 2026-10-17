import React from "react";
import {
  ChevronRight,
  Layers,
  Sparkles,
  Smartphone,
  Monitor,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GroupedIssue } from "./types";

interface IssuesListProps {
  issues: GroupedIssue[];
  onSelectIssue: (issue: GroupedIssue) => void;
}

export const IssuesList: React.FC<IssuesListProps> = ({
  issues,
  onSelectIssue,
}) => {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      {issues.map((issue) => (
        <Card
          key={issue.fingerprint}
          className="border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all cursor-pointer shadow-sm group"
          onClick={() => onSelectIssue(issue)}
        >
          <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive" className="font-mono text-[10px] uppercase px-1.5 py-0.2">
                  {issue.type}
                </Badge>
                <code className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {issue.scope}
                </code>
                <span className="text-xs text-muted-foreground font-mono">
                  {issue.lastTimeString}
                </span>
                <Badge variant="secondary" className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                  {issue.count} ocorrência{issue.count > 1 ? "s" : ""}
                </Badge>
              </div>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {issue.message}
              </h4>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{issue.affectedUsers.size} usuário(s) afetado(s)</span>
                <span>•</span>
                <span>{Array.from(issue.devices).join(", ")}</span>
                {issue.breadcrumbs.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {issue.breadcrumbs.length} breadcrumb(s) anexado(s)
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 group-hover:border-indigo-300 group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-950/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIssue(issue);
                }}
              >
                Investigar
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
