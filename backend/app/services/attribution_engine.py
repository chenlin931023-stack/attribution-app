"""
业绩归因计算引擎
纯 Python 模块，无框架依赖。可直接导入调用或通过 FastAPI 包装。
复现现有 compute_multi.py 的完整逻辑。
"""
import pandas as pd
import numpy as np
import json
from datetime import date, timedelta
from collections import defaultdict
from typing import Optional
import warnings
warnings.filterwarnings('ignore')

# ═══════════════════════════════════════════════════════════
# 常量
# ═══════════════════════════════════════════════════════════
FEE_CATS = ['托管费', '销售手续费', '固定管理费', '费用预提待付']
PROD_CAT = '净值型理财产品'
INVEST_CATS = [
    '债券类资产管理计划', '债券类公募基金', '股票类公募基金',
    '混合类公募基金', '混合类资产管理计划', '公司债券', '托管账户',
]

# ═══════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════
def sf(v):
    try:
        f = float(np.real(v)) if isinstance(v, complex) else float(v)
        return 0.0 if (np.isnan(f) or np.isinf(f)) else f
    except:
        return 0.0

def annualize(r, days):
    base = 1.0 + r
    if base <= 0 or base > 1e12:
        return None
    try:
        return float(base ** (365.0 / max(days, 1)) - 1.0)
    except (OverflowError, ValueError):
        return None

def fmt_pct(v, digits=4):
    if v is None: return None
    return round(float(v) * 100, digits)

