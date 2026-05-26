import { createRegionAction } from '../actions';
import { RegionForm } from '../region-form';

export default function NewRegionPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New region</h1>
      <div className="mt-6">
        <RegionForm action={createRegionAction} submitLabel="Create" />
      </div>
    </div>
  );
}
