import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Upload,
  ListTodo,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { path: "/", label: "上传分析", icon: Upload },
  { path: "/tasks", label: "任务历史", icon: ListTodo },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 z-10">
        <Link to="/" className="flex items-center gap-2 mr-8">
          <div className="w-7 h-7 rounded-md bg-brand-700 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-slate-800 tracking-tight">
            业绩归因分析
          </span>
        </Link>

        {!isDashboard && (
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {isDashboard && (
          <nav className="flex items-center gap-1 text-xs text-slate-400">
            <Link to="/" className="hover:text-slate-600 transition-colors">
              上传分析
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/tasks" className="hover:text-slate-600 transition-colors">
              任务历史
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600 font-medium">归因结果</span>
          </nav>
        )}

        <div className="ml-auto text-xs text-slate-400">v1.0</div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
