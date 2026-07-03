# Windows Clipboard Access Methods

> 技术文档：Windows 剪贴板数据访问方法汇总  
> 适用环境：Windows PowerShell 5.0+ / .NET Framework  
> 版本：1.0 | 更新日期：2026-06-26

---

## 1. 概述

Windows 剪贴板通过**数据对象**（DataObject）机制实现跨应用数据交换，支持多种预定义及自定义格式。本文档总结通过 PowerShell 和 .NET Framework 访问剪贴板内容的技术方法。

### 1.1 核心类

| 类/命令 | 命名空间 | 说明 |
|---------|----------|------|
| `Get-Clipboard` | Microsoft.PowerShell.Utility | PowerShell 5.0+ 原生命令 |
| `Clipboard` | System.Windows.Forms | .NET 剪贴板操作类 |
| `IDataObject` | System.Windows | 数据对象接口 |

---

## 2. 访问方法

### 2.1 PowerShell Get-Clipboard

```powershell
# 读取纯文本
$text = Get-Clipboard

# 读取文件列表
$files = Get-Clipboard -Format FileDropList

# 读取图像
$image = Get-Clipboard -Format Image

# 清空剪贴板
Clear-Clipboard
```

**限制**：仅支持 `Text`、`FileDropList`、`Image`、`Audio` 四种格式。

---

### 2.2 .NET Clipboard.GetDataObject()

```powershell
Add-Type -AssemblyName System.Windows.Forms
$clip = [System.Windows.Forms.Clipboard]::GetDataObject()

# 枚举所有格式
$clip.GetFormats()

# 检查格式存在性
$clip.GetDataPresent('FormatName')

# 读取指定格式数据
$data = $clip.GetData('FormatName')
```

**优势**：可访问所有注册格式，包括自定义格式。

---

### 2.3 文件数据访问 (FileDrop)

```powershell
Add-Type -AssemblyName System.Windows.Forms
$clip = [System.Windows.Forms.Clipboard]::GetDataObject()

if ($clip.GetDataPresent('FileDrop')) {
    $files = $clip.GetData('FileDrop')  # String[]
    $files | ForEach-Object {
        Write-Host $_
        Test-Path $_  # 验证文件存在性
    }
}
```

**格式标识**：`FileDrop` / `CF_HDROP` (0x000F)

---

### 2.4 Unicode 文件名访问 (FileNameW)

```powershell
if ($clip.GetDataPresent('FileNameW')) {
    $path = $clip.GetData('FileNameW')  # 单文件路径
    Write-Host $path
}
```

**说明**：仅返回第一个文件路径，支持 Unicode 字符。

---

### 2.5 文件描述符访问 (FileGroupDescriptorW)

```powershell
if ($clip.GetDataPresent('FileGroupDescriptorW')) {
    $stream = $clip.GetData('FileGroupDescriptorW')
    $reader = New-Object System.IO.BinaryReader($stream)
    
    $reader.ReadBytes(4) | Out-Null  # 跳过文件计数字段
    $nameBytes = $reader.ReadBytes(520)  # 260 字符 × 2 字节
    $fileName = [System.Text.Encoding]::Unicode.GetString($nameBytes) -replace "`0", ""
    
    Write-Host $fileName
    $reader.Close()
}
```

**数据结构**：`FILEGROUPDESCRIPTORW` (Win32 API)

---

### 2.6 文本数据访问

```powershell
# 方法 A: .NET
if ($clip.GetDataPresent([System.String])) {
    $text = $clip.GetData([System.String])
}

# 方法 B: PowerShell 原生
$text = Get-Clipboard
```

**格式标识**：`CF_TEXT` (0x0001) / `CF_UNICODETEXT` (0x000D)

---

### 2.7 图像数据访问

```powershell
Add-Type -AssemblyName System.Drawing

