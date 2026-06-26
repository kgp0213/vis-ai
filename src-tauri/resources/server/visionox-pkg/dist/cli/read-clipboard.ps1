[CmdletBinding()]
param()

# Ensure JSON output is UTF-8 and does not leak assignment values.
$null = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# C# helpers for formats not directly exposed by System.Windows.Forms.Clipboard.
$helperSource = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public static class ClipboardHelper {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern bool SHGetPathFromIDListW(IntPtr pidl, [MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszPath);

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct FILETIME {
        public uint dwLowDateTime;
        public uint dwHighDateTime;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode, Pack = 4)]
    public struct FILEDESCRIPTOR {
        public uint dwFlags;
        public Guid clsid;
        public long sizel;
        public long pointl;
        public uint dwFileAttributes;
        public FILETIME ftCreationTime;
        public FILETIME ftLastAccessTime;
        public FILETIME ftLastWriteTime;
        public uint nFileSizeHigh;
        public uint nFileSizeLow;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string cFileName;
    }

    public static string[] GetFileDropPaths() {
        var list = new System.Collections.Generic.List<string>();
        var data = Clipboard.GetDataObject();
        if (data == null) return list.ToArray();
        if (data.GetDataPresent(DataFormats.FileDrop, false)) {
            var arr = data.GetData(DataFormats.FileDrop, false) as string[];
            if (arr != null) {
                foreach (var s in arr) if (!string.IsNullOrWhiteSpace(s)) list.Add(s);
            }
        }
        return list.ToArray();
    }

    public static string[] GetFileNameW() {
        var list = new System.Collections.Generic.List<string>();
        var data = Clipboard.GetDataObject();
        if (data == null) return list.ToArray();
        if (data.GetDataPresent("FileNameW", false)) {
            var s = data.GetData("FileNameW", false) as string;
            if (!string.IsNullOrWhiteSpace(s)) list.Add(s);
        }
        return list.ToArray();
    }

    public static string[] GetFileGroupDescriptorNames() {
        var list = new System.Collections.Generic.List<string>();
        var data = Clipboard.GetDataObject();
        if (data == null) return list.ToArray();
        if (data.GetDataPresent("FileGroupDescriptorW", false)) {
            object obj = data.GetData("FileGroupDescriptorW", false);
            byte[] bytes = null;
            Stream stream = obj as Stream;
            if (stream != null) {
                using (var ms = new MemoryStream()) { stream.CopyTo(ms); bytes = ms.ToArray(); }
            } else if (obj is byte[]) {
                bytes = (byte[])obj;
            }
            if (bytes != null && bytes.Length >= 4) {
                int count = BitConverter.ToInt32(bytes, 0);
                int offset = 4;
                int descriptorSize = Marshal.SizeOf(typeof(FILEDESCRIPTOR));
                for (int i = 0; i < count && offset + descriptorSize <= bytes.Length; i++) {
                    IntPtr ptr = Marshal.AllocHGlobal(descriptorSize);
                    try {
                        Marshal.Copy(bytes, offset, ptr, descriptorSize);
                        var fd = (FILEDESCRIPTOR)Marshal.PtrToStructure(ptr, typeof(FILEDESCRIPTOR));
                        if (!string.IsNullOrWhiteSpace(fd.cFileName)) list.Add(fd.cFileName);
                        offset += descriptorSize;
                    } finally {
                        Marshal.FreeHGlobal(ptr);
                    }
                }
            }
        }
        return list.ToArray();
    }

    public static string[] GetShellIdListPaths() {
        var list = new System.Collections.Generic.List<string>();
        var data = Clipboard.GetDataObject();
        if (data == null) return list.ToArray();
        if (data.GetDataPresent("Shell IDList Array", false)) {
            object obj = data.GetData("Shell IDList Array", false);
            byte[] bytes = null;
            if (obj is byte[]) bytes = (byte[])obj;
            else if (obj is Stream) { using (var ms = new MemoryStream()) { ((Stream)obj).CopyTo(ms); bytes = ms.ToArray(); } }
            if (bytes != null && bytes.Length >= 4) {
                int count = BitConverter.ToInt32(bytes, 0);
                if (count > 0 && bytes.Length >= 4 + (count + 1) * 4) {
                    // CIDA layout: count + (count+1) offsets. The first PIDL is the parent folder,
                    // the remainder are child items. Try to resolve the parent path and append child names.
                    var offsets = new int[count + 1];
                    for (int i = 0; i <= count; i++) {
                        offsets[i] = BitConverter.ToInt32(bytes, 4 + i * 4);
                    }
                    string parentPath = "";
                    if (offsets[0] >= 0 && offsets[0] < bytes.Length) {
                        parentPath = PidlToPath(bytes, offsets[0]);
                    }
                    for (int i = 1; i <= count; i++) {
                        if (offsets[i] < 0 || offsets[i] >= bytes.Length) continue;
                        string childName = PidlFileName(bytes, offsets[i]);
                        if (string.IsNullOrWhiteSpace(childName)) continue;
                        if (!string.IsNullOrEmpty(parentPath)) {
                            list.Add(System.IO.Path.Combine(parentPath, childName));
                        } else {
                            list.Add(childName);
                        }
                    }
                }
            }
        }
        return list.ToArray();
    }

    private static string PidlToPath(byte[] bytes, int offset) {
        if (offset + 2 > bytes.Length) return "";
        ushort cb = BitConverter.ToUInt16(bytes, offset);
        if (cb == 0) return "";
        IntPtr pidl = Marshal.AllocHGlobal(cb);
        try {
            Marshal.Copy(bytes, offset, pidl, cb);
            var sb = new StringBuilder(260);
            if (SHGetPathFromIDListW(pidl, sb)) return sb.ToString();
        } finally { Marshal.FreeHGlobal(pidl); }
        return "";
    }

    private static string PidlFileName(byte[] bytes, int offset) {
        // A relative child PIDL is a sequence of SHITEMID entries. The last usable
        // entry usually contains the file name. Walk the entries and pick the last one.
        string last = "";
        int pos = offset;
        while (pos + 2 <= bytes.Length) {
            ushort cb = BitConverter.ToUInt16(bytes, pos);
            if (cb <= 2) break;
            int dataLen = cb - 2;
            if (dataLen > 0 && pos + 2 + dataLen <= bytes.Length) {
                // The data may start with a length-prefixed UTF-16LE name. Try several offsets.
                string name = TryReadName(bytes, pos + 2, dataLen);
                if (!string.IsNullOrWhiteSpace(name)) last = name;
            }
            pos += cb;
        }
        return last;
    }

    private static string TryReadName(byte[] bytes, int offset, int length) {
        // Try to locate a null-terminated UTF-16LE string inside the SHITEMID data.
        for (int i = 0; i + 1 < length; i += 2) {
            if (bytes[offset + i] == 0 && bytes[offset + i + 1] == 0) {
                if (i == 0) return "";
                try { return System.Text.Encoding.Unicode.GetString(bytes, offset, i); }
                catch { }
                break;
            }
        }
        return "";
    }
}
'@

