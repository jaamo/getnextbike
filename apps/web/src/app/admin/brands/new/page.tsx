import { createBrandAction } from '../actions';
import { BrandForm } from '../brand-form';

export default function NewBrandPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New brand</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add a brand to the catalog.</p>
      <div className="mt-6">
        <BrandForm action={createBrandAction} submitLabel="Create" />
      </div>
    </div>
  );
}
