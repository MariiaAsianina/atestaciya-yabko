#!/usr/bin/env python3
"""Generate data.js (SEED_B64 + DATA_UPDATED) from the attestation .xlsx file.

Mirrors the parsing logic in app.js (parseXLSX / enrich / calcRes) so the
embedded data stays in sync with the source Excel file.

Usage:
    python3 tools/build_data.py "/path/to/Атестація Літо 2026 (N).xlsx"

TESTS_B64 and PLAN_SEED in data.js are left untouched.
"""
import sys, json, zlib, base64, re
from datetime import datetime
from zoneinfo import ZoneInfo
import openpyxl

SKIP_POS = {'Бали старі', 'Бали нові ', 'Бали нові'}

def sv(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.strftime('%d.%m.%Y')
    s = str(v).strip()
    if s == '' or s in ('#N/A', '#REF!', '#VALUE!', '#DIV/0!'):
        return None
    try:
        f = float(s)
        if f == int(f) and 'e' not in s.lower() and '.' not in s:
            return int(f)
        return f
    except ValueError:
        return s

def num(v):
    if v is None or v == '':
        return None
    x = sv(v)
    return x if isinstance(x, (int, float)) else None

def nk(s):
    return ' '.join(str(s or '').strip().lower().split())

def cellstr(v):
    if v is None:
        return ''
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v).strip()

def sheet_rows(ws):
    rows = []
    for r in range(1, ws.max_row + 1):
        row = [ws.cell(row=r, column=c).value for c in range(1, ws.max_column + 1)]
        rows.append(row)
    return rows

def find_col(rows, matchers, max_row):
    results = {m: -1 for m in matchers}
    for r in range(min(max_row, len(rows))):
        row = rows[r] or []
        for c, val in enumerate(row):
            cell = cellstr(val).lower().strip()
            if not cell:
                continue
            for m in matchers:
                if results[m] != -1:
                    continue
                ml = m.lower()
                idx = cell.find(ml)
                if idx == -1:
                    continue
                end = idx + len(ml)
                # don't match if followed by a letter (e.g. 'вхід' must not match 'вхідна')
                if end < len(cell) and cell[end].isalpha():
                    continue
                results[m] = c
    return results

FEEDBACK_MAP = {
    'допустити до усної атестації': 'oral',
    'експерт (70)': 'expert',
    'менеджер (65)': 'manager',
    'спеціаліст': 'specialist',
}

def calc_res(feedback):
    if not feedback:
        return 'none'
    return FEEDBACK_MAP.get(str(feedback).strip().lower(), 'none')

def enrich(raw):
    out = []
    for i, r in enumerate(raw):
        qa = [r.get(k) for k in ('qaLine', 'qaChat', 'qaOrder') if r.get(k) is not None]
        qaAvg = round(sum(qa) / len(qa), 1) if qa else None
        tests = [r.get('test' + str(n)) for n in range(1, 7) if r.get('test' + str(n)) is not None]
        testSum = sum(tests) if tests else None
        rec = dict(r)
        rec['qaAvg'] = qaAvg
        rec['testSum'] = testSum
        rec['result'] = calc_res(rec.get('managerFeedback'))
        rec['_id'] = rec.get('email') or (rec['name'] + '_' + str(i))
        out.append(rec)
    return out

