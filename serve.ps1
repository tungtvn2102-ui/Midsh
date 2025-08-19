param(
  [int]$Port = 8002,
  [string]$Root = ""
)

if (-not $Root -or $Root -eq "") { $Root = (Get-Location).Path }

$ip = [System.Net.IPAddress]::Loopback
$listener = [System.Net.Sockets.TcpListener]::new($ip, $Port)
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"

$mime = @{
  ".html"="text/html"; ".htm"="text/html"; ".js"="application/javascript"; ".mjs"="application/javascript"; ".css"="text/css"; ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".wasm"="application/wasm"; ".txt"="text/plain"
}

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    # Read headers until blank line
    while ($reader.ReadLine()) { if ($_.Length -eq 0) { break } }

    if (-not $requestLine) { $client.Close(); continue }
    $parts = $requestLine.Split(' ')
    $method = $parts[0]
    $path = $parts[1]
    if ($path -eq "/") { $path = "/index.html" }
    $local = Join-Path $Root ($path.TrimStart('/'))

    $status = 200
    if (-not (Test-Path $local)) {
      $status = 404
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nAccess-Control-Allow-Origin: *`r`nContent-Length: " + $body.Length + "`r`nConnection: close`r`n`r`n"
      $bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($bytes,0,$bytes.Length)
      $stream.Write($body,0,$body.Length)
    } else {
      $ext = [System.IO.Path]::GetExtension($local).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $data = [System.IO.File]::ReadAllBytes($local)
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nAccess-Control-Allow-Origin: *`r`nContent-Length: " + $data.Length + "`r`nConnection: close`r`n`r`n"
      $bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($bytes,0,$bytes.Length)
      $stream.Write($data,0,$data.Length)
    }
    Write-Host "[$(Get-Date -Format HH:mm:ss)] $method $path -> $status"
  } catch {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] Error: $_" -ForegroundColor Yellow
  } finally {
    try { if ($stream) { $stream.Close() } } catch {}
    try { if ($client) { $client.Close() } } catch {}
  }
}

Add-Type -AssemblyName System.Net.HttpListener
$root = "$(Get-Location)"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8000/")
$listener.Start()
Write-Host "Serving $root at http://localhost:8000/"
$mime = @{
  ".html"="text/html"; ".htm"="text/html"; ".js"="application/javascript"; ".css"="text/css"; ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon";
  ".wasm"="application/wasm"; ".map"="application/json"; ".txt"="text/plain"
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $request = $ctx.Request
    $response = $ctx.Response
    $rel = $request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $full = Join-Path $root $rel
    if (-not (Test-Path $full)) {
      $response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    } else {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $response.ContentType = $ct
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $response.ContentLength64 = $bytes.Length
    }
    $response.OutputStream.Write($bytes,0,$bytes.Length)
  } catch {
  } finally {
    $ctx.Response.OutputStream.Close()
  }
}
