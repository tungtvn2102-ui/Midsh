$ErrorActionPreference = "SilentlyContinue"
$ip = [System.Net.IPAddress]::Loopback
$port = 8002
$listener = [System.Net.Sockets.TcpListener]::new($ip, $port)
$listener.Start()
Write-Host "Serving $(Get-Location) at http://localhost:$port/"
$mime = @{
  ".html"="text/html"; ".htm"="text/html"; ".js"="application/javascript"; ".mjs"="application/javascript"; ".css"="text/css"; ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".wasm"="application/wasm"; ".txt"="text/plain"
}
while ($true) {
  if (-not $listener.Pending) { Start-Sleep -Milliseconds 50; continue }
  $client = $listener.AcceptTcpClient()
  Start-Job -ScriptBlock {
    param($client,$mime)
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while ($reader.ReadLine()) { if ($_.Length -eq 0) { break } }
      if (-not $requestLine) { $client.Close(); return }
      $parts = $requestLine.Split(' ')
      $method = $parts[0]
      $path = $parts[1]
      if ($path -eq "/") { $path = "/index.html" }
      $local = Join-Path (Get-Location) ($path.TrimStart('/'))
      if (-not (Test-Path $local)) {
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
    } catch {}
    finally { try { $stream.Close() } catch {}; $client.Close() }
  } -ArgumentList $client,$mime | Out-Null
}
