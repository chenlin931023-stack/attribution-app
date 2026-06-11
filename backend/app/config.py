# 业绩归因分析 — 后端配置
api:
  host: "0.0.0.0"
  port: 8710

# 数据目录
data:
  uploads_dir: "~/AttributionApp/uploads"
  results_dir: "~/AttributionApp/results"

# 归因引擎配置
attribution:
  fee_categories:
    - 托管费
    - 销售手续费
    - 固定管理费
    - 费用预提待付

  invest_categories:
    - 债券类资产管理计划
    - 债券类公募基金
    - 股票类公募基金
    - 混合类公募基金
    - 混合类资产管理计划
    - 公司债券
    - 托管账户

  product_category: "净值型理财产品"

  cashflow_types:
    subscribe: "净值型产品申购"
    redeem: "净值型产品赎回"
    asset_buy: "净值型项目申购"
    asset_sell: "净值型项目赎回确认金额"

  # 资产大类→颜色映射（传给前端）
  category_colors:
    债券类资产管理计划: "#4472C4"
    债券类公募基金: "#4472C4"
    公司债券: "#4472C4"
    托管账户: "#70AD47"
    股票类公募基金: "#C00000"
    混合类公募基金: "#ED7D31"
    混合类资产管理计划: "#ED7D31"

# Celery
celery:
  broker_url: "redis://localhost:6379/0"
  result_backend: "redis://localhost:6379/1"
