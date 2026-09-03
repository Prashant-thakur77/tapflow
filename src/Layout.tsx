import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export const Layout: React.FC = () => {
  const location = useLocation();
  const isIntro = location.pathname === "/";

  return (
    <div
      className="flex h-screen w-full text-white font-sans overflow-hidden relative"
      style={{ background: "#080A0C", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Universal Background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, #0847F7 0%, transparent 70%)",
        }}
      />

      {!isIntro && <Sidebar />}

      <main
        className={`flex-1 flex flex-col h-full relative z-10 transition-all duration-300 overflow-auto ${isIntro ? "" : "xl:pl-[220px] 2xl:pl-64 pb-[60px] xl:pb-0"}`}
      >
        {!isIntro && <Header />}
        <Outlet />
      </main>
    </div>
  );
};