def parse_general(wb):
    ws = wb['Загальна']
    rows = sheet_rows(ws)
    matchers = ['продавець','команда','e-mail','прийом','стаж (місяців)','років','посада','1',
                 'вхідна лінія','чат','замовлення','вхід','конверсія вхід','чати','конверсія чати',
                 '% успішних','к-сть замовлень','відгук керівника','заг. бал']
    gh = find_col(rows, matchers, 3)
    test_start = -1
    for c, val in enumerate(rows[1]):
        if cellstr(val) == '1':
            test_start = c
            break
    ti = test_start if test_start >= 0 else 11
    result = []
    for i in range(3, len(rows)):
        r = rows[i]
        name = sv(r[0]) if len(r) > 0 else None
        if not name or not isinstance(name, str) or not name.strip():
            continue
        pos_idx = gh['посада'] if gh['посада'] >= 0 else 6
        pos = sv(r[pos_idx]) if pos_idx < len(r) else None
        if str(pos) in SKIP_POS:
            continue
        def g(key, default):
            idx = gh[key] if gh[key] >= 0 else default
            return r[idx] if idx < len(r) else None
        result.append({
            'name': name.strip(),
            'supervisor': sv(g('команда', 1)),
            'email': sv(g('e-mail', 2)),
            'hireDate': sv(g('прийом', 3)),
            'tenureMonths': num(g('стаж (місяців)', 4)),
            'tenureYears': num(g('років', 5)),
            'position': str(pos or '').strip(),
            'kpiBal': num(r[9]) if len(r) > 9 else None,
            'test1': num(r[ti]) if ti < len(r) else None,
            'test2': num(r[ti+1]) if ti+1 < len(r) else None,
            'test3': num(r[ti+2]) if ti+2 < len(r) else None,
            'test4': num(r[ti+3]) if ti+3 < len(r) else None,
            'test5': num(r[ti+4]) if ti+4 < len(r) else None,
            'test6': num(r[ti+5]) if ti+5 < len(r) else None,
            'qaLine': num(g('вхідна лінія', 18)),
            'qaChat': num(g('чат', 19)),
            'qaOrder': num(g('замовлення', 20)),
            'kpInbound': num(g('вхід', 22)),
            'kpConvInbound': num(g('конверсія вхід', 23)),
            'kpChats': num(g('чати', 24)),
            'kpConvChat': num(g('конверсія чати', 25)),
            'kpSuccessPct': num(g('% успішних', 26)),
            'kpOrders': num(g('к-сть замовлень', 27)),
            'managerScore': num(g('відгук керівника', 29)),
            'totalScore': num(g('заг. бал', 30)),
            'managerFeedback': sv(r[35]) if len(r) > 35 else '',
            'comment': '',
        })
    return result

def parse_kpi(wb):
    out = {}
    if 'КПІ' not in wb.sheetnames:
        return out
    rows = sheet_rows(wb['КПІ'])
    matchers = ['скла','black side','блоків','corning','чохлів','дг','дг преміум','бал']
    kh = find_col(rows, matchers, 1)
    for i in range(1, len(rows)):
        r = rows[i]
        n = sv(r[0]) if r else None
        if not n or not isinstance(n, str):
            continue
        def g(key, default):
            idx = kh[key] if kh[key] >= 0 else default
            return r[idx] if idx < len(r) else None
        bal = num(g('бал', 9))
        if bal is None:
            continue
        out[nk(n)] = {
            'kpiGlass': num(g('скла', 1)),
            'kpiBlackSide': num(g('black side', 2)),
            'kpiBlocks': num(g('блоків', 3)),
            'kpiCorning': num(g('corning', 4)),
            'kpiCase': num(g('чохлів', 5)),
            'kpiDG': num(g('дг', 6)),
            'kpiDGPremium': num(g('дг преміум', 7)),
            'kpiBal_kpi': bal,
        }
    return out

def parse_chats(wb):
    out = {}
    if 'Чати' not in wb.sheetnames:
        return out
    rows = sheet_rows(wb['Чати'])
    matchers = ['продавець','загальна к-сть','к-сть замовлень з чатів','к-сть днів',
                 'конверсія з чатів','к-сть чатів на день','бал - к-сть чати','бал конверсія']
    ch = find_col(rows, matchers, 1)
    for i in range(1, len(rows)):
        r = rows[i]
        n = sv(r[0]) if r else None
        if not n or not isinstance(n, str):
            continue
        def g(key, default):
            idx = ch[key] if ch[key] >= 0 else default
            return r[idx] if idx < len(r) else None
        tc = num(g('загальна к-сть', 1))
        if tc is None:
            continue
        conv = num(g('конверсія з чатів', 4))
        cpd = num(g('к-сть чатів на день', 5))
        out[nk(n)] = {
            'totalChats': tc,
            'ordersFromChats': num(g('к-сть замовлень з чатів', 2)),
            'workDaysOnChats': num(g('к-сть днів', 3)),
            'convChat': round(conv * 100, 1) if conv is not None else None,
            'chatsPerDay': round(cpd, 1) if cpd is not None else None,
            'balChats': num(g('бал - к-сть чати', 7)),
            'balConvChat': num(g('бал конверсія', 8)),
        }
    return out