$typeLoaded = $false
try {
    Add-Type -TypeDefinition $helperSource -ReferencedAssemblies System.Windows.Forms -Language CSharp -ErrorAction Stop | Out-Null
    $typeLoaded = $true
} catch {
    try {
        Add-Type -TypeDefinition $helperSource -Language CSharp -ErrorAction Stop | Out-Null
        $typeLoaded = $true
    } catch {
        # Leave typeLoaded false; fall back to basic methods.
    }
}

function Read-ClipboardPathsInternal {
    $result = @{
        ok = $false
        paths = @()
        sourceFormat = $null
        diagnostics = @{
            formats = @()
            tried = @()
            errors = @()
        }
    }

    $data = $null
    try {
        $data = [System.Windows.Forms.Clipboard]::GetDataObject()
        if ($data) { $result.diagnostics.formats = @($data.GetFormats()) }
    } catch {
        $result.diagnostics.errors += "GetDataObject failed: $($_.Exception.Message)"
    }

    if ($data) {
        # 1. Native Get-Clipboard FileDropList
        try {
            $result.diagnostics.tried += "Get-Clipboard FileDropList"
            $files = Get-Clipboard -Format FileDropList -ErrorAction Stop
            if ($files) {
                $paths = @($files | ForEach-Object { $_.ToString() } | Where-Object { $_ })
                if ($paths.Count -gt 0) {
                    $result.paths = $paths
                    $result.sourceFormat = "Get-Clipboard FileDropList"
                    $result.ok = $true
                    return $result
                }
            }
        } catch {
            $result.diagnostics.errors += "Get-Clipboard FileDropList: $($_.Exception.Message)"
        }

        # 2. Clipboard.GetFileDropList
        try {
            $result.diagnostics.tried += "Clipboard.GetFileDropList"
            $list = [System.Windows.Forms.Clipboard]::GetFileDropList()
            if ($list -and $list.Count -gt 0) {
                $result.paths = @($list | ForEach-Object { $_.ToString() })
                $result.sourceFormat = "GetFileDropList"
                $result.ok = $true
                return $result
            }
        } catch {
            $result.diagnostics.errors += "GetFileDropList: $($_.Exception.Message)"
        }

        # 3. FileDrop (CF_HDROP)
        try {
            $result.diagnostics.tried += "FileDrop"
            $arr = [ClipboardHelper]::GetFileDropPaths()
            if ($arr -and $arr.Length -gt 0) {
                $result.paths = @($arr)
                $result.sourceFormat = "FileDrop"
                $result.ok = $true
                return $result
            }
        } catch {
            $result.diagnostics.errors += "FileDrop: $($_.Exception.Message)"
        }

        # 4. FileNameW
        try {
            $result.diagnostics.tried += "FileNameW"
            $arr = [ClipboardHelper]::GetFileNameW()
            if ($arr -and $arr.Length -gt 0) {
                $result.paths = @($arr)
                $result.sourceFormat = "FileNameW"
                $result.ok = $true
                return $result
            }
        } catch {
            $result.diagnostics.errors += "FileNameW: $($_.Exception.Message)"
        }

        # 5. FileGroupDescriptorW
        if ($typeLoaded) {
            try {
                $result.diagnostics.tried += "FileGroupDescriptorW"
                $arr = [ClipboardHelper]::GetFileGroupDescriptorNames()
                if ($arr -and $arr.Length -gt 0) {
                    $result.paths = @($arr)
                    $result.sourceFormat = "FileGroupDescriptorW"
                    $result.ok = $true
                    return $result
                }
            } catch {
                $result.diagnostics.errors += "FileGroupDescriptorW: $($_.Exception.Message)"
            }
        }

        # 6. Shell IDList Array
        if ($typeLoaded) {
            try {
                $result.diagnostics.tried += "Shell IDList Array"
                $arr = [ClipboardHelper]::GetShellIdListPaths()
                if ($arr -and $arr.Length -gt 0) {
                    $result.paths = @($arr)
                    $result.sourceFormat = "Shell IDList Array"
                    $result.ok = $true
                    return $result
                }
            } catch {
                $result.diagnostics.errors += "Shell IDList Array: $($_.Exception.Message)"
            }
        }
    }

    # 7. Plain text that contains existing paths
    try {
        $result.diagnostics.tried += "Text"
        $txt = [System.Windows.Forms.Clipboard]::GetText()
        if ($txt) {
            $existing = @($txt -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and (Test-Path $_ -PathType Any -ErrorAction SilentlyContinue) })
            if ($existing.Count -gt 0) {
                $result.paths = $existing
                $result.sourceFormat = "Text"
                $result.ok = $true
                return $result
            }
        }
    } catch {
        $result.diagnostics.errors += "Text: $($_.Exception.Message)"
    }

    $result.error = "No supported clipboard format contained accessible file paths."
    return $result
}

function Read-ClipboardPaths {
    if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -eq [System.Threading.ApartmentState]::STA) {
        return Read-ClipboardPathsInternal
    }
    $script:threadResult = $null
    $thread = [System.Threading.Thread]::new([System.Threading.ThreadStart]{
        $script:threadResult = Read-ClipboardPathsInternal
    })
    $thread.SetApartmentState([System.Threading.ApartmentState]::STA)
    $thread.Start()
    $thread.Join()
    return $script:threadResult
}

$result = Read-ClipboardPaths
if ($result -and $result.paths) {
    $result.paths = @($result.paths | Select-Object -Unique)
}
ConvertTo-Json -InputObject $result -Depth 5 -Compress
