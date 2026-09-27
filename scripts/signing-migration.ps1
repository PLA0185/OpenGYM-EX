param(
    [ValidateSet('export','import')][string]$Mode='export',
    [string]$VaultPath
)
$ErrorActionPreference='Stop'
$migrationRoot=Split-Path $PSScriptRoot -Parent
$migrationSignDir=Join-Path $migrationRoot '.private-signing'
if(!$VaultPath){$VaultPath=Join-Path $migrationRoot 'artifacts/migration/signing-vault.json'}
function BytesFromBase64([string]$value){return ,([Convert]::FromBase64String($value))}
if($Mode -eq 'export'){
    $migrationKeyFile=Join-Path $migrationSignDir 'xunlian-personal.jks'
    $migrationPasswordFile=Join-Path $migrationSignDir 'password.clixml'
    if(!(Test-Path -LiteralPath $migrationKeyFile) -or !(Test-Path -LiteralPath $migrationPasswordFile)){throw 'Original signing materials missing'}
    $migrationSecure=Import-Clixml -LiteralPath $migrationPasswordFile
    $migrationPassphraseFile=Join-Path $migrationSignDir 'migration-recovery.txt'
    if(Test-Path -LiteralPath $migrationPassphraseFile){throw 'Recovery file already exists; preserve it and existing vault before creating another export'}
    $migrationPassphraseBytes=[byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($migrationPassphraseBytes)
    $migrationPassphrase=[Convert]::ToBase64String($migrationPassphraseBytes)
    $migrationEncryptionKey=[Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($migrationPassphrase))
    $migrationPlain=[Text.Encoding]::UTF8.GetBytes((@{schemaVersion=1;alias='xunlian-personal';keystore=[Convert]::ToBase64String([IO.File]::ReadAllBytes($migrationKeyFile));password=([PSCredential]::new('signing',$migrationSecure)).GetNetworkCredential().Password;certificateSha256='100d6bb2cc70e95b8b203935bbdc62de4f15a5e478465c78aafd74e77d60285f'} | ConvertTo-Json -Compress))
    $migrationNonce=[byte[]]::new(12);[Security.Cryptography.RandomNumberGenerator]::Fill($migrationNonce)
    $migrationCipher=[byte[]]::new($migrationPlain.Length);$migrationTag=[byte[]]::new(16)
    $migrationAes=[Security.Cryptography.AesGcm]::new($migrationEncryptionKey,16)
    try{$migrationAes.Encrypt($migrationNonce,$migrationPlain,$migrationCipher,$migrationTag)}finally{$migrationAes.Dispose();[Array]::Clear($migrationPlain);[Array]::Clear($migrationEncryptionKey)}
    New-Item -ItemType Directory -Force -Path (Split-Path $VaultPath -Parent) | Out-Null
    @{schemaVersion=1;cipher='AES-256-GCM';keyDerivation='SHA256 of random 256-bit recovery passphrase';nonce=[Convert]::ToBase64String($migrationNonce);tag=[Convert]::ToBase64String($migrationTag);ciphertext=[Convert]::ToBase64String($migrationCipher)} | ConvertTo-Json | Set-Content -LiteralPath $VaultPath -Encoding utf8
    Set-Content -LiteralPath $migrationPassphraseFile -Value $migrationPassphrase -Encoding utf8
    Remove-Variable migrationPassphrase,migrationSecure,migrationPassphraseBytes
    Write-Output ('Encrypted vault: '+$VaultPath)
    Write-Output ('Keep recovery file separate, never upload: '+$migrationPassphraseFile)
}else{
    $migrationEnvelope=Get-Content -LiteralPath $VaultPath -Raw | ConvertFrom-Json
    if($migrationEnvelope.schemaVersion -ne 1 -or $migrationEnvelope.cipher -ne 'AES-256-GCM'){throw 'Unsupported signing vault'}
    $migrationSecure=Read-Host '输入旧电脑 migration-recovery.txt 中的恢复口令（不是 API Key）' -AsSecureString
    $migrationPassphrase=([PSCredential]::new('recovery',$migrationSecure)).GetNetworkCredential().Password.Trim()
    $migrationEncryptionKey=[Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($migrationPassphrase))
    $migrationCipher=BytesFromBase64 $migrationEnvelope.ciphertext
    $migrationPlain=[byte[]]::new($migrationCipher.Length)
    $migrationAes=[Security.Cryptography.AesGcm]::new($migrationEncryptionKey,16)
    try{$migrationAes.Decrypt((BytesFromBase64 $migrationEnvelope.nonce),$migrationCipher,(BytesFromBase64 $migrationEnvelope.tag),$migrationPlain)}finally{$migrationAes.Dispose();[Array]::Clear($migrationEncryptionKey);Remove-Variable migrationPassphrase,migrationSecure}
    try{$migrationPayload=[Text.Encoding]::UTF8.GetString($migrationPlain) | ConvertFrom-Json}finally{[Array]::Clear($migrationPlain)}
    if($migrationPayload.alias -ne 'xunlian-personal' -or $migrationPayload.certificateSha256 -ne '100d6bb2cc70e95b8b203935bbdc62de4f15a5e478465c78aafd74e77d60285f'){throw 'Unexpected signing identity'}
    $migrationKeyFile=Join-Path $migrationSignDir 'xunlian-personal.jks'
    $migrationKeyBytes=BytesFromBase64 $migrationPayload.keystore
    if((Test-Path -LiteralPath $migrationKeyFile) -and [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($migrationKeyFile))) -ne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($migrationKeyBytes))){throw 'A different keystore already exists; refusing to overwrite it'}
    New-Item -ItemType Directory -Force -Path $migrationSignDir | Out-Null
    [IO.File]::WriteAllBytes($migrationKeyFile,$migrationKeyBytes)
    ConvertTo-SecureString $migrationPayload.password -AsPlainText -Force | Export-Clixml -LiteralPath (Join-Path $migrationSignDir 'password.clixml')
    Remove-Variable migrationPayload,migrationKeyBytes
    Write-Output 'Original keystore restored; password now encrypted for this Windows account. Verify certificate when building the APK.'
}