def parse_inbound(wb):
    out = {}
    if 'Вхід' not in wb.sheetnames:
        return out
    rows = sheet_rows(wb['Вхід'])
    matchers = ['продавець','кількість вхідних','всього вхід','дз. день',
                 'к--сть замовлень з дзвінка','конверсія з вхідних','бал - к-сть вхід']
    ih = find_col(rows, matchers, 2)
    for i in range(1, len(rows)):
        r = rows[i]
        n = sv(r[0]) if r else None
        if not n or not isinstance(n, str):
            continue
        if n.strip() in ('Продавець:', 'Продавець'):
            continue
        def g(key, default):
            idx = ih[key] if ih[key] >= 0 else default
            return r[idx] if idx < len(r) else None
        ic = num(g('кількість вхідних', 1))
        if ic is None:
            continue
        cpd = num(g('дз. день', 10))
        conv = num(g('конверсія з вхідних', 13))
        out[nk(n)] = {
            'inboundCalls': ic,
            'totalInbound': num(g('всього вхід', 6)),
            'callsPerDay': round(cpd, 1) if cpd is not None else None,
            'ordersFromCalls': num(g('к--сть замовлень з дзвінка', 12)),
            'convInbound': round(conv * 100, 1) if conv is not None else None,
            'balInbound': num(g('бал - к-сть вхід', 15)),
            'balConvInbound': num(r[16]) if len(r) > 16 else None,
        }
    return out

def parse_basket(wb):
    out = {}
    if 'Кошик' not in wb.sheetnames:
        return out
    rows = sheet_rows(wb['Кошик'])
    matchers = ['продавець','всього заявок','успішні','% усп','% відмови','оцінка успішність',
                 'оцінка кількість','замовлення з дзвінка','замовлення з чату']
    bh = find_col(rows, matchers, 1)
    for i in range(1, len(rows)):
        r = rows[i]
        n = sv(r[0]) if r else None
        if not n or not isinstance(n, str):
            continue
        def g(key, default):
            idx = bh[key] if bh[key] >= 0 else default
            return r[idx] if idx < len(r) else None
        to = num(g('всього заявок', 2))
        if to is None:
            continue
        succ = num(g('% усп', 9))
        canc = num(g('% відмови', 10))
        out[nk(n)] = {
            'totalOrders': to,
            'successOrders': num(g('успішні', 4)),
            'successPct': round(succ * 100, 1) if succ is not None else None,
            'cancelPct': round(canc * 100, 1) if canc is not None else None,
            'scoreSuccess': num(g('оцінка успішність', 11)),
            'scoreQty': num(g('оцінка кількість', 12)),
            'ordFromCalls': num(g('замовлення з дзвінка', 14)),
            'ordFromChats': num(g('замовлення з чату', 15)),
        }
    return out


def main():
    if len(sys.argv) != 2:
        print('Usage: build_data.py <path-to-xlsx>')
        sys.exit(1)
    xlsx_path = sys.argv[1]
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)

    general = parse_general(wb)
    kpi = parse_kpi(wb)
    chats = parse_chats(wb)
    inbound = parse_inbound(wb)
    basket = parse_basket(wb)


    merged = enrich(general)
    for rec in merged:
        k = nk(rec['name'])
        for src in (kpi, chats, inbound, basket):
            if k in src:
                rec.update(src[k])
        if rec.get('kpiBal') is None and rec.get('kpiBal_kpi') is not None:
            rec['kpiBal'] = rec['kpiBal_kpi']

    print(f'Parsed {len(merged)} employees', file=sys.stderr)
    none_count = sum(1 for r in merged if r['result'] == 'none')
    print(f'Records with result=none (no totalScore): {none_count}', file=sys.stderr)

    raw_json = json.dumps(merged, ensure_ascii=False, separators=(',', ':'))
    compressed = zlib.compress(raw_json.encode('utf-8'), 9)
    seed_b64 = base64.b64encode(compressed).decode('ascii')

    now = datetime.now(ZoneInfo('Europe/Kyiv')).strftime('%d.%m.%Y %H:%M')

    import os
    data_js_path = os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), '..', 'data.js')
    src = open(data_js_path, encoding='utf-8').read()
    src = re.sub(r"const DATA_UPDATED = '[^']*';", f"const DATA_UPDATED = '{now}';", src)
    src = re.sub(r"const SEED_B64 = '[^']*';", f"const SEED_B64 = '{seed_b64}';", src)

    open(data_js_path, 'w', encoding='utf-8').write(src)
    print(f'data.js updated. DATA_UPDATED={now}, SEED_B64 length={len(seed_b64)}', file=sys.stderr)

if __name__ == '__main__':
    main()
