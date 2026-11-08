"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Crown,
  Zap,
  Building,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { SubscriptionPlan } from "@/types/api";

export default function UpgradeModal() {
  const { isUpgradeModalOpen, setIsUpgradeModalOpen } = useChat();
  const { user, refreshUser } = useAuth();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Sales modal state
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [salesForm, setSalesForm] = useState({
    name: "",
    email: "",
    company_name: "",
    team_size: "10-50",
    message: "",
  });
  const [isSalesSubmitting, setIsSalesSubmitting] = useState(false);

  useEffect(() => {
    if (!isUpgradeModalOpen) return;

    const fetchPlansData = async () => {
      setIsLoading(true);
      try {
        const plansData = await api.getSubscriptionPlans();
        setPlans(plansData.plans || []);
      } catch (err) {
        console.error("Failed to load subscription plans:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlansData();
  }, [isUpgradeModalOpen, user]);

  if (!isUpgradeModalOpen) return null;

  const handleCheckout = async (planId: string) => {
    setActionLoadingId(planId);
    setNotification(null);
    try {
      const res = await api.checkoutSubscription({
        plan_id: planId,
        billing_cycle: billingCycle,
      });

      setNotification({
        type: "success",
        message: res.message || `Subscribed to ${planId.toUpperCase()} plan successfully!`,
      });
      await refreshUser();
      setTimeout(() => {
        setIsUpgradeModalOpen(false);
      }, 1500);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Checkout failed.";
      setNotification({
        type: "error",
        message: errMessage,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleContactSales = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSalesSubmitting(true);
    setNotification(null);
    try {
      const res = await api.contactSales(salesForm);
      setNotification({
        type: "success",
        message: res.message || "Thank you! Our enterprise sales team will reach out shortly.",
      });
      setIsSalesModalOpen(false);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Submission failed.";
      setNotification({
        type: "error",
        message: errMessage,
      });
    } finally {
      setIsSalesSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl rounded-3xl bg-[#0B1026]/95 border border-white/10 shadow-2xl p-6 md:p-8 relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow accents */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setIsUpgradeModalOpen(false)}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Knowvia Enterprise Subscriptions</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Elevate Your Document Intelligence
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Choose the ideal capacity for your research workflows, teams, and knowledge repositories.
          </p>

          {/* Monthly / Yearly Billing Toggle */}
          <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/10 mt-3">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                billingCycle === "yearly"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-400/30">
                17% Off
              </span>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`p-3 rounded-xl border mb-4 flex items-center gap-2 text-xs backdrop-blur-xl ${
              notification.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/60 border-red-500/40 text-red-200"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span>Fetching server plans...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 pb-4">
              {plans.map((p) => {
                const isCurrent = user?.subscription_tier === p.id;
                const isRecommended = p.recommended;
                const price =
                  billingCycle === "yearly"
                    ? Math.round(p.yearly_price / 12)
                    : p.monthly_price;

                const isEnterpriseTier = p.id === "team" || p.id === "business";

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-4 flex flex-col justify-between transition-all backdrop-blur-xl relative ${
                      isRecommended
                        ? "bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border-2 border-indigo-500/50 shadow-xl shadow-indigo-950/50 ring-1 ring-indigo-400/30"
                        : "bg-white/[0.03] border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {isRecommended && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-md">
                        Popular
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">{p.name}</h3>
                        {isCurrent && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1 min-h-[30px] leading-tight">
                        {p.tagline}
                      </p>

                      <div className="mt-3 pb-3 border-b border-white/[0.08]">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-extrabold text-white">
                            {price === 0 ? "Free" : `₹${price.toLocaleString()}`}
                          </span>
                          {price > 0 && (
                            <span className="text-[10px] text-slate-400">/mo</span>
                          )}
                        </div>
                        {p.commitment_note && (
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {p.commitment_note}
                          </p>
                        )}
                      </div>

                      {/* Feature List */}
                      <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                        {p.features.slice(0, 4).map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-1.5 leading-snug">
                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/[0.06]">
                      {isEnterpriseTier ? (
                        <button
                          onClick={() => {
                            setSalesForm((prev) => ({
                              ...prev,
                              name: user?.name || "",
                              email: user?.email || "",
                            }));
                            setIsSalesModalOpen(true);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-indigo-300 hover:text-white font-semibold text-xs border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span>Contact Sales</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCheckout(p.id)}
                          disabled={isCurrent || actionLoadingId === p.id}
                          className={`w-full py-2 px-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                            isCurrent
                              ? "bg-white/[0.04] text-slate-500 cursor-default"
                              : isRecommended
                              ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30"
                              : "bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10"
                          }`}
                        >
                          {actionLoadingId === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          <span>{isCurrent ? "Current Plan" : "Upgrade"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contact Sales Sub-Modal */}
        {isSalesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-md rounded-2xl bg-[#0B1026] border border-white/10 p-6 shadow-2xl relative">
              <button
                onClick={() => setIsSalesModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-white mb-1">Contact Enterprise Sales</h3>
              <p className="text-xs text-slate-400 mb-4">
                Tailored vector capacity, dedicated SLA, and SSO provisioning.
              </p>

              <form onSubmit={handleContactSales} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={salesForm.name}
                    onChange={(e) => setSalesForm({ ...salesForm, name: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Business Email</label>
                  <input
                    type="email"
                    required
                    value={salesForm.email}
                    onChange={(e) => setSalesForm({ ...salesForm, email: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={salesForm.company_name}
                    onChange={(e) => setSalesForm({ ...salesForm, company_name: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSalesSubmitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-xs mt-2"
                >
                  {isSalesSubmitting ? "Submitting..." : "Send Enterprise Request"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
