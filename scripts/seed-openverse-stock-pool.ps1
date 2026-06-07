$ErrorActionPreference = 'Stop'

$stockDir = Join-Path (Get-Location) 'cms-stock-images'
$targetTotal = 500
$pageSize = 20
$maxPages = 12

$targets = @(
  @{ Category = 'Son Dakika'; Quota = 50; Queries = @('breaking news press conference', 'emergency response street', 'headline news reporter') },
  @{ Category = 'Gundem'; Quota = 50; Queries = @('daily life city people news', 'street crowd newspaper', 'public life city scene') },
  @{ Category = 'Siyaset'; Quota = 50; Queries = @('parliament politician press conference', 'government meeting leader', 'election politics speech') },
  @{ Category = 'Ekonomi'; Quota = 50; Queries = @('business meeting office finance', 'stock market trader business', 'economy money office') },
  @{ Category = 'Dunya'; Quota = 50; Queries = @('diplomacy world leaders meeting', 'international protest city', 'global summit leaders') },
  @{ Category = 'Spor'; Quota = 50; Queries = @('football stadium athlete', 'basketball player game', 'sports crowd competition') },
  @{ Category = 'Magazin'; Quota = 50; Queries = @('celebrity event red carpet', 'fashion event people', 'music performance audience') },
  @{ Category = 'Teknoloji'; Quota = 50; Queries = @('computer laptop robotics', 'artificial intelligence technology', 'electronics startup office') },
  @{ Category = 'Saglik'; Quota = 50; Queries = @('doctor hospital medical', 'healthcare clinic patient', 'wellness medicine hospital') },
  @{ Category = 'Video'; Quota = 50; Queries = @('camera studio microphone', 'video production filming', 'news camera operator') }
)

$topUpQueries = @(
  @{ Category = 'Genel'; Query = 'news people city' },
  @{ Category = 'Genel'; Query = 'press conference audience' },
  @{ Category = 'Genel'; Query = 'crowd public gathering' }
)

$badTerms = @('cartoon','illustration','vector','logo','icon','poster','clipart','render','painting','drawing','sketch','abstract','background','template')

function Slugify([string]$Value) {
  if (-not $Value) { return '' }
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  $ascii = $sb.ToString().ToLowerInvariant()
  $ascii = [regex]::Replace($ascii, '[^a-z0-9]+', '-')
  $ascii = $ascii.Trim('-')
  if ($ascii.Length -gt 80) { $ascii = $ascii.Substring(0, 80).Trim('-') }
  return $ascii
}

function Titleize([string]$Value, [string]$Fallback) {
  $clean = (($Value -replace '\s+', ' ').Trim())
  if ($clean) { return $clean }
  return $Fallback
}

function Get-ExistingSets {
  $usedUrls = New-Object 'System.Collections.Generic.HashSet[string]'
  $usedSlugs = New-Object 'System.Collections.Generic.HashSet[string]'
  if (-not (Test-Path $stockDir)) { return @{ Urls = $usedUrls; Slugs = $usedSlugs } }
  Get-ChildItem -Path $stockDir -File -Filter *.json | ForEach-Object {
    [void]$usedSlugs.Add($_.BaseName)
    try {
      $data = Get-Content -Path $_.FullName -Raw | ConvertFrom-Json
      if ($data.image_url) { [void]$usedUrls.Add([string]$data.image_url) }
    } catch {}
  }
  return @{ Urls = $usedUrls; Slugs = $usedSlugs }
}

function Test-UsableResult($Result) {
  if (-not $Result -or -not $Result.url) { return $false }
  if ($Result.mature -eq $true) { return $false }
  $url = [string]$Result.url
  if ($url -notmatch '\.(jpg|jpeg|png|webp)(\?|$)') { return $false }
  if (([int]($Result.width | ForEach-Object { $_ }) ) -lt 800) { return $false }
  if (([int]($Result.height | ForEach-Object { $_ }) ) -lt 600) { return $false }
  $category = [string]$Result.category
  if ($category -and $category.ToLowerInvariant() -ne 'photograph') { return $false }
  $parts = New-Object System.Collections.Generic.List[string]
  if ($Result.title) { [void]$parts.Add([string]$Result.title) }
  if ($Result.tags) {
    foreach ($tag in $Result.tags) {
      if ($tag.name) { [void]$parts.Add([string]$tag.name) }
    }
  }
  $haystack = ($parts -join ' ').ToLowerInvariant()
  foreach ($term in $badTerms) {
    if ($haystack.Contains($term)) { return $false }
  }
  return $true
}

