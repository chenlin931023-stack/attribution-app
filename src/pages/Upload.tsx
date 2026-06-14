import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileSpreadsheet, Check, AlertCircle, Loader2, Calendar, ChevronDown, Play } from "lucide-react";
import { uploadFile, submitAnalysis, type FileInfo } from "@/lib/api";
import { FILE_TYPE_LABELS } from "@/lib/config";
import { useTauriDrop } from "@/hooks/useTauriDrop";

export default function Upload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allProducts = [...new Set(files.flatMap((f) => f.product_codes))].sort();

  const filteredProducts = allProducts.filter((code) =>
    code.toLowerCase().includes(productSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFiles = useCallback(
    async (fileList: File[] | FileList) => {
      setLoading(true);
      setError("");
      const newFiles: FileInfo[] = [];
      const arr = Array.from(fileList);
      for (const file of arr) {
        try {
          const info = await uploadFile(file);
          newFiles.push(info);
        } catch (e: any) {
          setError(`${file.name}: ${e.message}`);
        }
      }
      setFiles((prev) => [...prev, ...newFiles]);
      setLoading(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // Native OS drag-drop (Tauri desktop)
  useTauriDrop(handleFiles);

  const handleSubmit = async () => {
    if (!selectedProduct || !startDate || !endDate) {
      setError("请选择产品代码和分析日期范围");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const valFiles = files.filter((f) => f.file_type === "valuation");
      const cfFile = files.find((f) => f.file_type === "cashflow");
      if (valFiles.length < 2) throw new Error("需要至少两个估值表文件（期初+期末）");

      const { task_id } = await submitAnalysis({
        product_code: selectedProduct,
        start_date: startDate,
        end_date: endDate,
        valuation_begin_file_id: valFiles[0].file_id,
        valuation_end_file_id: valFiles[1].file_id,
        cashflow_file_id: cfFile?.file_id || "",
      });

      // Save task to localStorage for task history page
      const stored = localStorage.getItem("attribution_tasks");
      const taskList = stored ? JSON.parse(stored) : [];
      taskList.unshift({
        task_id,
        status: "done",
        product_codes: [selectedProduct],
        start_date: startDate,
        end_date: endDate,
        created_at: new Date().toISOString().slice(0, 10),
      });
      localStorage.setItem("attribution_tasks", JSON.stringify(taskList));

      navigate(`/dashboard/${task_id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">业绩归因分析</h1>
        <p className="text-sm text-slate-500 mt-1">上传估值表与现金流文件，选择产品和日期范围，一键生成归因报表</p>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer
                   hover:border-brand-400 hover:bg-brand-50/50 transition-all duration-200"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
            <span className="text-sm text-slate-500">正在解析文件...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
              <UploadCloud className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <span className="text-sm font-medium text-brand-600">点击或拖拽上传</span>
              <span className="text-sm text-slate-400"> — 支持 .xls / .xlsx</span>
            </div>
            <p className="text-xs text-slate-400">估值余额表、期间现金流明细</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">已上传文件</h3>
          {files.map((f) => (
            <div key={f.file_id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 card-shadow">
              <FileSpreadsheet className="w-5 h-5 text-brand-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{f.filename}</p>
                <p className="text-xs text-slate-400">
                  {f.file_type === "valuation" && f.snap_date && `${f.snap_date} 快照 · `}
                  {f.file_type === "cashflow" && f.cf_date_start && `${f.cf_date_start}~${f.cf_date_end} · `}
                  {f.row_count} 行
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  f.file_type === "valuation"
                    ? "bg-blue-50 text-blue-600"
                    : f.file_type === "cashflow"
                    ? "bg-green-50 text-green-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {FILE_TYPE_LABELS[f.file_type] || "未知"}
              </span>
              <Check className="w-4 h-4 text-green-500" />
            </div>
          ))}
        </div>
      )}

      {/* Analysis Config */}
      {files.length >= 2 && (
        <div className="mt-6 p-5 bg-white rounded-xl border border-slate-200 card-shadow space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">分析配置</h3>

          {/* Product Selector */}
          <div ref={dropdownRef} className="relative">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">产品代码</label>
            <div
              className="flex items-center gap-2 w-full pl-3 pr-3 py-2 rounded-lg border border-slate-200 text-sm
                         focus-within:ring-2 focus-within:ring-brand-200 focus-within:border-brand-400 cursor-text"
              onClick={() => setDropdownOpen(true)}
            >
              <input
                type="text"
                placeholder={selectedProduct || "输入或选择产品代码..."}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                className="flex-1 outline-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400"
              />
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
            {dropdownOpen && filteredProducts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-lg">
                {filteredProducts.map((code) => (
                  <div
                    key={code}
                    onClick={() => {
                      setSelectedProduct(code);
                      setProductSearch("");
                      setDropdownOpen(false);
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-brand-50 transition-colors ${
                      selectedProduct === code
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    {code}
                  </div>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
                  {selectedProduct}
                </span>
                <button
                  onClick={() => setSelectedProduct("")}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">开始日期</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
                             focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">结束日期</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
                             focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedProduct || !startDate || !endDate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold
                       bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-300 disabled:text-slate-500
                       transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 正在提交分析...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> 开始分析
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
