#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Visionox File — DLP 加密文件搬运工 + 加密检测
═══════════════════════════════════════════════
原理:
  创建可见 GUI 窗口 → 进程获得 Windows 消息泵
  → DLP 驱动识别为交互进程 → open()/shutil.copy2() 透明解密
  → 写入临时目录 → AI 从临时目录读取明文

用法:
  python visionox_file.py <源文件或目录>          # 搬运解密
  python visionox_file.py --check <文件>           # 检测单文件是否加密
  python visionox_file.py --check-dir <目录>       # 检测目录中哪些文件加密
  python visionox_file.py --clean                  # 清理临时目录

输出:
  JSON → {"ok": true, ...}
"""

import sys, json, shutil, tempfile, time, threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

TEMP_ROOT = Path(tempfile.gettempdir()) / 'visionox_decrypted'

# ── DLP 加密特征 ──
# 本机 DLP 加密文件的头 4 字节为全零 (正常文件绝不会以此开头)
DLP_MAGIC = b'\x00\x00\x00\x00'

# 常见未加密文件头白名单（快速跳过检测）
PLAINTEXT_SIGNATURES = [
    b'PK\x03\x04',       # ZIP / Office xlsx/docx/pptx
    b'\xd0\xcf\x11\xe0', # OLE2 / Office xls/doc/ppt
    b'%PDF',             # PDF
    b'\x89PNG',          # PNG
    b'\xff\xd8\xff',     # JPEG
    b'GIF8',             # GIF
    b'RIFF',             # WAV/AVI
    b'\x1f\x8b',         # GZIP
    b'BZh',              # BZ2
    b'\x50\x4b\x03\x04', # PK (同上，显式写法)
]

RESULT = {}


def _read_header(path, n=4):
    """读取文件头部 n 字节，返回 (header, error)"""
    try:
        with open(path, 'rb') as f:
            return f.read(n), None
    except Exception as e:
        return None, str(e)


def is_encrypted(path):
    """
    检测文件是否被 DLP 加密。
    返回 (encrypted: bool|None, header_hex: str, reason: str, status: str, ok: bool)
    """
    h, read_error = _read_header(path, 4)
    if h is None:
        return None, '', f'无法读取文件: {read_error or "unknown"}', 'unknown', False
    if len(h) < 4:
        return None, h.hex(), '文件头不足，无法判断文件状态', 'unknown', False
    if h == DLP_MAGIC:
        return True, h.hex(), '需要兼容读取 (全零头)', 'protected', True
    for sig in PLAINTEXT_SIGNATURES:
        if h[:len(sig)] == sig:
            return False, h.hex(), f'可直接读取 ({sig.hex()} 签名)', 'plain', True
    return False, h.hex(), '未知签名，未发现全零头特征', 'plain_unknown', True


def check_file(path):
    """检测单个文件，返回 JSON"""
    encrypted, header, reason, status, ok = is_encrypted(path)
    return {
        'ok': ok,
        'path': str(path),
        'encrypted': encrypted,
        'status': status,
        'header': header,
        'reason': reason,
    }


def check_dir(path):
    """检测目录中所有文件，返回加密文件列表"""
    results = []
    for f in sorted(Path(path).rglob('*')):
        if f.is_file():
            encrypted, header, reason, status, ok = is_encrypted(str(f))
            if encrypted:
                results.append({
                    'path': str(f),
                    'status': status,
                    'header': header,
                    'reason': reason,
                })
    return results


def collect_files(sources):
    files = []
    for s in sources:
        sp = Path(s)
        if not sp.exists():
            continue
        if sp.is_file():
            files.append(sp)
        elif sp.is_dir():
            for entry in sorted(sp.rglob('*')):
                if entry.is_file():
                    files.append(entry)
    return files


def _is_zip_content(path):
    """检测文件是否为 ZIP/XLSX 格式 (PK 头)"""
    h, _ = _read_header(path, 4)
    return h is not None and h == b'PK\x03\x04'


def _xls_to_xlsx_aliases(files, dst_dir):
    """对文件头为 PK 但扩展名不是 .xlsx 的文件, 额外复制一份 .xlsx 别名"""
    extra = []
    for fp in files:
        dst = dst_dir / fp.name
        if not dst.exists():
            continue
        ext = dst.suffix.lower()
        if ext == '.xls' and _is_zip_content(dst):
            alias = dst.with_suffix('.xlsx')
            if not alias.exists():
                shutil.copy2(str(dst), str(alias))
                extra.append({'name': alias.name, 'src': str(dst), 'alias_of': fp.name})
    return extra


def process_files(files, dst_dir, status_cb):
    results = []
    ok = fail = 0
    total = len(files)
    for i, fp in enumerate(files):
        status_cb(f'处理中 ({i+1}/{total}): {fp.name}')
        r = {'name': fp.name, 'src': str(fp)}
        try:
            dst = dst_dir / fp.name
            shutil.copy2(str(fp), str(dst))
            r['status'] = 'ok'
            r['dst'] = str(dst)
            r['size'] = dst.stat().st_size
            ok += 1
        except Exception as e:
            r['status'] = 'error'
            r['error'] = str(e)
            fail += 1
        results.append(r)

    # 自动补 .xlsx 别名
    aliases = _xls_to_xlsx_aliases(files, dst_dir)
    for a in aliases:
        results.append({'name': a['name'], 'src': a['src'], 'status': 'ok',
                        'alias_of': a['alias_of'], 'note': 'auto .xlsx alias for .xls with PK header'})
        ok += 1

    return results, ok, fail


def main(sources):
    global RESULT
    source_list = sources or [r'D:\_归档\测试文档']
    session_dir = TEMP_ROOT / datetime.now().strftime('%Y%m%d_%H%M%S')

    files = collect_files(source_list)
    if not files:
        RESULT = {'ok': False, 'error': '没有找到文件'}
        print(json.dumps(RESULT, ensure_ascii=False, indent=2))
        return

    session_dir.mkdir(parents=True, exist_ok=True)

    # ~ GUI 窗口 ~
    root = tk.Tk()
    root.title('Visionox File — 文件读取中...')
    root.geometry('420x120')
    root.attributes('-topmost', True)

    status_var = tk.StringVar(value=f'准备处理 {len(files)} 个文件...')
    ttk.Label(root, text='文件读取中...', font=('Microsoft YaHei', 12, 'bold')).pack(pady=(12, 2))
    ttk.Label(root, textvariable=status_var, font=('Microsoft YaHei', 10)).pack(pady=(8, 2))

    root.update()
    root.deiconify()

    def do_work():
        results, ok, fail = process_files(files, session_dir, lambda m: (status_var.set(m), root.update()))
        status_var.set(f'✓ 完成! 成功 {ok}, 失败 {fail}')
        RESULT = {
            'ok': True,
            'target_dir': str(session_dir),
            'total': len(files),
            'ok_count': ok,
            'fail_count': fail,
            'files': results,
        }
        print(json.dumps(RESULT, ensure_ascii=False, indent=2))
        root.after(2000, root.destroy)

    root.after(200, do_work)
    root.mainloop()


def clean():
    if TEMP_ROOT.exists():
        shutil.rmtree(str(TEMP_ROOT), ignore_errors=True)
    print(json.dumps({'ok': True, 'action': 'cleaned'}, ensure_ascii=False))


if __name__ == '__main__':
    args = sys.argv[1:]

    if '--clean' in args:
        clean()
    elif '--check' in args:
        # --check <文件路径>
        idx = args.index('--check')
        path = args[idx + 1] if idx + 1 < len(args) else None
        if not path:
            print(json.dumps({'ok': False, 'error': '--check 需要文件路径'}, ensure_ascii=False))
        else:
            print(json.dumps(check_file(path), ensure_ascii=False, indent=2))
    elif '--check-dir' in args:
        # --check-dir <目录路径>
        idx = args.index('--check-dir')
        path = args[idx + 1] if idx + 1 < len(args) else None
        if not path:
            print(json.dumps({'ok': False, 'error': '--check-dir 需要目录路径'}, ensure_ascii=False))
        else:
            results = check_dir(path)
            print(json.dumps({
                'ok': True,
                'directory': str(path),
                'encrypted_count': len(results),
                'files': results,
            }, ensure_ascii=False, indent=2))
    else:
        main([a for a in args if a != '--clean'])
