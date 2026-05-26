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
import type { ModelFormState } from './actions';

interface Props {
  action: (state: ModelFormState, formData: FormData) => Promise<ModelFormState>;
  brands: ReadonlyArray<{ id: string; name: string }>;
  categories: readonly string[];
  initial?: Partial<{
    brandId: string;
    slug: string;
    name: string;
    category: string;
    disciplineTags: string[];
    description: string | null;
  }>;
  submitLabel: string;
}

export function ModelForm({ action, brands, categories, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ModelFormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="brandId" label="Brand" error={fe.brandId}>
        <Select name="brandId" defaultValue={initial?.brandId ?? brands[0]?.id}>
          <SelectTrigger id="brandId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="slug" label="Slug" error={fe.slug}>
        <Input id="slug" name="slug" defaultValue={initial?.slug ?? ''} required />
      </Field>
      <Field id="name" label="Name" error={fe.name}>
        <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
      </Field>
      <Field id="category" label="Category" error={fe.category}>
        <Select name="category" defaultValue={initial?.category ?? categories[0]}>
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        id="disciplineTags"
        label="Discipline tags (comma-separated)"
        error={fe.disciplineTags}
      >
        <Input
          id="disciplineTags"
          name="disciplineTags"
          defaultValue={initial?.disciplineTags?.join(', ') ?? ''}
          placeholder="endurance, all-road"
        />
      </Field>
      <Field id="description" label="Description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ''}
          rows={4}
        />
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
