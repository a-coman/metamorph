'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Loader2, FileCode2, Edit3, Lock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => <Skeleton className="h-[820px] w-full rounded-xl" />,
});

interface PlaybookEditorProps {
  mrVersionId: string;
  initialContent: string;
  status: string;
}

export function PlaybookEditor({
  mrVersionId,
  initialContent,
  status,
}: PlaybookEditorProps) {
  const router = useRouter();
  const editable = status === 'draft_pending_hitl';
  const [content, setContent] = useState(initialContent);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await api.approveMrVersion(mrVersionId, { playbookContent: content });
      toast.success('Playbook approved — ready to execute');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setApproving(false);
    }
  }, [mrVersionId, content, router]);

  const handleReject = useCallback(async () => {
    setRejecting(true);
    try {
      await api.rejectMrVersion(mrVersionId);
      toast.warning('MR rejected');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setRejecting(false);
    }
  }, [mrVersionId, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <FileCode2 className="size-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Test Playbook
              </span>
              {editable ? (
                <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <Edit3 className="size-2.5" />
                  Editable
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Lock className="size-2.5" />
                  Read-only
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {editable ? 'Review and edit the generated test steps' : 'Approved playbook for execution'}
            </p>
          </div>
        </div>

        {editable && (
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline-destructive"
                  size="sm"
                  disabled={rejecting || approving}
                  className="gap-2"
                >
                  {rejecting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this exploration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the exploration as failed. A new exploration cycle will be
                    needed to generate a revised metamorphic relation.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReject}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={approving || rejecting || content.trim().length === 0}
                  className="gap-2"
                >
                  {approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve this playbook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your edits will be saved and the metamorphic relation will be approved
                    for test execution.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApprove}>
                    Approve & Save
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {editable && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Review the AI-generated playbook below. You can edit steps before approving, or reject to regenerate.
          </p>
        </div>
      )}

      <ScrollArea className="h-[820px] rounded-xl border border-border shadow-sm">
        <CodeMirrorEditor
          value={content}
          onChange={setContent}
          editable={editable}
        />
      </ScrollArea>
    </div>
  );
}

function CodeMirrorEditor({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
}) {
  const extensions = useMemo(() => [javascript({ typescript: true })], []);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      editable={editable}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: editable,
        autocompletion: false,
      }}
      theme={oneDark}
      style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
      minHeight="880px"
    />
  );
}

export function PlaybookSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <Skeleton className="h-[820px] w-full rounded-lg" />
    </div>
  );
}
