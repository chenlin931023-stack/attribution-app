"""POST /api/analyze — 提交归因分析任务，返回 task_id"""
import os
import uuid
import json
from datetime import date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["analyze"])

UPLOADS_DIR = os.path.expanduser("~/AttributionApp/uploads")
RESULTS_DIR = os.path.expanduser("~/AttributionApp/results")
os.makedirs(RESULTS_DIR, exist_ok=True)

REGISTRY_PATH = os.path.join(os.path.expanduser("~/AttributionApp"), "file_registry.json")


class AnalyzeRequest(BaseModel):
    product_code: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    valuation_begin_file_id: str = ""
    valuation_end_file_id: str = ""
    cashflow_file_id: str = ""


def _load_registry():
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"valuation": [], "cashflow": []}


def _find_file(registry_list, file_id):
    for e in registry_list:
        if e.get('source_file', '').startswith(file_id):
            return e
    return None


@router.post("/analyze")
def submit_analysis(req: AnalyzeRequest):
    date_start = date.fromisoformat(req.start_date)
    date_end   = date.fromisoformat(req.end_date)

    if date_end <= date_start:
        raise HTTPException(400, "结束日期必须晚于开始日期")

    reg = _load_registry()

    # 找估值表
    start_str = req.start_date
    end_str   = req.end_date

    candidates_start = [e for e in reg['valuation'] if e.get('snap_date') and e['snap_date'] <= start_str]
    candidates_end   = [e for e in reg['valuation'] if e.get('snap_date') and e['snap_date'] <= end_str]

    if not candidates_start:
        raise HTTPException(400, f"找不到 snap_date <= {start_str} 的期初估值表，请先上传")
    if not candidates_end:
        raise HTTPException(400, f"找不到 snap_date <= {end_str} 的期末估值表，请先上传")

    best_start = max(candidates_start, key=lambda e: e['snap_date'])
    best_end   = max(candidates_end, key=lambda e: e['snap_date'])

    # 找现金流
    candidates_cf = [e for e in reg['cashflow']
                     if e.get('cf_date_start') and e.get('cf_date_end')
                     and e['cf_date_start'] <= end_str and e['cf_date_end'] >= start_str]
    best_cf = max(candidates_cf, key=lambda e: (e['cf_date_end'], e['cf_date_start'])) if candidates_cf else None

    task_id = uuid.uuid4().hex[:12]

    task_data = {
        "task_id": task_id,
        "status": "pending",
        "product_code": req.product_code,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "valuation_start": best_start['source_file'],
        "valuation_end": best_end['source_file'],
        "cashflow": best_cf['source_file'] if best_cf else None,
        "created_at": date.today().isoformat(),
    }

    task_path = os.path.join(RESULTS_DIR, f"{task_id}.task.json")
    with open(task_path, 'w', encoding='utf-8') as f:
        json.dump(task_data, f, ensure_ascii=False, indent=2)

    # 同步执行归因计算
    task_data["status"] = "running"
    with open(task_path, 'w', encoding='utf-8') as f:
        json.dump(task_data, f, ensure_ascii=False, indent=2)

    try:
        import pandas as pd
        from ..services.attribution_engine import run_attribution

        df1 = pd.read_excel(os.path.join(UPLOADS_DIR, best_start['source_file']),
                            sheet_name='Fst', engine='openpyxl')
        df2 = pd.read_excel(os.path.join(UPLOADS_DIR, best_end['source_file']),
                            sheet_name='Fst', engine='openpyxl')
        df3 = None
        if best_cf:
            df3 = pd.read_excel(os.path.join(UPLOADS_DIR, best_cf['source_file']),
                                sheet_name='Fst', engine='openpyxl')

        result = run_attribution(df1, df2, df3, req.product_code, date_start, date_end)

        result_path = os.path.join(RESULTS_DIR, f"{task_id}.json")
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        task_data["status"] = "done"
        with open(task_path, 'w', encoding='utf-8') as f:
            json.dump(task_data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        task_data["status"] = "failed"
        task_data["error"] = str(e)
        with open(task_path, 'w', encoding='utf-8') as f:
            json.dump(task_data, f, ensure_ascii=False, indent=2)
        raise HTTPException(500, f"归因计算失败: {str(e)}")

    return {"task_id": task_id}
