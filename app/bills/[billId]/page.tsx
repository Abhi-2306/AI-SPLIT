"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { BillStepper } from "@/presentation/components/bill/BillStepper";
import { ReceiptUploader } from "@/presentation/components/receipt/ReceiptUploader";
import { OcrResultPreview } from "@/presentation/components/receipt/OcrResultPreview";
import { ItemList } from "@/presentation/components/items/ItemList";
import { ItemForm } from "@/presentation/components/items/ItemForm";
import { ParticipantList } from "@/presentation/components/participants/ParticipantList";
import { TemplateModal } from "@/presentation/components/participants/TemplateModal";
import { AssignmentMatrix } from "@/presentation/components/assignment/AssignmentMatrix";
import { Button } from "@/presentation/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/presentation/components/ui/Card";
import {
  canProceedToParticipants,
  canProceedToAssign,
  canProceedToSummary,
} from "@/presentation/store/selectors/billSelectors";
import { ROUTES } from "@/lib/constants/routes";

type Params = { params: Promise<{ billId: string }> };

export default function BillPage({ params }: Params) {
  const { billId } = use(params);
  const router = useRouter();
  const { currentBill, loadBill, updateBillMeta, ocrResult, addParticipant } = useBillStore();
  const { addToast } = useUiStore();
  const [step, setStep] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const autoAddedRef = useRef(false);
  const [templateModal, setTemplateModal] = useState<"load" | "save" | null>(null);

  // Read ?step= from URL on mount (e.g. when navigating back from summary)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = parseInt(params.get("step") ?? "");
    if (s >= 1 && s <= 3) setStep(s);
  }, []);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    loadBill(billId).catch(() => setLoadError(true));
  }, [billId, loadBill]);

  // Auto-add current user as a participant when entering step 2 (once per bill load)
  useEffect(() => {
    if (step !== 2 || !currentBill || autoAddedRef.current) return;
    autoAddedRef.current = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return;
        const { id: userId, displayName } = json.data;
        const alreadyIn = currentBill.participants.some((p) => p.userId === userId);
        if (!alreadyIn) {
          addParticipant(billId, displayName, userId).catch(() => null);
        }
      })
      .catch(() => null);
  }, [step, currentBill, billId, addParticipant]);

  if (loadError) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">😕</p>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Bill not found</h2>
        <Button onClick={() => router.push(ROUTES.newBill)}>Create a new bill</Button>
      </div>
    );
  }

  if (!currentBill) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-500">Loading bill...</p>
      </div>
    );
  }

  const bill = currentBill;

  function canGoToStep(target: number): boolean {
    if (target === 1) return true;
    if (target === 2) return canProceedToParticipants(bill);
    if (target === 3) return canProceedToAssign(bill);
    if (target === 4) return canProceedToAssign(bill);
    return false;
  }

  async function handleTaxChange(value: number | null) {
    setSavingMeta(true);
    try {
      await updateBillMeta(bill.id, { tax: value });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleDiscountChange(value: number | null) {
    setSavingMeta(true);
    try {
      await updateBillMeta(bill.id, { discount: value });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleTipChange(value: number | null) {
    setSavingMeta(true);
    try {
      await updateBillMeta(bill.id, { tip: value });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handlePaidByChange(participantId: string | null) {
    setSavingMeta(true);
    try {
      await updateBillMeta(bill.id, { paidByParticipantId: participantId });
    } finally {
      setSavingMeta(false);
    }
  }

  function goToSummary() {
    router.push(ROUTES.billSummary(bill.id));
  }

  return (
    <div>
      {/* Bill title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{bill.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Currency: <strong>{bill.currency}</strong> · {bill.items.length} item(s) ·{" "}
          {bill.participants.length} participant(s)
        </p>
      </div>

      <BillStepper currentStep={step} canGoToStep={canGoToStep} onStepClick={setStep} />

      {/* Step 1: Items */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-700 dark:text-slate-300">
              Step 1 — Bill Items
            </h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <ReceiptUploader billId={bill.id} />
            {ocrResult && (
              <OcrResultPreview billId={bill.id} currency={bill.currency} onDone={() => {}} />
            )}
            <ItemList
              items={bill.items}
              billId={bill.id}
              currency={bill.currency}
              subtotal={bill.subtotal}
              tax={bill.tax}
              discount={bill.discount}
              tip={bill.tip}
              total={bill.total}
              onTaxChange={handleTaxChange}
              onDiscountChange={handleDiscountChange}
              onTipChange={handleTipChange}
            />
            <ItemForm billId={bill.id} />
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => router.back()}>
                ← Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToParticipants(bill)}
              >
                Next: Add People →
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 2: Participants */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-300">
                Step 2 — Add Participants
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setTemplateModal("load")}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  📋 Load Template
                </button>
                {bill.participants.length > 0 && (
                  <button
                    onClick={() => setTemplateModal("save")}
                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    💾 Save Template
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <ParticipantList participants={bill.participants} billId={bill.id} />
            {bill.participants.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-sm border-t border-slate-200 dark:border-slate-700 pt-3">
                <span className="text-slate-500 dark:text-slate-400">Paid by:</span>
                <select
                  value={bill.paidByParticipantId ?? ""}
                  onChange={(e) => handlePaidByChange(e.target.value || null)}
                  disabled={savingMeta}
                  className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not set</option>
                  {bill.participants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedToAssign(bill)}
              >
                Next: Assign Items →
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Template Modal */}
      {templateModal && (
        <TemplateModal
          mode={templateModal}
          currentParticipants={bill.participants.map((p) => ({ name: p.name, userId: p.userId }))}
          currentCurrency={bill.currency}
          onLoad={async (participants) => {
            const existing = new Set(bill.participants.map((p) => p.name.toLowerCase()));
            for (const p of participants) {
              if (!existing.has(p.name.toLowerCase())) {
                await addParticipant(bill.id, p.name, p.userId ?? null).catch(() => null);
              }
            }
          }}
          onClose={() => setTemplateModal(null)}
        />
      )}

      {/* Step 3: Assignments */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-700 dark:text-slate-300">
              Step 3 — Assign Items
            </h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <AssignmentMatrix bill={bill} />
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button onClick={goToSummary}>
                View Summary →
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