# ═══════════════════════════════════════════════════════════
# 核心归因引擎
# ═══════════════════════════════════════════════════════════
def run_attribution(
    df1_all: pd.DataFrame,  # 期初估值表 Fst sheet
    df2_all: pd.DataFrame,  # 期末估值表 Fst sheet
    df3_all: Optional[pd.DataFrame],  # 现金流 Fst sheet
    product_code: str,
    date_start: date,
    date_end: date,
) -> dict:
    """对单个产品执行完整归因计算，返回归因结果 dict"""
    DAYS = (date_end - date_start).days
    if DAYS <= 0:
        raise ValueError(f"分析天数必须 > 0，当前: {DAYS}")

    p1 = df1_all[df1_all['投组单元编号'] == product_code].copy()
    p2 = df2_all[df2_all['投组单元编号'] == product_code].copy()
    p3 = df3_all[df3_all['投组单元编号'] == product_code].copy() if df3_all is not None else pd.DataFrame()

    if len(p1) == 0 and len(p2) == 0:
        raise ValueError(f"产品 {product_code} 在两端估值表中均无数据")

    # 产品全名
    prod_name = ''
    for df_src in [p2, p1]:
        rows = df_src[df_src['产品分类'] == PROD_CAT]
        if len(rows) > 0:
            prod_name = str(rows.iloc[0]['名称'])
            break
    if not prod_name:
        prod_name = product_code

    # ── 1. NAV 计算 ──
    def calc_nav(pf):
        assets = pf[~pf['产品分类'].isin(FEE_CATS + [PROD_CAT])]
        asset_total = 0.0
        for _, r in assets.iterrows():
            cat = str(r['产品分类'])
            if cat == '证券清算款':
                asset_total += sf(r['市值(元)'])
            else:
                asset_total += sf(r['摊余成本(元)']) + sf(r['公允价值变动损益/未实现利润(元)']) + sf(r['利息收入/已实现损益(元)'])
        fee_liab = sum(sf(r['利息收入/已实现损益(元)']) for _, r in pf[pf['产品分类'].isin(FEE_CATS)].iterrows())
        return asset_total + fee_liab

    nav_init = calc_nav(p1)
    nav_end  = calc_nav(p2)

    if len(p3) > 0:
        p3['_日期_d'] = pd.to_datetime(p3['日期']).dt.date
        p3_period = p3[(p3['_日期_d'] >= date_start) & (p3['_日期_d'] <= date_end)]
        sub = sum(sf(v) for v in p3_period[p3_period['类型'] == '净值型产品申购']['现金流(元)'])
        red = sum(sf(v) for v in p3_period[p3_period['类型'] == '净值型产品赎回']['现金流(元)'])
    else:
        sub = red = 0.0

    net_sub = sub - red
    total_return_abs = nav_end - nav_init - net_sub
    ret_abs = total_return_abs / nav_init if nav_init else 0.0
    ret_ann = annualize(ret_abs, DAYS)

    product_nav = {
        'nav_init': float(nav_init), 'nav_end': float(nav_end),
        'net_sub': float(net_sub), 'sub': float(sub), 'red': float(red),
        'total_return': float(total_return_abs),
        'ret_abs': float(ret_abs), 'ret_ann': ret_ann, 'days': int(DAYS),
    }

    # ── 2. 资产快照 ──
    def build_snap(pf):
        sub = pf[pf['产品分类'].isin(INVEST_CATS)]
        rows = []
        for _, r in sub.iterrows():
            cat = str(r['产品分类'])
            if cat == '公司债券':
                mkt_val = sf(r['市值(元)'])
            else:
                mkt_val = sf(r['摊余成本(元)']) + sf(r['公允价值变动损益/未实现利润(元)'])
            rows.append({
                'name': str(r['名称']),
                'cat':  cat,
                'fv':   sf(r['公允价值变动损益/未实现利润(元)']),
                'gl':   sf(r['买卖损益/实收资本(元)']),
                'int':  sf(r['利息收入/已实现损益(元)']),
                'mkt':  mkt_val,
            })
        return pd.DataFrame(rows) if rows else pd.DataFrame(columns=['name','cat','fv','gl','int','mkt'])

    snap1 = build_snap(p1)
    snap2 = build_snap(p2)

    # ── 2b. 证券清算款处理 ──
    clearing_map = {}
    clearing_rows_p2 = p2[p2['产品分类'] == '证券清算款']
    for _, cr in clearing_rows_p2.iterrows():
        full_name = str(cr['名称'])
        if full_name.startswith('证券清算款-'):
            asset_name = full_name[len('证券清算款-'):]
            clearing_mkt = sf(cr['市值(元)'])
            clearing_map[asset_name] = clearing_map.get(asset_name, 0.0) + clearing_mkt
    if clearing_map:
        for asset_name, clearing_mkt in clearing_map.items():
            existing = snap2[snap2['name'] == asset_name]
            if len(existing) > 0:
                idx = existing.index[0]
                snap2.at[idx, 'mkt'] = snap2.at[idx, 'mkt'] + clearing_mkt
            else:
                new_row = pd.DataFrame([{'name': asset_name, 'cat': '证券清算款', 'fv': 0.0, 'gl': 0.0, 'int': 0.0, 'mkt': clearing_mkt}])
                snap2 = pd.concat([snap2, new_row], ignore_index=True)

    names_snap = set(snap1['name'].tolist()) | set(snap2['name'].tolist())

    # ── 3. 现金流整理 ──
    BOND_CF_TYPES = ['债券到期', '债券收息/还本', '债券回售(销账)', '现券买入', '现券卖出']
    cf_by_name = {}
    if len(p3) > 0:
        cf_detail = p3_period[p3_period['类型'].isin(['净值型项目申购','净值型项目赎回确认金额'] + BOND_CF_TYPES)].copy()
        cf_detail['日期_d'] = pd.to_datetime(cf_detail['日期']).dt.date
        cf_detail['CF_pos'] = cf_detail.apply(lambda r: -sf(r['现金流(元)']) if r['方向']=='入' else sf(r['现金流(元)']), axis=1)
        for name, grp in cf_detail.groupby('名称'):
            buys_d  = grp[grp['方向']=='出']['日期_d']
            sells_d = grp[grp['方向']=='入']['日期_d']
            first_d = buys_d.min() if len(buys_d) > 0 else date_start
            last_d  = sells_d.max() if len(sells_d) > 0 else date_end
            cf_cat  = str(grp['资产类型'].iloc[0]) if '资产类型' in grp.columns and len(grp) > 0 else '债券类资产管理计划'
            cf_by_name[name] = {
                'total_buy':  float(grp[grp['方向']=='出']['现金流(元)'].apply(sf).sum()),
                'total_sell': float(grp[grp['方向']=='入']['现金流(元)'].apply(sf).sum()),
                'first_d':    first_d, 'last_d': last_d,
                'events':     list(zip(grp['日期_d'], grp['CF_pos'])),
                'cat':        cf_cat,
            }

    ghost_names = set(cf_by_name.keys()) - names_snap - {'', '0', 'nan'}
    ghost_names = {n for n in ghost_names if not any(fc in n for fc in FEE_CATS)}
    all_names   = (names_snap | ghost_names) - {'0', 'nan', ''}

    # ── 4. 托管账户日均持仓 ──
    _托管_cf_daily = {}
    if len(p3) > 0:
        _f3_all_cf = p3[p3['类型'] != '计提费用到期'].copy()
        _f3_all_cf['日期_d'] = pd.to_datetime(_f3_all_cf['日期']).dt.date
        for _, r in _f3_all_cf.iterrows():
            d   = r['日期_d']
            amt = sf(r['现金流(元)'])
            sign = 1.0 if str(r['方向']) == '入' else -1.0
            _托管_cf_daily[d] = _托管_cf_daily.get(d, 0.0) + sign * amt

    def calc_托管_avg(mkt_start, hold_start, hold_end):
        total_d = max((hold_end - hold_start).days, 1)
        bal = mkt_start
        weighted_sum = 0.0
        cur = hold_start
        while cur < hold_end:
            nxt = cur + timedelta(days=1)
            bal_next = bal + _托管_cf_daily.get(nxt, 0.0)
            weighted_sum += bal
            bal = bal_next
            cur = nxt
        return weighted_sum / total_d

    def calc_avg_holding(mkt_s, total_ret, cf_events, hold_start, hold_end):
        total_d = max((hold_end - hold_start).days, 1)
        cf_agg  = defaultdict(float)
        for d, cf in cf_events:
            if hold_start < d <= hold_end:
                cf_agg[d] += cf
        breakpoints = sorted(set([hold_start] + list(cf_agg.keys()) + [hold_end]))
        cur_mkt = mkt_s
        weighted_sum = 0.0
        for i in range(len(breakpoints)-1):
            d0, d1 = breakpoints[i], breakpoints[i+1]
            seg_d  = (d1 - d0).days
            if seg_d == 0: continue
            seg_ret = total_ret * seg_d / total_d
            avg_mkt = cur_mkt + 0.5 * seg_ret
            weighted_sum += avg_mkt * seg_d
            cur_mkt = cur_mkt + seg_ret + cf_agg.get(d1, 0.0)
        return weighted_sum / total_d

    # ── 5. 各资产归因 ──
    results = []
    for name in all_names:
        s1 = snap1[snap1['name']==name]
        s2 = snap2[snap2['name']==name]
        is_ghost = (name in ghost_names)

        mkt_s = float(s1['mkt'].values[0]) if len(s1) else 0.0
        mkt_e = float(s2['mkt'].values[0]) if len(s2) else 0.0
        cf_cat_val = cf_by_name.get(name, {}).get('cat', '')
        s2_cat_val = str(s2['cat'].values[0]) if len(s2) else ''
        s1_cat_val = str(s1['cat'].values[0]) if len(s1) else ''
        if s2_cat_val == '证券清算款':
            cat = cf_cat_val if cf_cat_val and cf_cat_val != '证券清算款' else (
                  s1_cat_val if s1_cat_val and s1_cat_val != '证券清算款' else '证券清算款')
        else:
            cat = cf_cat_val if cf_cat_val else (
                  s2_cat_val if s2_cat_val else (
                  s1_cat_val if s1_cat_val else '债券类资产管理计划'))

        fv_s  = float(s1['fv'].values[0])  if len(s1) else 0.0
        fv_e  = float(s2['fv'].values[0])  if len(s2) else 0.0
        gl_s  = float(s1['gl'].values[0])  if len(s1) else 0.0
        gl_e  = float(s2['gl'].values[0])  if len(s2) else 0.0
        int_s = float(s1['int'].values[0]) if len(s1) else 0.0
        int_e = float(s2['int'].values[0]) if len(s2) else 0.0

        cf_row    = cf_by_name.get(name, {'total_buy':0,'total_sell':0,'first_d':date_start,'last_d':date_end,'events':[]})
        buy_out   = cf_row['total_buy']
        sell_in   = cf_row['total_sell']
        first_d   = cf_row['first_d']
        last_d    = cf_row.get('last_d', date_end)
        cf_events = cf_row['events']

        sell_on_start = sum(abs(cf) for d, cf in cf_events if d == date_start and cf < 0)

        # ═══ 已清仓资产 ═══
        if mkt_e == 0.0:
            if mkt_s > 0:
                total_ret   = (sell_in - sell_on_start) - buy_out - mkt_s
                hold_start  = date_start
                hold_end    = last_d
                hold_days   = max((hold_end - hold_start).days, 1)
                hpr         = total_ret / mkt_s if mkt_s > 0 else 0.0
                hpr_ann     = annualize(hpr, hold_days)
                ret_gl      = total_ret
                ret_fv      = 0.0
                ret_int     = 0.0
                label       = 'HPR（现金流法，已清仓）'
                tail_note   = ''
            else:
                total_ret   = sell_in - buy_out
                hold_start  = first_d
                hold_end    = last_d
                hold_days   = max((hold_end - hold_start).days, 1)
                hpr         = total_ret / buy_out if buy_out > 0 else 0.0
                hpr_ann     = annualize(hpr, hold_days)
                ret_gl      = total_ret
                ret_fv      = 0.0
                ret_int     = 0.0
                label       = 'HPR（现金流法，完整申赎）'
                tail_note   = '期间完整买卖，首尾无持仓'

            if mkt_s > 1000:
                _ah = calc_avg_holding(mkt_s if mkt_s>0 else buy_out, total_ret, cf_events, hold_start, hold_end)
                avg_holding = _ah if _ah > 1000 else max(mkt_s, buy_out, 1.0)
            else:
                avg_holding = max(mkt_s, buy_out, 1.0)

            if avg_holding > 1000:
                r_avg     = total_ret / avg_holding
                r_avg_ann = annualize(r_avg, hold_days)
            else:
                r_avg = hpr; r_avg_ann = hpr_ann
                avg_holding = max(avg_holding, 1.0)

            avg_holding_159 = avg_holding * hold_days / DAYS
            avg_position_pct = avg_holding_159 / nav_init * 100 if nav_init > 0 else 0.0
            contrib_rate = total_ret / nav_init if nav_init else 0.0

            results.append({
                '资产名称': name, '资产类别': cat,
                '期初市值(万)': round(mkt_s/1e4,2), '期末市值(万)': round(mkt_e/1e4,2),
                '本期买卖收益(万)': round(ret_gl/1e4,2), '本期公允变动(万)': round(ret_fv/1e4,2),
                '本期利息收入(万)': round(ret_int/1e4,2),
                '本期总收益(万)': round(total_ret/1e4,2),
                '对产品NAV贡献率(%)': round(contrib_rate*100,4),
                '持有天数': int(hold_days),
                'HPR(%)': fmt_pct(hpr), 'HPR年化(%)': fmt_pct(hpr_ann),
                '平均持仓_自身(万)': round(avg_holding/1e4,2),
                f'平均持仓_{DAYS}天(万)': round(avg_holding_159/1e4,2),
                '平均仓位(%)': round(avg_position_pct,2),
                '平均持仓收益率(%)': fmt_pct(r_avg), '平均持仓年化(%)': fmt_pct(r_avg_ann),
                '收益计算方式': label,
                '尾仓标注': tail_note,
            })
            continue

        # ═══ 持仓中资产 ═══
        hold_start = date_start if mkt_s > 0 else (first_d if hasattr(first_d,'year') else date_start)
        hold_end   = date_end
        hold_days  = max((hold_end - hold_start).days, 1)
        is_custody = (cat == '托管账户')

        ret_int = int_e - int_s

        if is_custody:
            ret_fv = ret_gl = 0.0
            total_ret = ret_int
        else:
            if mkt_s == 0.0 and buy_out > 0:
                ret_fv    = fv_e - fv_s
                ret_gl    = 0.0
                total_ret = mkt_e + sell_in - buy_out + ret_int
            else:
                ret_fv    = fv_e - fv_s
                ret_gl    = gl_e - gl_s
                total_ret = ret_fv + ret_gl + ret_int

        tail = (mkt_e > 0 and mkt_e < 1_000_000)

        if mkt_s > 0:
            hpr_num   = mkt_e + (sell_in - sell_on_start) - buy_out - mkt_s + ret_int
            denom_hpr = mkt_s
        else:
            net_invested = buy_out - sell_in
            if net_invested > 0:
                hpr_num = mkt_e - net_invested; denom_hpr = net_invested
            else:
                hpr_num = sell_in - buy_out; denom_hpr = buy_out if buy_out > 0 else 1.0
        hpr     = float(hpr_num / denom_hpr) if denom_hpr > 0 else 0.0
        hpr_ann = annualize(hpr, hold_days)

        if is_custody:
            _cf_avg = calc_托管_avg(mkt_s, hold_start, date_end)
            avg_holding = _cf_avg if (_cf_avg and _cf_avg > 1000) else max(mkt_s, 1.0)
            r_avg     = total_ret / avg_holding if avg_holding > 1000 else hpr
            r_avg_ann = annualize(r_avg, hold_days) if avg_holding > 1000 else hpr_ann
        elif mkt_s > 1000:
            avg_holding = calc_avg_holding(mkt_s, total_ret, cf_events, hold_start, hold_end)
            if avg_holding > 1000:
                r_avg = total_ret / avg_holding
                r_avg_ann = annualize(r_avg, hold_days)
            else:
                avg_holding = max(mkt_s, 1.0)
                r_avg = hpr; r_avg_ann = hpr_ann
        else:
            net_invested = buy_out - sell_in if buy_out > 0 else mkt_e
            avg_holding  = net_invested if net_invested > 0 else mkt_e
            r_avg = hpr; r_avg_ann = hpr_ann

        avg_holding_159 = avg_holding * hold_days / DAYS
        avg_position_pct = avg_holding_159 / nav_init * 100 if nav_init > 0 else 0.0
        contrib_rate = total_ret / nav_init if nav_init else 0.0

        results.append({
            '资产名称': name, '资产类别': cat,
            '期初市值(万)': round(mkt_s/1e4,2), '期末市值(万)': round(mkt_e/1e4,2),
            '本期买卖收益(万)': round(ret_gl/1e4,2), '本期公允变动(万)': round(ret_fv/1e4,2),
            '本期利息收入(万)': round(ret_int/1e4,2),
            '本期总收益(万)': round(total_ret/1e4,2),
            '对产品NAV贡献率(%)': round(contrib_rate*100,4),
            '持有天数': int(hold_days),
            'HPR(%)': fmt_pct(hpr), 'HPR年化(%)': fmt_pct(hpr_ann),
            '平均持仓_自身(万)': round(avg_holding/1e4,2),
            f'平均持仓_{DAYS}天(万)': round(avg_holding_159/1e4,2),
            '平均仓位(%)': round(avg_position_pct,2),
            '平均持仓收益率(%)': fmt_pct(r_avg), '平均持仓年化(%)': fmt_pct(r_avg_ann),
            '收益计算方式': ('差值法' if not is_custody else '利息差值'),
            '尾仓标注': '实质清仓，仅供参考' if tail else '',
        })

    res_df = pd.DataFrame(results)
    if len(res_df) > 0:
        non_trivial = ((res_df['本期总收益(万)'].abs() > 0.001) | (res_df['期初市值(万)'] > 0) | (res_df['期末市值(万)'] > 0))
        res_df = res_df[non_trivial].copy()
        res_df.sort_values('本期总收益(万)', ascending=False, inplace=True, ignore_index=True)

    # ── 6. 产品日均规模（混合法）──
    if len(p3) > 0:
        sub_rows = p3[p3['类型'] == '净值型产品申购'].copy()
        red_rows = p3[p3['类型'] == '净值型产品赎回'].copy()
        sub_rows['日期_d'] = pd.to_datetime(sub_rows['日期']).dt.date
        red_rows['日期_d'] = pd.to_datetime(red_rows['日期']).dt.date
        sub_by_day = sub_rows.groupby('日期_d')['现金流(元)'].apply(lambda s: sum(sf(v) for v in s)).to_dict()
        red_by_day = red_rows.groupby('日期_d')['现金流(元)'].apply(lambda s: sum(sf(v) for v in s)).to_dict()
    else:
        sub_by_day = red_by_day = {}

    nav_seq = []
    cum_sub = 0.0
    for t in range(DAYS + 1):
        d = date_start + timedelta(days=t)
        if t > 0:
            cum_sub += sub_by_day.get(d, 0.0) - red_by_day.get(d, 0.0)
        nav_t = nav_init + cum_sub + total_return_abs * t / DAYS
        nav_seq.append(nav_t)
    nav_avg_159 = (nav_seq[0] + 2*sum(nav_seq[1:-1]) + nav_seq[-1]) / (2*DAYS) if DAYS > 0 else nav_init

    ret_ann_avg = annualize(total_return_abs / nav_avg_159, DAYS) if nav_avg_159 > 0 else None

    if len(res_df) > 0:
        res_df[f'对产品年化贡献(%)'] = res_df['本期总收益(万)'].apply(
            lambda x: fmt_pct(annualize(x*1e4 / nav_avg_159, DAYS)) if nav_avg_159 > 0 else None
        )

    # ── 7. 费用归因 ──
    def fee_snap_map(pf):
        rows = {}
        for _, r in pf.iterrows():
            if r['产品分类'] in FEE_CATS:
                cat = str(r['产品分类'])
                rows[cat] = {'cat': cat, 'name': str(r['名称']),
                             'bal': sf(r['利息收入/已实现损益(元)'])}
        return rows

    fee1_map = fee_snap_map(p1)
    fee2_map = fee_snap_map(p2)
    fee_paid = {}
    if len(p3) > 0:
        fee_paid_rows = p3[p3['类型'].isin(['支付费用','计提费用到期'])]
        for _, r in fee_paid_rows.iterrows():
            if str(r['方向']) == '出':
                k = str(r['名称'])
                fee_paid[k] = fee_paid.get(k, 0.0) + sf(r['现金流(元)'])

    fee_records = []
    for cat in sorted(set(list(fee1_map.keys()) + list(fee2_map.keys()))):
        bal_s = fee1_map[cat]['bal'] if cat in fee1_map else 0.0
        bal_e = fee2_map[cat]['bal'] if cat in fee2_map else 0.0
        name  = fee2_map[cat]['name'] if cat in fee2_map else (fee1_map[cat]['name'] if cat in fee1_map else cat)
        paid_this = sum(v for k, v in fee_paid.items() if cat in k)
        fee_this  = abs(bal_e) - abs(bal_s)
        fee_records.append({
            '费用类别': cat, '名称': name,
            '期初余额(万)': round(bal_s/1e4,2), '期末余额(万)': round(bal_e/1e4,2),
            '期间实付(万)': round(paid_this/1e4,2),
            '本期费用(万)': round(-fee_this/1e4,2),
            '对产品贡献率(%)': round(-fee_this/nav_init*100,4) if nav_init else 0,
            '费用年化拖累_期初(%)': fmt_pct(annualize(-fee_this/nav_init, DAYS)) if nav_init else None,
            '费用年化拖累_日均(%)': fmt_pct(annualize(-fee_this/nav_avg_159, DAYS)) if nav_avg_159 else None,
        })
    fee_df = pd.DataFrame(fee_records)

    # ── 8. 最终排序与仓位重算 ──
    if len(res_df) > 0:
        res_df.sort_values('本期总收益(万)', ascending=False, inplace=True, ignore_index=True)
        if nav_avg_159 > 0:
            res_df[f'对产品年化贡献(%)'] = res_df['本期总收益(万)'].apply(
                lambda x: fmt_pct(annualize(x*1e4 / nav_avg_159, DAYS)) if nav_avg_159 > 0 else None
            )
            col_159 = f'平均持仓_{DAYS}天(万)'
            res_df['平均仓位(%)'] = (res_df[col_159] * 1e4 / nav_avg_159 * 100).round(2)

    # ── 9. 校验 ──
    asset_total_ret = res_df['本期总收益(万)'].sum() if len(res_df) > 0 else 0.0
    fee_net_wan     = fee_df['本期费用(万)'].sum() if len(fee_df) > 0 else 0.0
    reconcile_sum   = asset_total_ret + fee_net_wan
    gap             = reconcile_sum - total_return_abs/1e4

    return {
        'prod': product_code,
        'prod_name': prod_name,
        'product_nav': {**product_nav,
                        'nav_avg_wan': round(nav_avg_159/1e4, 2),
                        'ret_ann_vs_avg': ret_ann_avg},
        'assets': res_df.to_dict(orient='records') if len(res_df) > 0 else [],
        'fees':   fee_df.to_dict(orient='records') if len(fee_df) > 0 else [],
        'reconcile': {
            'asset_total_ret_wan': float(asset_total_ret),
            'fee_net_wan': float(fee_net_wan),
            'sum_wan': float(reconcile_sum),
            'nav_method_wan': float(total_return_abs/1e4),
            'gap_wan': float(gap),
        },
        'metadata': {
            'prod': product_code, 'prod_name': prod_name,
            'date_start': str(date_start), 'date_end': str(date_end),
            'days': int(DAYS), 'nav_init': float(nav_init), 'nav_end': float(nav_end),
        }
    }
