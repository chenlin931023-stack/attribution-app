"""POST /api/upload — 上传Excel，自动识别类型，注册文件"""
import os
import uuid
import json
from datetime import date
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd

router = APIRouter(prefix="/api", tags=["upload"])

UPLOADS_DIR = os.path.expanduser("~/AttributionApp/uploads")
REGISTRY_PATH = os.path.join(os.path.expanduser("~/AttributionApp"), "file_registry.json")

os.makedirs(UPLOADS_DIR, exist_ok=True)


def _load_registry():
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"valuation": [], "cashflow": []}


def _save_registry(reg):
    os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
    with open(REGISTRY_PATH, 'w', encoding='utf-8') as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(400, "仅支持 .xls / .xlsx 文件")

    file_id = uuid.uuid4().hex[:12]
    save_name = f"{file_id}_{file.filename}"
    save_path = os.path.join(UPLOADS_DIR, save_name)
    content = await file.read()
    with open(save_path, 'wb') as f:
        f.write(content)

    try:
        df = pd.read_excel(save_path, sheet_name='Fst', nrows=3)
        cols = list(df.columns)
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(400, f"无法读取 Excel: {str(e)}")

    # 判断类型
    if '摊余成本(元)' in cols or '市值(元)' in cols:
        file_type = "valuation"
        df_all = pd.read_excel(save_path, sheet_name='Fst')
        if '业务日期' in df_all.columns:
            dates = pd.to_datetime(df_all['业务日期'], errors='coerce').dropna()
            snap_date = dates.max().date().isoformat() if len(dates) > 0 else None
            date_min = dates.min().date().isoformat() if len(dates) > 0 else None
            date_max = dates.max().date().isoformat() if len(dates) > 0 else None
        else:
            snap_date = date_min = date_max = None

        prod_codes = []
        if '投组单元编号' in df_all.columns:
            prod_codes = sorted(df_all['投组单元编号'].dropna().unique().tolist())

        entry = {"source_file": save_name, "file_type": "valuation",
                 "snap_date": snap_date, "date_min": date_min, "date_max": date_max,
                 "product_codes": prod_codes, "row_count": len(df_all)}
        reg = _load_registry()
        reg['valuation'].append(entry)
        _save_registry(reg)

        return {
            "file_id": file_id, "filename": file.filename,
            "file_type": "valuation", "snap_date": snap_date,
            "date_min": date_min, "date_max": date_max,
            "product_codes": prod_codes, "row_count": len(df_all),
        }

    elif '现金流(元)' in cols:
        file_type = "cashflow"
        df_all = pd.read_excel(save_path, sheet_name='Fst')
        if '日期' in df_all.columns:
            dates = pd.to_datetime(df_all['日期'], errors='coerce').dropna()
            cf_start = dates.min().date().isoformat() if len(dates) > 0 else None
            cf_end   = dates.max().date().isoformat() if len(dates) > 0 else None
        else:
            cf_start = cf_end = None

        prod_codes = []
        if '投组单元编号' in df_all.columns:
            prod_codes = sorted(df_all['投组单元编号'].dropna().unique().tolist())

        entry = {"source_file": save_name, "file_type": "cashflow",
                 "cf_date_start": cf_start, "cf_date_end": cf_end,
                 "product_codes": prod_codes, "row_count": len(df_all)}
        reg = _load_registry()
        reg['cashflow'].append(entry)
        _save_registry(reg)

        return {
            "file_id": file_id, "filename": file.filename,
            "file_type": "cashflow", "cf_date_start": cf_start,
            "cf_date_end": cf_end, "product_codes": prod_codes,
            "row_count": len(df_all),
        }

    else:
        os.remove(save_path)
        raise HTTPException(400, "无法识别文件类型（缺少摊余成本/市值/现金流列）")
