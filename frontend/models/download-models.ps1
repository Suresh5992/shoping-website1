$ErrorActionPreference = 'Stop'
$cwd = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $cwd

$models = @('ssd_mobilenetv1','face_landmark_68','face_recognition','tiny_face_detector')
$base = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'

if(-not (Test-Path models)){ New-Item -ItemType Directory -Path models | Out-Null }

foreach($m in $models){
    $manifestName = "${m}_model-weights_manifest.json"
    $manifestUrl = "$base/$manifestName"
    $mfOut = "models/$manifestName"
    Write-Host "Downloading manifest: $manifestUrl"
    try{
        Invoke-WebRequest $manifestUrl -OutFile $mfOut -UseBasicParsing -ErrorAction Stop
    }catch{
        Write-Host "Failed to download manifest $manifestUrl"
        Write-Host $_.ToString()
        continue
    }
    $json = Get-Content -Raw $mfOut | ConvertFrom-Json
    $entries = @()
    if($json -is [System.Array]){ $entries = $json } else { $entries = @($json) }
    $paths = @()
    foreach($entry in $entries){
        if($entry.paths){ foreach($p in $entry.paths){ if(-not ($paths -contains $p)) { $paths += $p } } }
        if($entry.weights){ foreach($w in $entry.weights){ if($w.paths){ foreach($p in $w.paths){ if(-not ($paths -contains $p)) { $paths += $p } } } } }
    }
    Write-Host "Found $(($paths).Count) weight path(s) in manifest"
    foreach($p in $paths){
        $downloaded = $false
        $candidates = @("$base/$p", "$base/$p.bin")
        foreach($u in $candidates){
            try{
                $leaf = Split-Path -Leaf $u
                $out = "models/$leaf"
                if(Test-Path $out){ Write-Host "Already have $leaf, skipping."; $downloaded = $true; break }
                Write-Host "Trying $u"
                Invoke-WebRequest $u -OutFile $out -UseBasicParsing -ErrorAction Stop
                Write-Host "Saved $out"
                $downloaded = $true
                break
            }catch{
                # try next candidate
            }
        }
        if(-not $downloaded){ Write-Host "Failed to download weight path: $p" }
    }
}

Write-Host "Done. Check the 'models' folder for downloaded files."