if ($clip.GetDataPresent([System.Drawing.Bitmap])) {
    $bitmap = $clip.GetData([System.Drawing.Bitmap])
    Write-Host "Dimensions: $($bitmap.Width) x $($bitmap.Height)"
    Write-Host "PixelFormat: $($bitmap.PixelFormat)"
    $bitmap.Dispose()
}
```

**格式标识**：`CF_BITMAP` (0x0002) / `CF_DIB` (0x0008)

---

### 2.8 HTML 格式访问

```powershell
if ($clip.GetDataPresent('HTML Format')) {
    $htmlStream = $clip.GetData('HTML Format')
    $reader = New-Object System.IO.StreamReader($htmlStream)
    $htmlContent = $reader.ReadToEnd()
    $reader.Close()
}
```

**说明**：浏览器复制内容时常用格式，包含 HTML 片段及元数据头。

---

### 2.9 Shell 对象标识 (Shell IDList Array)

```powershell
if ($clip.GetDataPresent('Shell IDList Array')) {
    # 表示复制的是 Shell 命名空间对象 (文件/文件夹/特殊目录)
    Write-Host "Contains Shell namespace object"
}
```

**说明**：资源管理器复制操作的标准标识，用于拖放和粘贴操作。

---

## 3. 剪贴板格式对照表

| 格式名称 | 常量值 | 数据类型 | 来源 |
|----------|--------|----------|------|
| `CF_TEXT` | 0x0001 | ANSI 字符串 | 文本编辑器 |
| `CF_UNICODETEXT` | 0x000D | Unicode 字符串 | 现代应用 |
| `CF_BITMAP` | 0x0002 | HBITMAP | 图像应用 |
| `CF_DIB` | 0x0008 | BITMAPINFO | 图像应用 |
| `CF_HDROP` | 0x000F | HDROP | 资源管理器 |
| `FileDrop` | - | String[] | 资源管理器 |
| `FileNameW` | - | String | 资源管理器 |
| `FileGroupDescriptorW` | - | FILEGROUPDESCRIPTORW | 资源管理器/拖放 |
| `HTML Format` | - | String | 浏览器 |
| `Shell IDList Array` | - | BYTE[] | 资源管理器 |
| `Preferred DropEffect` | - | DWORD | 拖放操作 |
| `System.String` | - | String | .NET 应用 |

---

## 4. 完整检测脚本

```powershell
# clipboard_audit.ps1
param([switch]$Verbose)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$clip = [System.Windows.Forms.Clipboard]::GetDataObject()
$result = [PSCustomObject]@{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Formats = $clip.GetFormats()
    FormatCount = $clip.GetFormats().Count
    HasFiles = $clip.GetDataPresent('FileDrop')
    HasText = $clip.GetDataPresent([System.String])
    HasImage = $clip.GetDataPresent([System.Drawing.Bitmap])
    HasHTML = $clip.GetDataPresent('HTML Format')
}

if ($Verbose) {
    $result | Format-List *
    
    if ($result.HasFiles) {
        Write-Host "`n[Files]" -ForegroundColor Cyan
        $clip.GetData('FileDrop') | ForEach-Object { Write-Host "  $_" }
    }
    
    if ($result.HasText) {
        Write-Host "`n[Text]" -ForegroundColor Cyan
        Write-Host "  $($clip.GetData([System.String]))"
    }
}

return $result
```

**使用示例**：
```powershell
# 快速检测
.\clipboard_audit.ps1

# 详细输出
.\clipboard_audit.ps1 -Verbose
```

---

## 5. 常见场景与解决方案

### 5.1 资源管理器复制文件

```powershell
# 检测并获取文件路径
$files = Get-Clipboard -Format FileDropList -ErrorAction SilentlyContinue
if ($files) {
    Copy-Item $files -Destination "C:\Target\" -Force
}
```

### 5.2 浏览器复制内容

```powershell
# 优先获取 HTML，回退到纯文本
$clip = [System.Windows.Forms.Clipboard]::GetDataObject()
if ($clip.GetDataPresent('HTML Format')) {
    $content = $clip.GetData('HTML Format')
} elseif ($clip.GetDataPresent([System.String])) {
    $content = $clip.GetData([System.String])
}
```

### 5.3 截图后处理

```powershell
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    $img.Save("C:\Screenshots\capture_$(Get-Date -Format 'yyyyMMdd_HHmmss').png")
    $img.Dispose()
}
```

---

## 6. 注意事项

| 项目 | 说明 |
|------|------|
| **线程模型** | Clipboard 类要求 STA 线程模式 |
| **程序集依赖** | 需加载 `System.Windows.Forms` 和 `System.Drawing` |
| **资源释放** | `Bitmap`、`Stream` 等对象需手动 `Dispose()` |
| **权限限制** | 某些格式可能需要应用前台焦点 |
| **编码问题** | 优先使用 Unicode 格式 (FileNameW/FileGroupDescriptorW) |

---

## 7. 参考资料

1. [Microsoft Docs - Clipboard Class](https://docs.microsoft.com/dotnet/api/system.windows.forms.clipboard)
2. [Microsoft Docs - IDataObject Interface](https://docs.microsoft.com/dotnet/api/system.windows.idataobject)
3. [MSDN - Clipboard Formats](https://docs.microsoft.com/windows/win32/dataxchg/clipboard-formats)
4. [PowerShell Docs - Get-Clipboard](https://docs.microsoft.com/powershell/module/microsoft.powershell.utility/get-clipboard)

---

*文档版本：1.0 | 最后更新：2026-06-26*
