import { createResellerAction } from '../actions';
import { resellerStatuses } from '../enums';
import { ResellerForm } from '../reseller-form';

export default function NewResellerPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New reseller</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Locations (physical stores + online storefronts) are added after the reseller is created.
      </p>
      <div className="mt-6">
        <ResellerForm
          action={createResellerAction}
          statuses={resellerStatuses}
          submitLabel="Create"
        />
      </div>
    </div>
  );
}
