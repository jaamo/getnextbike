'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { SelectorFormState } from '../../actions';

interface Props {
  action: (s: SelectorFormState, fd: FormData) => Promise<SelectorFormState>;
  types: readonly string[];
  initial?: {
    selectorType: string;
    expression: string;
    postProcessJson: Record<string, unknown> | null;
  };
}

export function SelectorForm({ action, types, initial }: Props) {
  const [state, formAction, pending] = useActionState<SelectorFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const post = initial?.postProcessJson ? JSON.stringify(initial.postProcessJson, null, 2) : '';
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="selectorType" label="Selector type" error={fe.selectorType}>
        <Select name="selectorType" defaultValue={initial?.selectorType ?? 'css'}>
          <SelectTrigger id="selectorType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="expression" label="Expression" error={fe.expression}>
        <Input
          id="expression"
          name="expression"
          defaultValue={initial?.expression ?? ''}
          required
          className="font-mono text-xs"
          placeholder='meta[itemprop="price"]::attr(content)'
        />
      </Field>
      <Field id="postProcessJson" label="Post-process JSON (optional)" error={fe.postProcessJson}>
        <Textarea
          id="postProcessJson"
          name="postProcessJson"
          defaultValue={post}
          rows={5}
          className="font-mono text-xs"
          placeholder='{"strip": "€", "decimal": ",", "type": "number"}'
        />
      </Field>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save as new version'}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
