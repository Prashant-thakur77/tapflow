import React from "react";
import { Zap, LayoutGrid, Users, Wallet, History, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { icon: Zap, label: "Tap", path: "/tap" },
    { icon: LayoutGrid, label: "Markets", path: "/markets" },
    { icon: Users, label: "Leaders", path: "/leaders" },
    { icon: Wallet, label: "Portfolio", path: "/portfolio" },
    { icon: History, label: "History", path: "/history" },
    { icon: ShieldCheck, label: "Proof", path: "/proof" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden xl:flex fixed left-0 top-0 h-screen flex-col z-50 transition-all duration-300 w-[220px] 2xl:w-64"
        style={{
          background: "rgba(22, 20, 42, 0.4)",
          backdropFilter: "blur(20px)",
          borderRight: "2px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Brand */}
        <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
          <Link to="/" className="flex items-center gap-3 px-5 py-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-lg"
              style={{ background: "linear-gradient(135deg, #0847F7 0%, #002280 100%)", boxShadow: "0 2px 8px rgba(8,71,247,0.3)" }}
            >
              ⚡
            </div>
            <div className="min-w-0">
              <p className="text-xl font-black italic tracking-tighter leading-tight">
                TapFlow<span className="text-[#0847F7]">.</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={idx}
                to={item.path}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-150 group text-sm font-medium",
                  isActive
                    ? "nav-active"
                    : "text-bn-text-dim hover:bg-white/[0.04] hover:text-bn-text",
                )}
                style={
                  isActive
                    ? {
                        background: "rgba(8, 71, 247, 0.08)",
                        color: "#0847F7",
                      }
                    : undefined
                }
              >
                <Icon
                  size={17}
                  style={{
                    color: isActive ? "#0847F7" : undefined,
                  }}
                  className={cn(
                    "transition-colors shrink-0",
                    !isActive && "text-[#d0d0d0] group-hover:text-[#ffffff]",
                  )}
                />
                <span>{item.label}</span>
                {isActive && (
                  <span
                    className="ml-auto w-0.5 h-4 rounded-full"
                    style={{ background: "#0847F7" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav
        className="xl:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
        style={{
          background: "rgba(22, 20, 42, 0.8)",
          backdropFilter: "blur(20px)",
          borderTop: "2px solid rgba(255, 255, 255, 0.05)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          height: "56px",
        }}
      >
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={idx}
              to={item.path}
              className="flex flex-col items-center gap-1 px-4 py-2 transition-all duration-150 min-w-[48px]"
              style={{ color: isActive ? "#0847F7" : "#a0a0a0" }}
            >
              <Icon
                size={20}
                style={{ color: isActive ? "#0847F7" : "#a0a0a0" }}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
