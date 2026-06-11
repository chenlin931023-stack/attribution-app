"""GET /api/tasks/{id} & GET /api/results/{id} — 任务状态 & 归因结果"""
import os
import json
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["results"])

RESULTS_DIR = os.path.expanduser("~/AttributionApp/results")


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    task_path = os.path.join(RESULTS_DIR, f"{task_id}.task.json")
    if not os.path.exists(task_path):
        raise HTTPException(404, "任务不存在")

    with open(task_path, 'r', encoding='utf-8') as f:
        return json.load(f)


@router.get("/results/{task_id}")
def get_results(task_id: str):
    result_path = os.path.join(RESULTS_DIR, f"{task_id}.json")
    if not os.path.exists(result_path):
        raise HTTPException(404, "结果尚未生成或任务不存在")

    with open(result_path, 'r', encoding='utf-8') as f:
        return json.load(f)
