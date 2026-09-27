$ErrorActionPreference='Stop'
$vaultRoot=Split-Path $PSScriptRoot -Parent
$vaultEnvelope=Get-Content -LiteralPath (Join-Path $vaultRoot 'artifacts/migration/signing-vault.json') -Raw | ConvertFrom-Json
$vaultRecovery=(Get-Content -LiteralPath (Join-Path $vaultRoot '.private-signing/migration-recovery.txt') -Raw).Trim()
$vaultEncryptionKey=[Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($vaultRecovery))
$vaultCipher=[Convert]::FromBase64String($vaultEnvelope.ciphertext)
$vaultPlain=[byte[]]::new($vaultCipher.Length)
$vaultAes=[Security.Cryptography.AesGcm]::new($vaultEncryptionKey,16)
try{
    $vaultAes.Decrypt([Convert]::FromBase64String($vaultEnvelope.nonce),$vaultCipher,[Convert]::FromBase64String($vaultEnvelope.tag),$vaultPlain)
    $vaultPayload=[Text.Encoding]::UTF8.GetString($vaultPlain) | ConvertFrom-Json
    $vaultOriginal=[IO.File]::ReadAllBytes((Join-Path $vaultRoot '.private-signing/xunlian-personal.jks'))
    if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Convert]::FromBase64String($vaultPayload.keystore))) -ne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($vaultOriginal))){throw 'Keystore mismatch'}
    $vaultSecure=Import-Clixml -LiteralPath (Join-Path $vaultRoot '.private-signing/password.clixml')
    if($vaultPayload.password -cne ([PSCredential]::new('signing',$vaultSecure)).GetNetworkCredential().Password){throw 'Signing password mismatch'}
    $vaultCipher[0]=$vaultCipher[0] -bxor 1
    $vaultTamperRejected=$false
    try{$vaultAes.Decrypt([Convert]::FromBase64String($vaultEnvelope.nonce),$vaultCipher,[Convert]::FromBase64String($vaultEnvelope.tag),$vaultPlain)}catch [Security.Cryptography.CryptographicException]{$vaultTamperRejected=$true}
    if(!$vaultTamperRejected){throw 'Modified vault was not rejected'}
    Write-Output 'PASS: original keystore and password preserved; altered ciphertext rejected; no secrets printed.'
}finally{$vaultAes.Dispose();[Array]::Clear($vaultPlain);[Array]::Clear($vaultEncryptionKey);Remove-Variable vaultRecovery,vaultPayload,vaultSecure -ErrorAction SilentlyContinue}
