param(
  [Parameter(Mandatory = $true)]
  [string]$PollutionCheck,

  [Parameter(Mandatory = $true)]
  [string]$TestPattern
)

$ErrorActionPreference = 'Stop'
$testFiles = @(Get-ChildItem -Path . -Recurse -File | Where-Object {
  $_.FullName -like (Join-Path (Get-Location) $TestPattern)
} | Sort-Object FullName)

Write-Host "Searching $($testFiles.Count) test files for pollution: $PollutionCheck"

foreach ($testFile in $testFiles) {
  if (Test-Path -LiteralPath $PollutionCheck) {
    throw "Pollution already exists before test: $($testFile.FullName)"
  }

  Write-Host "Testing: $($testFile.FullName)"
  & npm test -- $testFile.FullName *> $null

  if (Test-Path -LiteralPath $PollutionCheck) {
    Write-Host "Polluter found: $($testFile.FullName)"
    Get-Item -LiteralPath $PollutionCheck | Format-List FullName, Length, LastWriteTime
    exit 1
  }
}

Write-Host 'No polluter found.'
exit 0