function Invoke-Openverse([string]$Query, [int]$Page) {
  $params = [ordered]@{
    q = $Query
    license = 'cc0,pdm'
    license_type = 'commercial'
    extension = 'jpg,jpeg,png,webp'
    page_size = $pageSize
    page = $Page
  }
  $qs = ($params.GetEnumerator() | ForEach-Object { '{0}={1}' -f $_.Key, [uri]::EscapeDataString([string]$_.Value) }) -join '&'
  $url = "https://api.openverse.org/v1/images/?$qs"
  $headers = @{
    'User-Agent' = 'mansetradar-stock-seeder/1.0'
    'Accept' = 'application/json'
  }
  $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 30
  if ($null -eq $response.results) { return @() }
  return @($response.results)
}

function Get-UniqueSlug([string]$Base, $UsedSlugs) {
  $slug = Slugify $Base
  if (-not $slug) { $slug = "openverse-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" }
  $candidate = $slug
  $i = 2
  while ($UsedSlugs.Contains($candidate)) {
    $candidate = "$slug-$i"
    $i++
  }
  [void]$UsedSlugs.Add($candidate)
  return $candidate
}

function Write-JsonNoBom([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function New-Entry($Result, [string]$Category, $UsedSlugs) {
  $baseTitle = Titleize ([string]$Result.title) "$Category stok fotograf"
  $slug = Get-UniqueSlug "ov-$Category-$baseTitle" $UsedSlugs
  $license = ((@($Result.license, $Result.license_version) | Where-Object { $_ }) -join ' ').ToUpperInvariant()
  $provider = Titleize ([string]$Result.provider) 'Openverse'
  $sourceUrl = ''
  if ($Result.foreign_landing_url) {
    $sourceUrl = [string]$Result.foreign_landing_url
  } elseif ($Result.detail_url) {
    $sourceUrl = [string]$Result.detail_url
  }
  $entry = [ordered]@{
    title = $baseTitle
    category = $Category
    image_url = [string]$Result.url
    image_alt = Titleize ([string]$Result.title) "$Category kategorisi icin stok fotograf"
    provider = $provider
    license = $license
    source_url = $sourceUrl
    tags = @((Slugify $Category), 'openverse', (Slugify $provider), (Slugify ([string]$Result.license)))
    note = "Serbest kullanim icin secildi. Kaynak: $provider. Lisans: $license."
  }
  $entry.tags = @($entry.tags | Where-Object { $_ })
  return @{ Slug = $slug; Entry = $entry }
}

$existing = Get-ExistingSets
$usedUrls = $existing.Urls
$usedSlugs = $existing.Slugs
$created = 0
$perCategory = @{}

foreach ($target in $targets) {
  $collected = 0
  foreach ($query in $target.Queries) {
    for ($page = 1; $page -le $maxPages -and $collected -lt $target.Quota; $page++) {
      $results = Invoke-Openverse -Query $query -Page $page
      if (-not $results.Count) { break }
      foreach ($result in $results) {
        if ($collected -ge $target.Quota) { break }
        if (-not (Test-UsableResult $result)) { continue }
        $url = [string]$result.url
        if ($usedUrls.Contains($url)) { continue }
        [void]$usedUrls.Add($url)
        $built = New-Entry $result $target.Category $usedSlugs
        $json = ($built.Entry | ConvertTo-Json -Depth 8)
        Write-JsonNoBom (Join-Path $stockDir "$($built.Slug).json") ($json + "`n")
        $collected++
        $created++
      }
    }
    if ($collected -ge $target.Quota) { break }
  }
  $perCategory[$target.Category] = $collected
}

foreach ($item in $topUpQueries) {
  if ($created -ge $targetTotal) { break }
  for ($page = 1; $page -le $maxPages -and $created -lt $targetTotal; $page++) {
    $results = Invoke-Openverse -Query $item.Query -Page $page
    if (-not $results.Count) { break }
    foreach ($result in $results) {
      if ($created -ge $targetTotal) { break }
      if (-not (Test-UsableResult $result)) { continue }
      $url = [string]$result.url
      if ($usedUrls.Contains($url)) { continue }
      [void]$usedUrls.Add($url)
      $built = New-Entry $result $item.Category $usedSlugs
      $json = ($built.Entry | ConvertTo-Json -Depth 8)
      Write-JsonNoBom (Join-Path $stockDir "$($built.Slug).json") ($json + "`n")
      $created++
      if (-not $perCategory.ContainsKey($item.Category)) { $perCategory[$item.Category] = 0 }
      $perCategory[$item.Category]++
    }
  }
}

[pscustomobject]@{
  created = $created
  perCategory = $perCategory
} | ConvertTo-Json -Depth 6
