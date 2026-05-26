import { createComponentAction } from '../actions';
import { ComponentForm } from '../component-form';
import { componentTypes } from '../enums';

export default function NewComponentPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New component</h1>
      <div className="mt-6">
        <ComponentForm action={createComponentAction} types={componentTypes} submitLabel="Create" />
      </div>
    </div>
  );
}
