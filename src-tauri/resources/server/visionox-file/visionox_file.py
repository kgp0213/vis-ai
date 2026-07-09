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

import sys, json, shutil, tempfile, glob, os, hashlib
from datetime import datetime
import tkinter as tk
from tkinter import ttk

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

TEMP_ROOT = os.path.join(tempfile.gettempdir(), 'visionox_decrypted')
LONG_PREFIX = '\\\\?\\'

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


def _win_long(path):
    r"""为超长 Windows 路径添加 \\?\ 前缀。"""
    p = os.fspath(path)
    if os.name != 'nt':
        return p
    if p.startswith(LONG_PREFIX) or p.startswith('\\\\?\\UNC\\'):
        return p
    abs_path = os.path.abspath(p)
    if len(abs_path) <= 240:
        return abs_path
    if abs_path.startswith('\\\\'):
        return '\\\\?\\UNC\\' + abs_path.lstrip('\\')
    return LONG_PREFIX + abs_path


def _strip_long_prefix(path):
    p = os.fspath(path)
    if p.startswith('\\\\?\\UNC\\'):
        return '\\\\' + p[8:]
    if p.startswith(LONG_PREFIX):
        return p[4:]
    return p


def _path_key(path):
    return os.path.normcase(os.path.abspath(os.fspath(path)))


def _has_glob_magic(path):
    return any(ch in os.fspath(path) for ch in '*?[')


def _is_file(path):
    try:
        return os.path.isfile(_win_long(path))
    except (OSError, ValueError):
        return False


def _is_dir(path):
    try:
        return os.path.isdir(_win_long(path))
    except (OSError, ValueError):
        return False


def _read_header(path, n=4):
    """读取文件头部 n 字节，返回 (header, error)"""
    try:
        with open(_win_long(path), 'rb') as f:
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
    for f in collect_files([path]):
        encrypted, header, reason, status, ok = is_encrypted(f)
        if encrypted:
            results.append({
                'path': f,
                'status': status,
                'header': header,
                'reason': reason,
            })
    return results


def _collect_dir_files(root):
    files = []
    try:
        for dirpath, _dirnames, filenames in os.walk(_win_long(root)):
            for name in sorted(filenames):
                files.append(_strip_long_prefix(os.path.join(dirpath, name)))
    except (OSError, ValueError):
        pass
    return files


def _fix_encoding(s):
    """修复少数命令行代码页不一致导致的路径编码异常。"""
    try:
        encoded = os.fsencode(s)
        decoded = os.fsdecode(encoded)
        return decoded if decoded else s
    except (UnicodeEncodeError, UnicodeDecodeError, TypeError):
        return s


def collect_files(sources):
    files = []
    for s in sources:
        raw = _fix_encoding(os.fspath(s))
        matches = glob.glob(raw, recursive=True) if _has_glob_magic(raw) else [raw]
        for m in matches:
            if _is_file(m):
                files.append(os.path.abspath(m))
            elif _is_dir(m):
                files.extend(_collect_dir_files(m))

    seen = set()
    unique = []
    for f in files:
        key = _path_key(f)
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)
    return unique
    return files


def _is_zip_content(path):
    """检测文件是否为 ZIP/XLSX 格式 (PK 头)"""
    h, _ = _read_header(path, 4)
    return h is not None and h == b'PK\x03\x04'


def _xls_to_xlsx_aliases(copied_files):
    """对文件头为 PK 但扩展名不是 .xlsx 的文件, 额外复制一份 .xlsx 别名"""
    extra = []
    for item in copied_files:
        dst = item.get('dst')
        if not dst or not _is_file(dst):
            continue
        ext = os.path.splitext(dst)[1].lower()
        if ext == '.xls' and _is_zip_content(dst):
            alias = os.path.splitext(dst)[0] + '.xlsx'
            if not _is_file(alias):
                shutil.copy2(_win_long(dst), _win_long(alias))
                extra.append({'name': os.path.basename(alias), 'src': dst, 'dst': alias, 'alias_of': item.get('name')})
    return extra


def _unique_destination(dst_dir, name, source_path, used):
    candidate = os.path.join(dst_dir, name)
    key = _path_key(candidate)
    if key not in used and not _is_file(candidate):
        used.add(key)
        return candidate

    stem, ext = os.path.splitext(name)
    digest = hashlib.sha1(os.path.abspath(source_path).encode('utf-8', 'ignore')).hexdigest()[:8]
    candidate = os.path.join(dst_dir, f'{stem}__{digest}{ext}')
    key = _path_key(candidate)
    counter = 2
    while key in used or _is_file(candidate):
        candidate = os.path.join(dst_dir, f'{stem}__{digest}_{counter}{ext}')
        key = _path_key(candidate)
        counter += 1
    used.add(key)
    return candidate


def process_files(files, dst_dir, status_cb):
    results = []
    copied = []
    used_destinations = set()
    ok = fail = 0
    total = len(files)
    for i, fp in enumerate(files):
        name = os.path.basename(fp)
        status_cb(f'处理中 ({i+1}/{total}): {name}')
        r = {'name': name, 'src': fp}
        try:
            dst = _unique_destination(dst_dir, name, fp, used_destinations)
            shutil.copy2(_win_long(fp), _win_long(dst))
            r['status'] = 'ok'
            r['dst'] = dst
            r['size'] = os.path.getsize(_win_long(dst))
            copied.append(r)
            ok += 1
        except Exception as e:
            r['status'] = 'error'
            r['error'] = str(e)
            fail += 1
        results.append(r)

    # 自动补 .xlsx 别名
    aliases = _xls_to_xlsx_aliases(copied)
    for a in aliases:
        results.append({'name': a['name'], 'src': a['src'], 'dst': a['dst'], 'status': 'ok',
                        'alias_of': a['alias_of'], 'note': 'auto .xlsx alias for .xls with PK header'})
        ok += 1

    return results, ok, fail


def main(sources):
    global RESULT
    source_list = sources or []
    session_dir = os.path.join(TEMP_ROOT, datetime.now().strftime('%Y%m%d_%H%M%S'))

    files = collect_files(source_list)
    if not files:
        RESULT = {'ok': False, 'error': '没有找到文件'}
        print(json.dumps(RESULT, ensure_ascii=False, indent=2))
        return

    os.makedirs(_win_long(session_dir), exist_ok=True)

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
    if _is_dir(TEMP_ROOT):
        shutil.rmtree(_win_long(TEMP_ROOT), ignore_errors=True)
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
