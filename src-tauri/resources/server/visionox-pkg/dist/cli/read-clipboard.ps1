Add-Type -AssemblyName System.Windows.Forms

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$result = [ordered]@{
  text = $null
  files = @()
  folders = @()
  paths = @()
}

function Add-ClipboardPath {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return
  }

  $fullPath = $Path.Trim()
  if ($result.paths -notcontains $fullPath) {
    $result.paths += $fullPath
  }

  $item = Get-Item -LiteralPath $fullPath -ErrorAction SilentlyContinue
  if (-not $item) {
    return
  }

  if ($item.PSIsContainer) {
    if ($result.folders -notcontains $item.FullName) {
      $result.folders += $item.FullName
    }
    return
  }

  $alreadyAdded = $false
  foreach ($file in $result.files) {
    if ($file.full -eq $item.FullName) {
      $alreadyAdded = $true
      break
    }
  }

  if (-not $alreadyAdded) {
    $result.files += [ordered]@{
      path = $item.DirectoryName
      name = $item.Name
      full = $item.FullName
    }
  }
}

try {
  if ([System.Windows.Forms.Clipboard]::ContainsText()) {
    $result.text = [System.Windows.Forms.Clipboard]::GetText()
  }
} catch {}

# Explorer Ctrl+C / context-menu copy stores files and folders in CF_HDROP.
try {
  if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
    $dropList = [System.Windows.Forms.Clipboard]::GetFileDropList()
    foreach ($path in $dropList) {
      Add-ClipboardPath -Path $path
    }
  }
} catch {}

# Some applications expose the same list through FileNameW.
try {
  $dataObject = [System.Windows.Forms.Clipboard]::GetDataObject()
  if ($dataObject -and $dataObject.GetDataPresent('FileNameW')) {
    $fileNameList = $dataObject.GetData('FileNameW')
    foreach ($path in $fileNameList) {
      Add-ClipboardPath -Path $path
    }
  }
} catch {}

# Keep a final FileDrop fallback for shell variants and older clipboard producers.
try {
  $dataObject = [System.Windows.Forms.Clipboard]::GetDataObject()
  if ($dataObject -and $dataObject.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    $fileDropList = $dataObject.GetData([System.Windows.Forms.DataFormats]::FileDrop)
    foreach ($path in $fileDropList) {
      Add-ClipboardPath -Path $path
    }
  }
} catch {}

$result | ConvertTo-Json -Depth 4 -Compress
