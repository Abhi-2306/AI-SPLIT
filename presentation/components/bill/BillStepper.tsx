"use client";

type Step = {
  id: number;
  label: string;
  description: string;
};

const STEPS: Step[] = [
  { id: 1, label: "Items", description: "Add bill items" },
  { id: 2, label: "People", description: "Add participants" },
  { id: 3, label: "Assign", description: "Split each item" },
  { id: 4, label: "Summary", description: "View results" },
];

type BillStepperProps = {
  currentStep: number;
  canGoToStep: (step: number) => boolean;
  onStepClick: (step: number) => void;
};

export function BillStepper({ currentStep, canGoToStep, onStepClick }: BillStepperProps) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const isClickable = canGoToStep(step.id) || step.id <= currentStep;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1 flex-1 group ${isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-slate-200 text-slate-500 group-hover:bg-slate-300"
                }`}
              >
                {isCompleted ? "✓" : step.id}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 transition-colors ${
                  currentStep > step.id ? "bg-green-400" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
