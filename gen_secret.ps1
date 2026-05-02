$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$secret = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
Write-Output $secret
