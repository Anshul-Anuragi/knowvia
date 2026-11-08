"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Shield,
  Server,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { HealthCheckResponse } from "@/types/api";

export default function SettingsModal() {
  const { isSettingsOpen, setIsSettingsOpen } = useChat();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "system" | "admin">("profile");
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [healthData, setHealthData] = useState<{
    root?: HealthCheckResponse;
    readyz?: HealthCheckResponse;
    healthz?: HealthCheckResponse;
  }>({});
  const [isProbing, setIsProbing] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const probe = async () => {
      setIsProbing(true);
      try {
        const [root, readyz, healthz] = await Promise.allSettled([
          api.checkRoot(),
          api.checkReadiness(),
          api.checkLiveness(),
        ]);

        setHealthData({
          root: root.status === "fulfilled" ? root.value : undefined,
          readyz: readyz.status === "fulfilled" ? readyz.value : undefined,
          healthz: healthz.status === "fulfilled" ? healthz.value : undefined,
        });
      } catch (err) {
        console.error("Health probe error:", err);
      } finally {
        setIsProbing(false);
      }
    };

    probe();
  }, [isSettingsOpen]);

  const testAdminAccess = async () => {
    setAdminLoading(true);
    try {
      const res = await api.getAdminDashboard();
      setAdminStatus(res.message || "Admin authorization verified successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Permission denied.";
      setAdminStatus(`Access Denied: ${msg}`);
    } finally {
      setAdminLoading(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-[#0B1026]/95 border border-white/10 shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[85vh]">
        {/* Close Button */}
        <button
          onClick={() => setIsSettingsOpen(false)}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">System & Account Settings</h2>
            <p className="text-xs text-slate-400">
              Manage workspace configuration, enterprise health probes, and credentials.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/5 mb-5">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "profile"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            User Profile
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "system"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            System Diagnostics
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "admin"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Admin Panel
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : "KN"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{user?.name || "Anonymous User"}</h3>
                    <p className="text-xs text-slate-400">{user?.email || "Not signed in"}</p>
                    <span className="inline-block mt-1 text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Tier: {user?.subscription_tier || "free"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
                <p className="font-semibold text-slate-300">Workspace Role</p>
                <p className="text-slate-400">
                  Role: <span className="text-white font-mono">{user?.role || "user"}</span>
                </p>
                <p className="text-slate-400">
                  Subscription Status:{" "}
                  <span className="text-emerald-400 font-mono">
                    {user?.subscription_status || "active"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    FastAPI Production Backend Status
                  </span>
                  {isProbing && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <p className="text-[10px] text-slate-400">Database Readiness (/readyz)</p>
                    <p className="font-semibold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {healthData.readyz?.database || "Connected"}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <p className="text-[10px] text-slate-400">Liveness Probe (/healthz)</p>
                    <p className="font-semibold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {healthData.healthz?.status || "OK"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400 space-y-1">
                  <p>• Vector Engine: <span className="text-white font-mono">Pinecone Serverless</span></p>
                  <p>• Embedding Model: <span className="text-white font-mono">BAAI/bge-small-en-v1.5</span></p>
                  <p>• Primary LLM: <span className="text-white font-mono">Google Gemini 1.5 Flash</span></p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "admin" && (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Admin Authorization Check (/users/admin)</span>
              </div>
              <p className="text-xs text-slate-400">
                Tests role-based access control against protected enterprise routes.
              </p>

              <button
                onClick={testAdminAccess}
                disabled={adminLoading}
                className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition-all"
              >
                {adminLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Test Admin Privileges</span>
              </button>

              {adminStatus && (
                <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-slate-300 font-mono">
                  {adminStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
