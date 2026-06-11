import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { getTaskStatus, type TaskStatus } from "@/lib/api";

const RESULTS_DIR = "~/AttributionApp/results";

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskStatus[]>([]);

  // In production, this would fetch from a task index API
  // For now, we show a placeholder
  useEffect(() => {
    // Attempt to discover recent tasks from localStorage
    const stored = localStorage.getItem("attribution_tasks");
    if (stored) {
      try {
        setTasks(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
      case "running": return <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "done": return "已完成";
      case "failed": return "失败";
      case "running": return "分析中";
      case "pending": return "等待中";
      default: return status;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">任务历史</h1>
        <p className="text-sm text-slate-500 mt-1">查看历史分析任务和结果</p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">暂无分析任务</p>
          <button
            onClick={() => navigate("/")}
            className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            去上传文件 →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.task_id}
              onClick={() => task.status === "done" && navigate(`/dashboard/${task.task_id}`)}
              className={`flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200 card-shadow
                          ${task.status === "done" ? "cursor-pointer hover:border-brand-300 hover:card-shadow-hover" : ""}
                          transition-all`}
            >
              {statusIcon(task.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">
                  {task.product_codes?.join(", ") || "—"}
                </p>
                <p className="text-xs text-slate-400">
                  {task.start_date} ~ {task.end_date}
                  {task.created_at && ` · ${task.created_at}`}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  task.status === "done"
                    ? "bg-green-50 text-green-600"
                    : task.status === "failed"
                    ? "bg-red-50 text-red-600"
                    : task.status === "running"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {statusLabel(task.status)}
              </span>
              {task.status === "done" && <ArrowRight className="w-4 h-4 text-slate-400" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
