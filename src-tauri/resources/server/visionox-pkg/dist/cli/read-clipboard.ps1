Add-Type -AssemblyName System.Windows.Forms

# Method 1: FileNameW — full paths as String[], usually pre-rendered by Explorer
try {
  $d = [System.Windows.Forms.Clipboard]::GetDataObject()
  if ($d -and $d.GetDataPresent('FileNameW')) {
    $r = $d.GetData('FileNameW')
    if ($r -and $r.Length -gt 0) {
      $r -join [char]10
      exit 0
    }
  }
} catch {}

# Method 2: GetFileDropList — reads CF_HDROP directly
try {
  $f = [System.Windows.Forms.Clipboard]::GetFileDropList()
  if ($f -and $f.Count -gt 0) {
    $f -join [char]10
    exit 0
  }
} catch {}

# Method 3: GetDataObject → FileDrop format
try {
  $d = [System.Windows.Forms.Clipboard]::GetDataObject()
  if ($d -and $d.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    $r = $d.GetData([System.Windows.Forms.DataFormats]::FileDrop)
    if ($r -and $r.Length -gt 0) {
      $r -join [char]10
    }
  }
} catch {}
