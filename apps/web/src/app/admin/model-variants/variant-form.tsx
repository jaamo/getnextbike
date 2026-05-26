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
import type { VariantFormState } from './actions';
import { NONE_REGION_VALUE } from './constants';

interface Props {
  action: (s: VariantFormState, fd: FormData) => Promise<VariantFormState>;
  modelYears: ReadonlyArray<{ id: string; label: string }>;
  regions: ReadonlyArray<{ id: string; label: string }>;
  initial?: Partial<{
    modelYearId: string;
    regionId: string | null;
    sku: string | null;
    buildName: string | null;
    frameSize: string | null;
    color: string | null;
    weightGrams: number | null;
    notes: string | null;
  }>;
  submitLabel: string;
}

export function VariantForm({ action, modelYears, regions, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<VariantFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="modelYearId" label="Model year" error={fe.modelYearId}>
        <Select name="modelYearId" defaultValue={initial?.modelYearId ?? modelYears[0]?.id}>
          <SelectTrigger id="modelYearId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modelYears.map((my) => (
              <SelectItem key={my.id} value={my.id}>
                {my.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        id="regionId"
        label="Region (leave as Global for region-agnostic builds)"
        error={fe.regionId}
      >
        <Select name="regionId" defaultValue={initial?.regionId ?? NONE_REGION_VALUE}>
          <SelectTrigger id="regionId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_REGION_VALUE}>Global (no region)</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="buildName" label="Build name" error={fe.buildName}>
          <Input
            id="buildName"
            name="buildName"
            defaultValue={initial?.buildName ?? ''}
            placeholder="SLR 7 AXS"
          />
        </Field>
        <Field id="sku" label="SKU" error={fe.sku}>
          <Input id="sku" name="sku" defaultValue={initial?.sku ?? ''} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field id="frameSize" label="Frame size" error={fe.frameSize}>
          <Input
            id="frameSize"
            name="frameSize"
            defaultValue={initial?.frameSize ?? ''}
            placeholder="54cm"
          />
        </Field>
        <Field id="color" label="Color" error={fe.color}>
          <Input id="color" name="color" defaultValue={initial?.color ?? ''} />
        </Field>
        <Field id="weightGrams" label="Weight (g)" error={fe.weightGrams}>
          <Input
            id="weightGrams"
            name="weightGrams"
            type="number"
            defaultValue={initial?.weightGrams ?? ''}
          />
        </Field>
      </div>
      <Field id="notes" label="Notes" error={fe.notes}>
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ''} rows={3} />
      </Field>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
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
