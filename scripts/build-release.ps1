$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(!$env:JAVA_HOME){$env:JAVA_HOME='D:\DeepSeekHarnessData\jdk-21'}
if(!$env:ANDROID_HOME){$env:ANDROID_HOME='D:\DeepSeekHarnessData\android-sdk'}
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE'
Set-Content -LiteralPath (Join-Path $taskRoot 'frontend\android\local.properties') -Value ('sdk.dir='+$env:ANDROID_HOME.Replace('\','/')) -Encoding ascii
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'artifacts') | Out-Null
$signDir=Join-Path $taskRoot '.private-signing'
New-Item -ItemType Directory -Force -Path $signDir | Out-Null
$keyFile=Join-Path $signDir 'xunlian-personal.jks'
$passwordFile=Join-Path $signDir 'password.clixml'
if(Test-Path -LiteralPath $keyFile){
    if(!(Test-Path -LiteralPath $passwordFile)){throw 'Signing password file missing; preserve existing keystore'}
    $securePassword=Import-Clixml -LiteralPath $passwordFile
}else{
    $bytes=[byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $securePassword=ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
    $securePassword | Export-Clixml -LiteralPath $passwordFile
}
$env:XUNLIAN_SIGN_PASSWORD=([PSCredential]::new('signing',$securePassword)).GetNetworkCredential().Password
try{
    if(!(Test-Path -LiteralPath $keyFile)){
        & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -keystore $keyFile -alias xunlian-personal -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Xunlian Personal,O=Xunlian,C=CN' -storepass:env XUNLIAN_SIGN_PASSWORD -keypass:env XUNLIAN_SIGN_PASSWORD
        if($LASTEXITCODE -ne 0){throw 'Signing key generation failed'}
    }
    Push-Location (Join-Path $taskRoot 'frontend')
    try{
        & npm.cmd run build:android
        if($LASTEXITCODE -ne 0){throw 'Web build failed'}
        & '.\android\gradlew.bat' -p '.\android' assembleRelease --console=plain
        if($LASTEXITCODE -ne 0){throw 'Release build failed'}
        $target=Join-Path $taskRoot 'artifacts\DongQi-2.0.1-personal.apk'
        & (Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\apksigner.bat') sign --ks $keyFile --ks-key-alias xunlian-personal --ks-pass env:XUNLIAN_SIGN_PASSWORD --key-pass env:XUNLIAN_SIGN_PASSWORD --out $target '.\android\app\build\outputs\apk\release\app-release-unsigned.apk'
        if($LASTEXITCODE -ne 0){throw 'APK signing failed'}
        & (Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\apksigner.bat') verify --verbose --print-certs $target
        if($LASTEXITCODE -ne 0){throw 'APK signature verification failed'}
    }finally{Pop-Location}
}finally{Remove-Item Env:XUNLIAN_SIGN_PASSWORD -ErrorAction SilentlyContinue}
